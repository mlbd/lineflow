/* public/sw-catalog-prefetch.js */
// [PATCH] New: Service Worker to pre-cache catalog images and serve cache-first.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const CACHE_NAME = 'catalog-hover-v1';

// Cache a list of urls (deduped). Returns {added, already, errors}
async function cacheUrls(urls = []) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const cache = await caches.open(CACHE_NAME);
  let added = 0, already = 0, errors = 0;

  // Check which ones exist to avoid re-downloading
  const checks = await Promise.all(unique.map(u => cache.match(u, { ignoreVary: true })));
  const toAdd = [];
  unique.forEach((u, i) => {
    if (checks[i]) already++;
    else toAdd.push(u);
  });

  await Promise.allSettled(
    toAdd.map(u => cache.add(u).then(() => { added++; }).catch(() => { errors++; }))
  );

  return { added, already, errors, total: unique.length };
}

self.addEventListener('message', (event) => {
  const data = event?.data || {};
  const label = data.label || 'anon';
  const reply = (payload) => {
    try { event.source?.postMessage({ type: 'CATALOG_PREFETCH_DONE', label, ...payload }); } catch (_) {}
  };

  if (data.type === 'CATALOG_PREFETCH' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const stats = await cacheUrls(data.urls);
      reply({ ok: true, stats });
    })());
    return;
  }

  if (data.type === 'CATALOG_CHECK' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const unique = Array.from(new Set(data.urls.filter(Boolean)));
      let cached = 0;
      const results = await Promise.all(unique.map(u => cache.match(u, { ignoreVary: true })));
      results.forEach(r => { if (r) cached++; });
      reply({ ok: true, cached, total: unique.length });
    })());
    return;
  }
});

// Cache-first for Cloudinary and Next optimizer URLs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isCloudinary =
    /(^|\.)res\.cloudinary\.com$/.test(url.hostname) &&
    url.pathname.includes('/image/upload');

  const isNextOpt =
    url.pathname === '/_next/image' &&
    url.searchParams.get('url')?.includes('res.cloudinary.com') &&
    url.searchParams.get('w') && url.searchParams.get('q');

  if (!isCloudinary && !isNextOpt) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreVary: true });
    if (cached) return cached;

    const resp = await fetch(event.request).catch(() => null);
    if (resp && resp.ok) {
      cache.put(event.request, resp.clone()).catch(() => {});
      return resp;
    }
    // Fallback: try network anyway
    return resp || fetch(event.request);
  })());
});
