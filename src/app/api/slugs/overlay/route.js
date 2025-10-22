import { NextResponse } from 'next/server';
import { snapshotDeltas } from '@/lib/slugDeltaStore';

export const runtime = 'nodejs';

/**
 * GET /api/slugs/overlay
 * Returns { version, adds:[], removes:[] }
 * The client merges this with the base shards:
 *   final = base ∪ adds \ removes
 */
export async function GET() {
  const snap = snapshotDeltas();
  const res = NextResponse.json({ ok: true, ...snap }, { status: 200 });
  res.headers.set('Cache-Control', 'public, max-age=15, s-maxage=30'); // small TTL
  return res;
}
