// src/lib/slugCache.js
// Build & cache ALL published WordPress page slugs, sharded in memory.
// Uses Next.js server cache (unstable_cache) + tag-based revalidation.

import 'server-only';
import { unstable_cache as unstableCache } from 'next/cache';

const PAGE_SIZE = 1000; // slugs per shard in the API
const WP_PER_PAGE = 100; // WP REST per_page (max ~100)

async function fetchAllPublishedSlugsFromWP() {
  const base = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('WP_SITE_URL missing');

  const headers = {};
  if (process.env.WP_BASIC_AUTH) headers.Authorization = process.env.WP_BASIC_AUTH;

  // Probe page 1 to see total pages
  const probe = await fetch(
    `${base}/wp-json/wp/v2/pages?status=publish&per_page=${WP_PER_PAGE}&page=1&_fields=slug`,
    { headers, cache: 'no-store' }
  );
  if (!probe.ok) {
    const body = await probe.text().catch(() => '');
    throw new Error(`WP probe ${probe.status}: ${body.slice(0, 200)}`);
  }

  const totalPages = Math.max(1, parseInt(probe.headers.get('X-WP-TotalPages') || '1', 10));
  const all = [];

  const firstItems = await probe.json();
  for (const it of firstItems) if (it?.slug) all.push(it.slug.toLowerCase());

  // Fetch remaining pages in parallel
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(p =>
      fetch(
        `${base}/wp-json/wp/v2/pages?status=publish&per_page=${WP_PER_PAGE}&page=${p}&_fields=slug`,
        { headers, cache: 'no-store' }
      ).then(r => (r.ok ? r.json() : []))
    )
  );

  for (const pageItems of rest) {
    for (const it of pageItems) if (it?.slug) all.push(it.slug.toLowerCase());
  }

  // Unique
  const uniq = Array.from(new Set(all));

  // Shard by fixed size (1,000 per shard)
  const shards = [];
  for (let i = 0; i < uniq.length; i += PAGE_SIZE) {
    shards.push(uniq.slice(i, i + PAGE_SIZE));
  }

  return {
    version: Date.now(),
    total: uniq.length,
    page_size: PAGE_SIZE,
    shards_meta: shards.map((arr, idx) => ({
      key: `shard-${String(idx + 1).padStart(4, '0')}`,
      count: arr.length,
    })),
    shards, // array of arrays (kept in server cache only; not sent in /index)
    last_updated: new Date().toISOString(),
  };
}

// Cached function — tagged so we can invalidate with revalidateTag('mini-slugs')
export const getSlugCache = unstableCache(
  async () => {
    return await fetchAllPublishedSlugsFromWP();
  },
  ['mini-slugs-cache-key'],
  {
    tags: ['mini-slugs'], // used by the /api/slugs/revalidate route
    revalidate: 60 * 60, // background TTL (1 hour) in case you don’t manually revalidate
  }
);
