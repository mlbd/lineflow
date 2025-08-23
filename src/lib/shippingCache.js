// lib/shippingCache.js
// Shared in-memory cache (per instance). Adds keying, SWR, and in-flight dedupe.

const stores = new Map(); // key -> { data, expiresAt, staleUntil }
const inflight = new Map(); // key -> Promise

export function writeShippingCache(key, data, { ttlSeconds = 3600, staleSeconds = 86400 } = {}) {
  stores.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000, // "fresh" window
    staleUntil: Date.now() + (ttlSeconds + staleSeconds) * 1000, // can serve stale within this window
  });
  return data;
}

export function readShippingCache(key) {
  const v = stores.get(key);
  if (!v) return null;
  const now = Date.now();
  if (now < v.expiresAt) return v.data; // fresh
  if (now < v.staleUntil) return v.data; // stale-but-acceptable
  return null; // too old
}

/**
 * getOrFetchShipping(key, fetcher, { ttlSeconds, staleSeconds })
 * - returns fresh if available
 * - returns stale if available and refreshes in background
 * - dedupes concurrent fetches per key
 */
export async function getOrFetchShipping(
  key,
  fetcher,
  { ttlSeconds = 3600, staleSeconds = 86400 } = {}
) {
  const v = stores.get(key);
  const now = Date.now();

  // 1) Fresh? return immediately
  if (v && now < v.expiresAt) return v.data;

  // 2) Dedupe concurrent fetches
  if (inflight.has(key)) return inflight.get(key);

  // 3) If stale, return stale immediately and refresh in background
  if (v && now < v.staleUntil) {
    const bg = (async () => {
      try {
        const data = await fetcher();
        return writeShippingCache(key, data, { ttlSeconds, staleSeconds });
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, bg);
    return v.data; // serve stale now
  }

  // 4) Otherwise, fetch and block (first time or too-old cache)
  const p = (async () => {
    try {
      const data = await fetcher();
      return writeShippingCache(key, data, { ttlSeconds, staleSeconds });
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function clearShippingCache(key) {
  if (key) return stores.delete(key);
  stores.clear();
  return true;
}
