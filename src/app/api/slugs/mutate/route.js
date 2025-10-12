import { NextResponse } from 'next/server';
import { addSlugDelta, removeSlugDelta, snapshotDeltas } from '@/lib/slugDeltaStore';

export const runtime = 'nodejs';

/**
 * POST /api/slugs/mutate?secret=REVALIDATE_SECRET
 * { "action": "add"|"remove", "slug": "new-slug" }
 */
export async function POST(req) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.REVALIDATE_SECRET || '';
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'REVALIDATE_SECRET not set' }, { status: 500 });
  }
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { action, slug } = await req.json().catch(() => ({}));
  const s = (slug || '').toLowerCase().trim();
  const okAction = action === 'add' || action === 'remove';
  const rx = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!okAction || !rx.test(s)) {
    return NextResponse.json({ ok: false, error: 'bad action or slug' }, { status: 400 });
  }

  if (action === 'add') addSlugDelta(s);
  else removeSlugDelta(s);

  return NextResponse.json({ ok: true, ...snapshotDeltas() }, { status: 200 });
}
