// src/app/api/ms/pages/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const WP_URL =
  process.env.WP_SITE_URL ||
  process.env.NEXT_PUBLIC_WP_SITE_URL ||
  '';

/**
 * Fetch all WP pages with pagination.
 * Keeps acf + meta intact.
 */
async function fetchAllPagesFromWP() {
  if (!WP_URL) {
    throw new Error('WP site URL is not configured (WP_SITE_URL or NEXT_PUBLIC_WP_SITE_URL)');
  }

  const perPage = 100;
  let page = 1;
  let totalPages = 1;
  const all = [];

  while (page <= totalPages) {
    const url = `${WP_URL.replace(/\/$/, '')}/wp-json/wp/v2/pages?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      // Avoid Next.js fetch caching here—caching is handled by unstable_cache wrapper
      cache: 'no-store',
      // Pass through headers if your WP needs auth; add Authorization here if required
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WP pages fetch failed (page ${page}): ${res.status} ${res.statusText} ${text}`);
    }

    // WP sets total pages in this header
    const tp = res.headers.get('X-WP-TotalPages');
    if (tp) {
      const n = Number(tp);
      if (!Number.isNaN(n) && n > 0) totalPages = n;
    }

    const batch = await res.json();
    if (Array.isArray(batch)) {
      all.push(...batch);
    }

    page += 1;
  }

  return all;
}

/**
 * Taggable cached loader for all pages.
 * Tag: ms:pages
 */
const loadAllPagesCached = unstable_cache(
  async () => {
    const raw = await fetchAllPagesFromWP();

    const pages = raw.map((p) => ({
      id: p?.id,
      title:
        typeof p?.title === 'object'
          ? (p?.title?.rendered ?? '')
          : (p?.title ?? ''),
      slug: p?.slug ?? '',
      // Coerce acf/meta to plain objects when possible
      acf:
        p?.acf && typeof p.acf === 'object' && !Array.isArray(p.acf) ? p.acf : {},
      meta:
        p?.meta && typeof p.meta === 'object' && !Array.isArray(p.meta) ? p.meta : {},
    }));

    return {
      pages,
      pagination: {
        total: pages.length,
        per_page: pages.length,
        current_page: 1,
        total_pages: 1,
      },
      meta: { source: 'wp', fetched_at: Date.now() },
    };
  },
  // Cache key (adjust version if you change shape)
  ['ms:pages:all:v1'],
  // Default TTL + tag so /api/ms/revalidate can purge immediately
  { revalidate: 60 * 60, tags: ['ms:pages'] } // 1 hour
);

/**
 * GET /api/ms/pages
 * Returns cached list of all pages (acf + meta included).
 * Use your /api/ms/revalidate endpoint to purge via revalidateTag('ms:pages').
 */
export async function GET(req) {
  try {
    const data = await loadAllPagesCached();
    // Helpful CDN hints; adjust as you like
    return NextResponse.json(data, {
      status: 200,
      headers: {
        // Cache at the edge for 1h; allow serving stale while revalidating in background
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[ms/pages] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load pages' },
      { status: 500 }
    );
  }
}
