// src/app/api/slugs/index/route.js
import { NextResponse } from 'next/server';
import { getSlugCache } from '@/lib/slugCache';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await getSlugCache(); // { shards_meta, total, ... }
    const payload = {
      ok: true,
      version: data.version,
      total: data.total,
      page_size: data.page_size,
      shards: data.shards_meta,      // [{ key: 'shard-0001', count: N }, ...]
      last_updated: data.last_updated,
    };
    const res = NextResponse.json(payload, { status: 200 });
    // Reader clients can cache this for a bit; it stays fresh via revalidate route
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
