// src/app/api/ms/revalidate/route.js
import { revalidateTag } from 'next/cache';
export const runtime = 'nodejs';

export async function POST(req) {
  const { tags } = await req.json().catch(() => ({ tags: [] }));
  const list = Array.isArray(tags) && tags.length ? tags : ['ms:products', 'ms:pages'];
  list.forEach(t => revalidateTag(t));
  return new Response(JSON.stringify({ ok: true, revalidated: list }), {
    headers: { 'content-type': 'application/json' },
  });
}
