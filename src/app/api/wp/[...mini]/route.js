// src/app/api/wp/[...mini]/route.js
import { NextResponse } from 'next/server';

const WP_URL = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
const WP_USER = process.env.WP_API_USER;
const WP_PASS = process.env.WP_API_PASS;

// ✅ Only allow same-site requests
function isSameOrigin(req) {
  const allowedHost = process.env.NEXT_PUBLIC_SITE_URL || ''; // e.g. https://min.lukpaluk.xyz
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  return (origin && origin.startsWith(allowedHost)) || (referer && referer.startsWith(allowedHost));
}

// --- Auth header builder (supports both Authorization & X-Authorization) ---
function buildAuthHeaders(extra = {}) {
  const headers = { ...extra };

  const hasAuth = !!headers.Authorization || !!headers['X-Authorization'];

  if (!hasAuth && WP_USER && WP_PASS) {
    const token = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

export async function POST(req, ctx) {
  const { mini = [] } = (await ctx.params) || {};
  const parts = Array.isArray(mini) ? mini : [mini];
  const endpoint = parts.join('/');

  // ✅ Block cross-site requests
  if (!isSameOrigin(req)) {
    return NextResponse.json({ message: 'Forbidden: cross-site request' }, { status: 403 });
  }

  if (!WP_URL) {
    return NextResponse.json({ message: 'WP URL missing on server' }, { status: 500 });
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {
    // ignore parse errors, leave payload empty
  }

  const url = `${WP_URL}/wp-json/mini-sites/v1/${endpoint}`;

  console.log(`[proxy] ${url}`);
  console.log(`[proxy] body`, payload);

  const wpRes = await fetch(url, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const text = await wpRes.text();
  const type = wpRes.headers.get('content-type') || 'application/json';
  return new NextResponse(text, { status: wpRes.status, headers: { 'content-type': type } });
}
