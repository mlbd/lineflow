// src/app/api/ms/products/route.js
export const runtime = 'nodejs';
import { unstable_cache } from 'next/cache';
import { wpApiFetch } from '@/lib/wpApi';

const REVALIDATE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PER_PAGE = 50;

async function fetchProductsPage(page = 1) {
  const res = await wpApiFetch(
    `products?per_page=${PER_PAGE}&page=${page}`,
    { cache: 'no-store' } // always fetch fresh from WP
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Products HTTP ${res.status}`);
  return json;
}

async function loadAllProducts() {
  const first = await fetchProductsPage(1);
  const totalPages = Number(first?.pagination?.total_pages || 1);
  let all = Array.isArray(first?.products) ? first.products : [];
  for (let p = 2; p <= totalPages; p++) {
    const pg = await fetchProductsPage(p);
    all = all.concat(Array.isArray(pg?.products) ? pg.products : []);
  }
  return {
    products: all,
    pagination: { total: all.length, per_page: all.length, current_page: 1, total_pages: 1 },
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const noCache = searchParams.get('noCache') === '1';

  // 🚀 If noCache is set, skip unstable_cache completely
  if (noCache) {
    const data = await loadAllProducts();
    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const cached = unstable_cache(loadAllProducts, ['ms:products:all:v1'], {
    revalidate: REVALIDATE_SECONDS,
    tags: ['ms:products'],
  });
  try {
    const data = await cached();
    return new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': `s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Failed' }), { status: 500 });
  }
}
