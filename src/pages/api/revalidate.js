// src/pages/api/revalidate.js
/**
 * On-demand revalidation + product-cache maintenance (Pages Router).
 *
 * What this does
 *  1) Auth (secret OR same-origin + CSRF).
 *  2) Revalidate page paths (from "path"/"paths" or "slug"/"slugs").
 *  3) Product cache maintenance:
 *     - clear/prime by explicit product "ids"
 *     - clear/prime by company "slug"/"slugs" (discover IDs via WP)
 *  4) [NEW] Clear ALL product cache in this server instance via ?all=1 (or body { all: 1 }).
 *
 * Query/body accepted
 *   - path=/a  & path=/b        OR  body { paths: ["/a","/b"] }
 *   - slug=sabbir & slugs[]=... OR  body { slug, slugs: [] }
 *   - ids=1,2,3                 OR  body { ids: [1,2,3] }
 *   - prime=1  (refresh product data from WP after clearing)
 *   - all=1    (wipe entire product cache in this server instance)   <-- [NEW]
 *
 * Notes
 * - Cache is in-memory per instance. In multi-region/auto-scaled envs, this affects only
 *   the instance that serves the request. Fan-out or use a shared store for global invalidation.
 * - Response is `no-store`.
 */

import { clearProductCache, forceRefreshProducts, _debugSnapshot } from '@/lib/productCache'; // ✅ matches your productCache.js

// -----------------------------
// Small helpers (kept minimal)
// -----------------------------
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === '') return [];
  return [v];
}
function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  const s = p.trim();
  if (!s) return '';
  return s.startsWith('/') ? s : `/${s}`;
}
async function readJsonBody(req) {
  // Next parses JSON when header is application/json; still be defensive.
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    const raw = req.body ?? '';
    if (typeof raw !== 'string' || raw === '') return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function sameOriginOk(req) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  if (!origin || !host) return true; // server-to-server
  try {
    return new URL(origin).host === host;
  } catch {
    return origin.endsWith(host);
  }
}
function csrfOk(req) {
  const h = req.headers['x-ms-csrf'];
  const c = req.cookies?.ms_csrf || req.cookies?.ms_csrf; // tolerate either key
  return Boolean(h && c && h === c);
}
function authOk(req) {
  const q = req.query || {};
  const provided =
    q.secret ||
    req.headers['x-ms-cache-secret'] ||
    req.headers['x-revalidate-secret'] ||
    req.headers['x-vercel-reval-key'];

  if (provided && process.env.REVALIDATE_SECRET && provided === process.env.REVALIDATE_SECRET) {
    return { ok: true, mode: 'secret' };
  }
  if (sameOriginOk(req) && csrfOk(req)) {
    return { ok: true, mode: 'csrf' };
  }
  return { ok: false, mode: 'none' };
}

/**
 * Resolve product IDs for a company slug from WP.
 * Adjust endpoint(s) to your actual ones if different.
 */
async function getProductIdsForCompanySlug(slug) {
  const WP = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
  if (!WP || !slug) return [];
  const candidates = [
    `${WP}/wp-json/mini-sites/v1/company-products?slug=${encodeURIComponent(slug)}`,
    `${WP}/wp-json/mini-sites/v1/get-products-by-company?slug=${encodeURIComponent(slug)}`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { 'Cache-Control': 'no-store' } });
      if (!r.ok) continue;
      const j = await r.json();
      // Expecting: { ids: [1,2,3] } or just [1,2,3]
      const arr = Array.isArray(j) ? j : Array.isArray(j?.ids) ? j.ids : [];
      const ids = arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
      if (ids.length) return ids;
    } catch {
      // ignore and try next
    }
  }
  return [];
}

