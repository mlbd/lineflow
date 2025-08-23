// lib/menuCache.js
const stores = new Map();
const inflight = new Map();

export function writeMenuCache(key, data, { ttlSeconds = 3600, staleSeconds = 86400 } = {}) {
  stores.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
    staleUntil: Date.now() + (ttlSeconds + staleSeconds) * 1000,
  });
  return data;
}

export async function getOrFetchMenu(
  key,
  fetcher,
  { ttlSeconds = 3600, staleSeconds = 86400 } = {}
) {
  const v = stores.get(key);
  const now = Date.now();

  if (v && now < v.expiresAt) return v.data; // fresh
  if (inflight.has(key)) return inflight.get(key);

  if (v && now < v.staleUntil) {
    const bg = (async () => {
      try {
        const data = await fetcher();
        return writeMenuCache(key, data, { ttlSeconds, staleSeconds });
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, bg);
    return v.data;
  }

  const p = (async () => {
    try {
      const data = await fetcher();
      return writeMenuCache(key, data, { ttlSeconds, staleSeconds });
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function clearMenuCache(key) {
  if (key) return stores.delete(key);
  stores.clear();
  return true;
}
