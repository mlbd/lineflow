// lib/shippingCache.js
// Runtime-safe, read-only friendly cache (works on Vercel). No filesystem writes.

let _cache = {
  data: null,
  expiresAt: 0,
};

export function readShippingCache() {
  if (_cache.data && Date.now() < _cache.expiresAt) {
    return _cache.data;
  }
  return null;
}

/**
 * @param {any} data
 * @param {number} ttlSeconds Default 3600 (1 hour)
 */
export function writeShippingCache(data, ttlSeconds = 3600) {
  _cache = {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
}

/**
 * Helper: fetch-and-cache with TTL
 * @param {() => Promise<any>} fetcher
 * @param {number} ttlSeconds
 */
export async function getOrFetchShipping(fetcher, ttlSeconds = 3600) {
  const existing = readShippingCache();
  if (existing) return existing;

  const data = await fetcher();
  writeShippingCache(data, ttlSeconds);
  return data;
}

/** Force clear (e.g., from an API route) */
export function clearShippingCache() {
  _cache = { data: null, expiresAt: 0 };
}
