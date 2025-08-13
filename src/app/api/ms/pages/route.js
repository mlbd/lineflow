// src/app/api/ms/pages/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const WP_URL = process.env.WP_SITE_URL || process.env.NEXT_PUBLIC_WP_SITE_URL || '';

async function fetchAllPagesFromWP() {
  if (!WP_URL) throw new Error('WP site URL is not configured');
  const perPage = 100;
  let page = 1;
  let totalPages = 1;
  const all = [];

  while (page <= totalPages) {
    const url = `${WP_URL.replace(/\/$/, '')}/wp-json/wp/v2/pages?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WP pages fetch failed (page ${page}): ${res.status} ${res.statusText} ${text}`);
    }
    const tp = res.headers.get('X-WP-TotalPages');
    if (tp) {
      const n = Number(tp);
      if (!Number.isNaN(n) && n > 0) totalPages = n;
    }
    const batch = await res.json();
    if (Array.isArray(batch)) all.push(...batch);
    page += 1;
  }
  return all;
}

// Cache on the server with a tag; but DO NOT let the edge cache this route response.
const loadAllPagesCached = unstable_cache(
  async () => {
    const raw = await fetchAllPagesFromWP();
    const pages = raw.map((p) => ({
      id: p?.id,
      title: typeof p?.title === 'object' ? (p?.title?.rendered ?? '') : (p?.title ?? ''),
      slug: p?.slug ?? '',
      acf: p?.acf && typeof p.acf === 'object' && !Array.isArray(p.acf) ? p.acf : {},
      meta: p?.meta && typeof p.meta === 'object' && !Array.isArray(p.meta) ? p.meta : {},
    }));

    return {
      pages,
      pagination: { total: pages.length, per_page: pages.length, current_page: 1, total_pages: 1 },
      meta: { source: 'wp', fetched_at: Date.now() },
    };
  },
  ['ms:pages:all:v1'],
  { revalidate: 60 * 60, tags: ['ms:pages'] } // taggable cache on the server
);

export async function GET() {
  try {
    const data = await loadAllPagesCached();
    // Important: prevent edge caching of this API response
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store', // <-- key change
      },
    });
  } catch (err) {
    console.error('[ms/pages] error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load pages' }, { status: 500 });
  }
}
