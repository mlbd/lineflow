// src/lib/productCache.js
// In-memory (per-instance) product card cache for Next.js (Pages Router).
// - Keyed by product ID
// - SWR behavior: fresh window + stale window
// - In-flight dedupe per ID
// - Batch fetches true misses from WP: /wp-json/mini-sites/v1/get-products-by-ids?ids=...

const g = globalThis;
if (!g.__MS_PRODUCT_CACHE__) {
  g.__MS_PRODUCT_CACHE__ = { store: new Map(), inflight: new Map() };
}
const STORE = g.__MS_PRODUCT_CACHE__.store; // id -> { data, freshUntil, staleUntil }
const INFLIGHT = g.__MS_PRODUCT_CACHE__.inflight;

const WP_URL = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
const WP_USER = process.env.WP_API_USER || '';
const WP_PASS = process.env.WP_API_PASS || '';

function authHeader() {
  if (WP_USER && WP_PASS) {
    const b64 = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
    return { Authorization: `Basic ${b64}` };
  }
  return {};
}

function write(id, data, { ttlSeconds = 60 * 60 * 6, staleSeconds = 60 * 60 * 24 } = {}) {
  const now = Date.now();
  STORE.set(Number(id), {
    data,
    freshUntil: now + ttlSeconds * 1000,
    staleUntil: now + (ttlSeconds + staleSeconds) * 1000,
  });
  return data;
}

function read(id) {
  const e = STORE.get(Number(id));
  if (!e) return { hit: false };
  const now = Date.now();
  if (now < e.freshUntil) return { hit: true, fresh: true, data: e.data };
  if (now < e.staleUntil) return { hit: true, fresh: false, data: e.data };
  return { hit: false };
}

/** Clear one, or all (when id is undefined/null) */
export function clearProductCache(id) {
  if (typeof id !== 'undefined' && id !== null) {
    STORE.delete(Number(id));
    INFLIGHT.delete(Number(id));
    return { ok: true, cleared: Number(id) };
  }
  STORE.clear();
  INFLIGHT.clear();
  return { ok: true, cleared: 'all' };
}

async function fetchProductsFromWP(ids) {
  if (!WP_URL) throw new Error('Missing WP_SITE_URL / NEXT_PUBLIC_WP_SITE_URL');
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const url = `${WP_URL}/wp-json/mini-sites/v1/get-products-by-ids?ids=${encodeURIComponent(ids.join(','))}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', ...authHeader() } });
  if (!res.ok) throw new Error(`WP ${res.status} for ${url}`);
  const json = await res.json().catch(() => ({}));
  return Array.isArray(json?.products) ? json.products : Array.isArray(json) ? json : [];
}

async function refreshOne(id, opts) {
  try {
    const list = await fetchProductsFromWP([id]);
    const p = list.find(x => Number(x?.id) === Number(id));
    if (p) write(id, p, opts);
  } finally {
    INFLIGHT.delete(Number(id));
  }
}

/** Warm a single product into cache immediately after a clear */
export async function primeProductCache(id, opts) {
  if (!id) return { ok: false, error: 'Missing id' };
  await refreshOne(Number(id), opts);
  return { ok: true, primed: Number(id) };
}

/**
 * Returns product cards in the SAME ORDER as `ids`.
 * Uses cache when fresh; serves stale immediately and refreshes in background.
 * Batch-fetches all true misses once.
 */
export async function getProductCardsBatch(ids, opts = {}) {
  const ordered = (ids || []).map(n => Number(n)).filter(Boolean);
  const uniq = Array.from(new Set(ordered));

  const results = new Map();
  const misses = [];

  for (const id of uniq) {
    const r = read(id);
    if (r.hit && r.fresh) {
      results.set(id, r.data);
      continue;
    }
    if (r.hit && !r.fresh) {
      results.set(id, r.data); // serve stale now
      if (!INFLIGHT.has(id)) INFLIGHT.set(id, refreshOne(id, opts)); // refresh in bg
      continue;
    }
    misses.push(id); // true miss
  }

  if (misses.length) {
    try {
      const fetched = await fetchProductsFromWP(misses);
      for (const p of fetched) {
        const pid = Number(p?.id);
        if (!pid) continue;
        write(pid, p, opts);
        results.set(pid, p);
      }
    } catch {
      // leave partial if WP batch failed; stale entries already returned
    }
  }

  return ordered.map(id => results.get(id)).filter(Boolean);
}

// Optional helper for inspection
export function _debugSnapshot() {
  return { size: STORE.size, keys: Array.from(STORE.keys()) };
}
