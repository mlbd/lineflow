// src/pages/api/revalidate.js
/**
 * On-demand revalidation endpoint (Pages Router).
 *
 * Auth:
 *  - Option A (external/backends):   ?secret=REVALIDATE_SECRET   or header: x-ms-cache-secret
 *  - Option B (same-origin callers): Origin === Host  AND  header "x-ms-csrf" === cookie "ms_csrf"
 *
 * Input (GET or POST JSON):
 *  {
 *    // Revalidate by path(s)
 *    "path": "/some/path",
 *    "paths": ["/a", "/b"],
 *
 *    // Optional: accept slugs and convert to paths (prefix is optional)
 *    "slug": "acme",
 *    "slugs": ["acme", "leobus"],
 *    // ENV can control prefix for slug->path mapping:
 *    //   REVALIDATE_SLUG_PREFIX=""   -> "/{slug}"
 *    //   REVALIDATE_SLUG_PREFIX="/company" -> "/company/{slug}"
 *
 *    // Optional: forward "tags" to an App Router tag revalidation endpoint
 *    //   Set REVALIDATE_TAG_ENDPOINT="/api/revalidate-tag" (App Router route) to enable.
 *    "tags": ["ms:products"]
 *  }
 *
 * Output:
 *  {
 *    ok: boolean,
 *    method: "GET"|"POST",
 *    count: number,                 // number of paths attempted
 *    revalidated: string[],         // successful paths
 *    errors: {path:string,error:string}[],
 *    forwardedTags?: string[],      // tags we attempted to forward
 *    tagForwardResult?: object,     // response from tag endpoint (if any)
 *    authMode: "secret"|"csrf"
 *  }
 */

function sameOriginOk(req) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  // Allow internal/server calls that may not set Origin/Host (e.g., Node fetch on same host)
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    // Fallback: loose match if origin parsing fails
    return origin.endsWith(host);
  }
}

function csrfOk(req) {
  // Header must match cookie exactly
  const header = req.headers['x-ms-csrf'];
  const cookie = req.cookies?.ms_csrf;
  return !!header && !!cookie && header === cookie;
}

function toArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function normalizePath(p) {
  if (typeof p !== 'string') return null;
  let s = p.trim();
  if (!s) return null;
  // Disallow absolute URLs / api routes for safety
  if (/^https?:\/\//i.test(s)) return null;
  if (s.startsWith('/api/')) return null;
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

function slugToPath(slug, prefix = '') {
  if (typeof slug !== 'string' || !slug.trim()) return null;
  const clean = slug.replace(/^\/+/, ''); // no leading slash in slug
  const pre = (prefix || '').replace(/\/$/, ''); // remove trailing slash in prefix
  const joined = pre ? `${pre}/${clean}` : `/${clean}`;
  return normalizePath(joined);
}

async function readJsonBody(req) {
  if (req.method !== 'POST') return {};
  // If body is already parsed (Next.js default), use it; otherwise parse string
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  // Minimal manual read fallback (rare)
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  // --- Authorization ---
  const providedSecret = req.query.secret || req.headers['x-ms-cache-secret'];
  const secretOk = !!providedSecret && providedSecret === process.env.REVALIDATE_SECRET;

  let authorized = secretOk;
  if (!authorized) {
    if (!sameOriginOk(req) || !csrfOk(req)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    authorized = true;
  }
  const authMode = secretOk ? 'secret' : 'csrf';
  res.setHeader('x-auth-mode', authMode);

  // --- Method guard ---
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const q = req.query || {};
    const b = await readJsonBody(req);

    // Collect paths
    const paths = new Set();

    // From "path"/"paths"
    toArray(b.paths ?? q.paths).forEach(p => {
      const np = normalizePath(p);
      if (np) paths.add(np);
    });
    const singlePath = normalizePath(b.path ?? q.path);
    if (singlePath) paths.add(singlePath);

    // From "slug"/"slugs"
    const slugPrefix = process.env.REVALIDATE_SLUG_PREFIX || '';
    toArray(b.slugs ?? q.slugs).forEach(s => {
      const np = slugToPath(s, slugPrefix);
      if (np) paths.add(np);
    });
    const singleSlugPath = slugToPath(b.slug ?? q.slug, slugPrefix);
    if (singleSlugPath) paths.add(singleSlugPath);

    // Nothing to do?
    const toPaths = Array.from(paths);
    const revalidated = [];
    const errors = [];

    // Revalidate each path
    for (const p of toPaths) {
      try {
        if (typeof res.revalidate === 'function') {
          await res.revalidate(p);
        } else if (typeof res.unstable_revalidate === 'function') {
          await res.unstable_revalidate(p);
        } else {
          throw new Error('Revalidate API not available in this runtime.');
        }
        revalidated.push(p);
      } catch (err) {
        errors.push({ path: p, error: err?.message || String(err) });
      }
    }

    // Optional: forward tags to an App Router tag route, if configured
    let forwardedTags;
    let tagForwardResult;
    const tags = toArray(b.tags ?? q.tags).filter(Boolean);
    const tagEndpoint = process.env.REVALIDATE_TAG_ENDPOINT; // e.g., "/api/revalidate-tag" (App Router)
    if (tags.length && tagEndpoint) {
      forwardedTags = [...tags];
      try {
        // Build absolute URL for internal call
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const url = `${proto}://${host}${tagEndpoint}`;

        // Reuse the same auth mode used to hit this endpoint:
        const headers = { 'content-type': 'application/json' };
        if (authMode === 'secret' && providedSecret) {
          headers['x-ms-cache-secret'] = String(providedSecret);
        } else if (authMode === 'csrf') {
          const token = req.cookies?.ms_csrf || req.headers['x-ms-csrf'];
          if (token) {
            headers['x-ms-csrf'] = token;
            // ensure cookie is present in server->server call
            headers['cookie'] = `ms_csrf=${token}; Path=/; SameSite=Lax`;
          }
        }

        const r = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tags }),
        });
        const j = await r.json().catch(() => ({}));
        tagForwardResult = { status: r.status, ok: r.ok, body: j };
      } catch (err) {
        tagForwardResult = { ok: false, error: err?.message || String(err) };
      }
    }

    return res.json({
      ok: errors.length === 0,
      method: req.method,
      count: toPaths.length,
      revalidated,
      errors,
      forwardedTags,
      tagForwardResult,
      authMode,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Revalidate failed' });
  }
}
