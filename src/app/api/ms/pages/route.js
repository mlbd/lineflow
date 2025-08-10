// src/app/api/ms/pages/route.js
import { NextResponse } from 'next/server';

const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

// Server cache (per process)
const CACHE_KEY = '__ms_pages_all_v3__';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getCache() {
  if (!globalThis.__MS_CACHE) globalThis.__MS_CACHE = {};
  return globalThis.__MS_CACHE;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === '1';
    const cache = getCache();

    // Serve from cache unless forced or expired
    const hit = cache[CACHE_KEY];
    if (!force && hit && Date.now() - hit.ts < TTL_MS) {
      return NextResponse.json(hit.payload, { status: 200 });
    }

    // Fetch ALL pages from the WP custom endpoint (handle pagination)
    let page = 1;
    const perPage = 100; // ask for big chunks to reduce loops
    let totalPages = 1;
    const collected = [];

    do {
      const url = `${WP_URL}/wp-json/mini-sites/v1/pages?per_page=${perPage}&page=${page}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || `WP pages fetch failed (HTTP ${res.status})`);
      }

      const pages = Array.isArray(json?.pages) ? json.pages : [];
      collected.push(...pages);

      totalPages = Number(json?.pagination?.total_pages || 1);
      page += 1;
    } while (page <= totalPages);

    // Filter pages with usable Cloudinary darker logo
    const filtered = collected.filter(p => {
      const url = p?.acf?.logo_darker?.url;
      return typeof url === 'string' && url && /cloudinary\.com/i.test(url);
    });

    // Keep a compact payload the UI needs
    const payload = {
      pages: filtered.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        // pass only the logo fields we care about (and selected_products if you want later)
        acf: {
          logo_darker: p?.acf?.logo_darker || null,
          logo_lighter: p?.acf?.logo_lighter || null,
          back_lighter: p?.acf?.back_lighter || null,
          back_darker: p?.acf?.back_darker || null,
          selected_products: p?.acf?.selected_products || [],
        },
      })),
      meta: { source: 'wp', fetched_at: Date.now() },
    };

    // Save to server cache
    cache[CACHE_KEY] = { ts: Date.now(), payload };

    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to load pages' }, { status: 500 });
  }
}
