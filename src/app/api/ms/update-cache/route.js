// src/app/api/ms/update-cache/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

const WP_URL = process.env.WP_SITE_URL || process.env.NEXT_PUBLIC_WP_SITE_URL;

async function fetchProduct(id) {
  const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/products?id=${id}`, {
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Product HTTP ${res.status}`);
  // Expecting { products: [ ... ] }
  const prod = Array.isArray(json?.products)
    ? json.products.find(p => Number(p.id) === Number(id))
    : null;
  if (!prod) throw new Error(`Product #${id} not found`);
  return prod;
}

async function fetchPage(id) {
  const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/pages?id=${id}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Page HTTP ${res.status}`);
  // Expecting { pages: [ ... ] }
  const pg = Array.isArray(json?.pages) ? json.pages.find(p => Number(p.id) === Number(id)) : null;
  if (!pg) throw new Error(`Page #${id} not found`);
  return pg;
}

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = Number(searchParams.get('id'));

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing type or id' }, { status: 400 });
    }

    let item;
    if (type === 'product') {
      item = await fetchProduct(id);
    } else if (type === 'page') {
      item = await fetchPage(id);
    } else {
      return NextResponse.json(
        { error: 'Invalid type (use "product" or "page")' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, type, id, item }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
