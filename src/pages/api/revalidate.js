// src/pages/api/revalidate.js
/**
 * On-demand revalidation endpoint (Pages Router).
 *
 * What this does now:
 *  1) Auth check (secret or same-origin+csrf).
 *  2) Revalidate page paths (from "path"/"paths" or "slug"/"slugs").
 *  3) If a "slug" is provided, it will:
 *     - Load the company page from WP to discover product IDs.
 *     - Clear in-memory product cache for those IDs.
 *     - Optionally force-refresh those products from WP right now (prime).
 *
 * Query/body extras:
 *   - slug / slugs: company slug(s) to revalidate, e.g. "sabbir"
 *   - prime=1: also force-refresh product data from WP for the slug's products
 *   - ids=1,2,3: directly clear/prime specific product ids (advanced)
 *   - tags: forwarded to an optional App Router tag endpoint (REVALIDATE_TAG_ENDPOINT)
 *
 * Response includes details of what was revalidated and what product IDs were cleared/primed.
 */

import { clearProductCache, forceRefreshProducts } from '@/lib/productCache';
import { wpApiFetch } from '@/lib/wpApi';

function sameOriginOk(req) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return origin.endsWith(host);
  }
}

function csrfOk(req) {
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
  if (/^https?:\/\//i.test(s)) return null; // disallow absolute URLs
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

function slugToPath(slug, prefix = '') {
  if (typeof slug !== 'string' || !slug.trim()) return null;
  const clean = slug.replace(/^\/+/, '');
  const pre = (prefix || '').replace(/\/$/, '');
  const joined = pre ? `${pre}/${clean}` : `/${clean}`;
  return normalizePath(joined);
}

async function readJsonBody(req) {
  if (req.method !== 'POST') return {};
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  // Never cache this endpoint
  res.setHeader('Cache-Control', 'no-store');

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
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const q = req.query || {};
    const b = await readJsonBody(req);

    const slugPrefix = process.env.REVALIDATE_SLUG_PREFIX || '';
    const wantPrime = String(b.prime ?? q.prime ?? '') === '1';

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
    const slugs = toArray(b.slugs ?? q.slugs);
    const singleSlug = b.slug ?? q.slug;
    if (singleSlug) slugs.push(singleSlug);

    const slugPaths = [];
    slugs.forEach(s => {
      const np = slugToPath(s, slugPrefix);
      if (np) {
        paths.add(np);
        slugPaths.push({ slug: s, path: np });
      }
    });

    // Revalidate each path
    const toPaths = Array.from(paths);
    const revalidated = [];
    const errors = [];

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

    // ===== Product cache maintenance =====
    // Accept ids via query/body (advanced/manual)
    const idsDirect = String(b.ids ?? q.ids ?? '')
      .split(',')
      .map(n => Number(n))
      .filter(n => Number.isFinite(n));

    // If slugs were provided, fetch their product IDs via WP
    const bySlug = [];
    for (const { slug } of slugPaths) {
      try {
        const resp = await wpApiFetch(`company-page?slug=${encodeURIComponent(slug)}`);
        if (!resp.ok) throw new Error(`company-page ${resp.status}`);
        const data = await resp.json();
        const productIdsRaw = data?.acf?.selected_products || [];
        const ids = productIdsRaw
          .map(p => (p && typeof p === 'object' ? p.id : p))
          .map(n => Number(n))
          .filter(n => Number.isFinite(n));
        bySlug.push({ slug, ids, pageId: data?.id || null });
      } catch (err) {
        bySlug.push({ slug, ids: [], error: err?.message || String(err) });
      }
    }

    // Merge all IDs to clear
    const toClear = new Set(idsDirect);
    bySlug.forEach(entry => entry.ids.forEach(id => toClear.add(id)));

    const clearedIds = [];
    const primedIds = [];

    for (const id of toClear) {
      const r = clearProductCache(id); // clear in-memory cache
      if (r?.ok) clearedIds.push(id);
    }

    if (wantPrime && toClear.size) {
      try {
        const refreshed = await forceRefreshProducts(Array.from(toClear), {
          ttlSeconds: 60 * 60 * 6,
          staleSeconds: 60 * 60 * 24,
        });
        // "refreshed" returns the actual products we pulled; record IDs for visibility
        refreshed.forEach(p => {
          const pid = Number(p?.id);
          if (pid) primedIds.push(pid);
        });
      } catch (err) {
        errors.push({ path: '(prime:products)', error: err?.message || String(err) });
      }
    }

    // Optional: forward tags to an App Router endpoint
    let forwardedTags;
    let tagForwardResult;
    const tags = toArray(b.tags ?? q.tags).filter(Boolean);
    const tagEndpoint = process.env.REVALIDATE_TAG_ENDPOINT;
    if (tags.length && tagEndpoint) {
      forwardedTags = [...tags];
      try {
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const url = `${proto}://${host}${tagEndpoint}`;
        const headers = { 'content-type': 'application/json' };
        if (authMode === 'secret' && providedSecret) {
          headers['x-ms-cache-secret'] = String(providedSecret);
        } else if (authMode === 'csrf') {
          const token = req.cookies?.ms_csrf || req.headers['x-ms-csrf'];
          if (token) {
            headers['x-ms-csrf'] = token;
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
      revalidated,
      count: toPaths.length,
      errors,
      authMode,
      // Product info
      clearedIds,
      primed: wantPrime ? primedIds : undefined,
      bySlug,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Revalidate failed' });
  }
}
