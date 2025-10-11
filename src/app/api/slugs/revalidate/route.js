// src/app/api/slugs/revalidate/route.js
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';

function validateSecret(req) {
  const url = new URL(req.url);
  const qp = url.searchParams.get('secret') || '';
  const hdr = req.headers.get('x-revalidate-secret') || '';
  const expected = process.env.REVALIDATE_SECRET || '';
  if (!expected) {
    return { ok: false, status: 500, body: { ok: false, error: 'REVALIDATE_SECRET not set' } };
  }
  if (qp !== expected && hdr !== expected) {
    return { ok: false, status: 401, body: { ok: false, error: 'unauthorized' } };
  }
  return { ok: true };
}

async function handle(req) {
  const auth = validateSecret(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  revalidateTag('mini-slugs');
  return NextResponse.json({ ok: true, revalidated: true, tag: 'mini-slugs' }, { status: 200 });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
