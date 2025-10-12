import { NextResponse } from 'next/server';
import { getSlugCache } from '@/lib/slugCache';
import { snapshotDeltas } from '@/lib/slugDeltaStore'; // optional overlay; omit if not using

export const runtime = 'nodejs';

// GET /api/slugs/by-prefix?p=ab  (p = 1 or 2 chars; returns newline text)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const p = (searchParams.get('p') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!p || p.length > 2) {
    return NextResponse.json({ ok: false, error: 'bad prefix' }, { status: 400 });
  }

  const data = await getSlugCache(); // { shards: string[][] }
  const all = data.shards || [];

  // Server-side filter from cached base
  const want = [];
  const starts = s => s.startsWith(p);
  for (const arr of all) for (const s of arr) if (starts(s)) want.push(s);

  // Apply overlay (adds/removes) so brand-new slugs appear immediately
  try {
    const ov = snapshotDeltas?.() || { adds: [], removes: [] };
    for (const a of ov.adds) if (starts(a)) want.push(a);
    const rm = new Set(ov.removes);
    // remove any that got deleted
    for (let i = want.length - 1; i >= 0; i--) if (rm.has(want[i])) want.splice(i, 1);
  } catch {}

  const text = want.length ? want.join('\n') + '\n' : '';
  const res = new NextResponse(text, { status: 200 });
  res.headers.set('Content-Type', 'text/plain; charset=utf-8');
  res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  return res;
}
