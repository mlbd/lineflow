// src/app/api/catalog/update/route.js
import { NextResponse } from 'next/server';
import { addSlugDelta, removeSlugDelta } from '@/lib/slugDeltaStore';

export const runtime = 'nodejs';

function buildWpConfig() {
  const base = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('WP_SITE_URL missing');

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.WP_X_AUTHORIZATION) {
    headers['X-Authorization'] = process.env.WP_X_AUTHORIZATION;
  }
  if (process.env.WP_API_USER && process.env.WP_API_PASS) {
    const token = Buffer.from(`${process.env.WP_API_USER}:${process.env.WP_API_PASS}`).toString(
      'base64'
    );
    headers['Authorization'] = `Basic ${token}`;
  }
  return { base, headers };
}

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(req) {
  try {
    const payload = await req.json().catch(() => ({}));
    const mini_url = String(payload?.mini_url || '')
      .toLowerCase()
      .trim();

    if (!SLUG_RX.test(mini_url)) {
      return NextResponse.json(
        { success: false, errors: { mini_url: 'Invalid slug.' } },
        { status: 200 }
      );
    }

    const { base, headers } = buildWpConfig();

    // Forward to WP authoritative endpoint
    const wpRes = await fetch(`${base}/wp-json/mini-sites/v1/update-catalog`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const json = await wpRes.json().catch(() => null);

    // WP returns 200 with { success: false } for validation errors
    if (!wpRes.ok || !json || json.success !== true) {
      // Bubble up WP errors to the client
      return NextResponse.json(json || { success: false, message: `WP error ${wpRes.status}` }, {
        status: 200,
      });
    }

    // Authoritative write succeeded — mutate overlay for instant UX
    addSlugDelta(mini_url); // mark as taken immediately

    // (Optional) also fire-and-forget a full revalidate after success
    // const secret = process.env.REVALIDATE_SECRET || '';
    // if (secret) fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/slugs/revalidate?secret=${encodeURIComponent(secret)}`).catch(()=>{});

    return NextResponse.json(json, { status: 200 });
  } catch (e) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 200 });
  }
}
