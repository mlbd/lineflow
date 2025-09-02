// src/app/api/ms/update-cache/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { wpApiFetch } from '@/lib/wpApi';

async function fetchProduct(id) {
  const res = await wpApiFetch(`products?id=${id}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Product HTTP ${res.status}`);
  return Array.isArray(json?.products)
    ? json.products.find(p => Number(p.id) === Number(id))
    : null;
}

async function fetchPage(id) {
  const res = await wpApiFetch(`pages?id=${id}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Page HTTP ${res.status}`);
  return Array.isArray(json?.pages) ? json.pages.find(pg => Number(pg.id) === Number(id)) : null;
}

export async function POST(req) {
  const { searchParams } = new URL(req.url);

  // 🔒 Require secret param
  if (searchParams.get('secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    if (!item) {
      return NextResponse.json({ error: `${type} #${id} not found` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, type, id, item });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
