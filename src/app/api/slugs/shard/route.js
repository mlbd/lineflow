// src/app/api/slugs/shard/route.js
import { NextResponse } from 'next/server';
import { getSlugCache } from '@/lib/slugCache';

export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key'); // expects 'shard-0001'
    if (!key || !/^shard-\d{4}$/.test(key)) {
      return NextResponse.json({ ok: false, error: 'bad key' }, { status: 400 });
    }
    const idx = parseInt(key.slice(6), 10) - 1; // zero-based index
    const data = await getSlugCache();
    const shard = data.shards[idx] || [];
    const text = shard.length ? shard.join('\n') + '\n' : '';

    const res = new NextResponse(text, { status: 200 });
    res.headers.set('Content-Type', 'text/plain; charset=utf-8');
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
