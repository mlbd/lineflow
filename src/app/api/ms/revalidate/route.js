// src/app/api/ms/revalidate/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(req) {
  const { searchParams } = new URL(req.url);

  // 🔒 Require secret param
  if (searchParams.get('secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tags = body.tags ?? ['ms:products', 'ms:pages'];

  await Promise.all(tags.map(t => revalidateTag(t)));

  return NextResponse.json(
    { ok: true, revalidated: tags },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
