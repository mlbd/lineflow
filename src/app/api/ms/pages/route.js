// src/app/api/ms/pages/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

const WP_URL = process.env.WP_SITE_URL || process.env.NEXT_PUBLIC_WP_SITE_URL;

// Simple in-process cache (per server instance)
const CACHE_KEY = '__ms_pages_all_v4__';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getCache() {
  if (!globalThis.__MS_CACHE) globalThis.__MS_CACHE = {};
  return globalThis.__MS_CACHE;
}

async function fetchAllPagesFromWP() {
  let page = 1;
  const perPage = 100;
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

  return collected;
}

export async function GET(req) {
  try {
    if (!WP_URL) {
      throw new Error('WP site URL is not configured');
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === '1';

    const cache = getCache();
    const hit = cache[CACHE_KEY];

    // Serve cached unless forced or expired
    if (!force && hit && Date.now() - hit.ts < TTL_MS) {
      return NextResponse.json(hit.payload, { status: 200 });
    }

    // Pull all pages from WP
    const pagesRaw = await fetchAllPagesFromWP();

    // Map to full shape the UI needs (keep *all* meta and *all* acf)
    const pages = pagesRaw.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      // WP sometimes returns acf as [] – coerce to object
      acf: p && p.acf && typeof p.acf === 'object' && !Array.isArray(p.acf) ? p.acf : {},
      meta: p && p.meta && typeof p.meta === 'object' && !Array.isArray(p.meta) ? p.meta : {},
    }));

    const payload = {
      pages,
      // Compact pagination summary for consumers that expect it
      pagination: {
        total: pages.length,
        per_page: pages.length,
        current_page: 1,
        total_pages: 1,
      },
      // diagnostic info
      meta: { source: 'wp', fetched_at: Date.now() },
    };

    cache[CACHE_KEY] = { ts: Date.now(), payload };
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to load pages' }, { status: 500 });
  }
}