// ---------------------------------------
// Main handler (keeps prior behaviors)
// ---------------------------------------
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const auth = authOk(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: 'Unauthorized', mode: auth.mode });
  }

  try {
    const q = req.query || {};
    const b = await readJsonBody(req);

    const slugPrefix = process.env.REVALIDATE_SLUG_PREFIX || '';
    const wantPrime = String(b.prime ?? q.prime ?? '') === '1';

    // ---------------------------
    // [NEW] parse clear-all flag
    // ---------------------------
    // Supports: ?all=1 or body { all: 1 } or ?clear=all
    const clearAll =
      String(b.all ?? q.all ?? '') === '1' ||
      String(b.clear ?? q.clear ?? '').toLowerCase() === 'all';

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
      const clean = String(s || '').trim();
      if (!clean) return;
      const prefixed = `${slugPrefix}${clean}`;
      slugPaths.push(normalizePath(prefixed));
    });
    slugPaths.forEach(p => paths.add(p));

    const toPaths = Array.from(paths);

    // Product IDs (direct)
    const idsDirect = (() => {
      // allow "ids" as CSV or array
      const raw = b.ids ?? q.ids;
      const arr = Array.isArray(raw)
        ? raw
        : String(raw ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
      return arr.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
    })();

    // ---------------------------
    // Execute actions
    // ---------------------------
    const revalidated = [];
    const errors = [];

    // A) [NEW] If clearAll is set, wipe the entire cache in this instance first,
    // but still allow revalidate/other actions in the same call if provided.
    let clearedAll = false;
    let beforeSnap = null;
    let afterSnap = null;
    if (clearAll) {
      try {
        beforeSnap = _debugSnapshot?.() ?? null;
        // IMPORTANT: clearProductCache() with NO arguments → clear ALL (per your impl).
        clearProductCache(); // <-- the only "clear ALL" behavior you requested
        clearedAll = true;
        afterSnap = _debugSnapshot?.() ?? null;
      } catch (err) {
        errors.push({ path: '(clearAll)', error: err?.message || String(err) });
      }
    }

    // B) Revalidate explicit paths (includes slug→path)
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

    // C) By slug → discover product IDs from WP, then clear/prime
    const bySlug = {};
    for (const s of slugs) {
      const slug = String(s || '').trim();
      if (!slug) continue;
      try {
        const ids = await getProductIdsForCompanySlug(slug);
        bySlug[slug] = { ids, cleared: false, primed: false };
        if (ids.length) {
          // Clear per-id cache — clearProductCache only supports single id/all, so loop
          for (const id of ids) {
            try {
              clearProductCache(id);
            } catch (e) {
              errors.push({ path: `(slug:${slug}) id:${id}`, error: e?.message || String(e) });
            }
          }
          bySlug[slug].cleared = true;

          if (wantPrime) {
            try {
              await forceRefreshProducts(ids); // refresh from WP and refill cache
              bySlug[slug].primed = true;
            } catch (e) {
              errors.push({ path: `(prime slug:${slug})`, error: e?.message || String(e) });
            }
          }
        }
      } catch (err) {
        errors.push({ path: `(slug:${slug})`, error: err?.message || String(err) });
      }
    }

    // D) Direct product ids → clear/prime
    let clearedIds = [];
    let primedIds = [];
    if (idsDirect.length) {
      // Clear each id (API supports 1 id at a time)
      for (const id of idsDirect) {
        try {
          clearProductCache(id);
          clearedIds.push(id);
        } catch (e) {
          errors.push({ path: `(id:${id})`, error: e?.message || String(e) });
        }
      }
      if (wantPrime) {
        try {
          await forceRefreshProducts(idsDirect);
          primedIds = idsDirect.slice();
        } catch (e) {
          errors.push({ path: '(prime ids)', error: e?.message || String(e) });
        }
      }
    }

    // E) Nothing to do?
    if (!clearAll && toPaths.length === 0 && slugs.length === 0 && idsDirect.length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          'Nothing to do. Provide ?all=1 or paths (?path=/.. or body.paths), or slugs, or ids.',
      });
    }

    // Status & response
    const status = errors.length ? 207 /* Multi-Status-ish */ : 200;
    return res.status(status).json({
      ok: true,
      method: req.method,
      authMode: auth.mode,
      revalidated,
      count: toPaths.length,
      errors,
      // [NEW] Clear-all info
      clearedAll,
      before: beforeSnap,
      after: afterSnap,
      // Product info
      clearedIds,
      primed: wantPrime ? primedIds : undefined,
      bySlug,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Revalidate failed' });
  }
}
