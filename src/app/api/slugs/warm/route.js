// src/app/api/slugs/warm/route.js
import { NextResponse } from 'next/server';
import { getSlugCache } from '@/lib/slugCache';

export const runtime = 'nodejs';

export async function GET(req) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  if (secret !== (process.env.REVALIDATE_SECRET || '')) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const data = await getSlugCache(); // builds if empty, else returns cached
  return NextResponse.json({ ok: true, total: data.total, shards: data.shards_meta.length });
}
