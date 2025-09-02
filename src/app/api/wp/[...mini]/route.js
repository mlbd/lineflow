// src/app/api/wp/[...mini]/route.js
// Server-side proxy for WP REST (mini-sites namespace).
// Calls WP with Basic Auth using server env vars (never exposed to browser).

import { NextResponse } from 'next/server';

const WP_URL = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
const WP_USER = process.env.WP_API_USER;
const WP_PASS = process.env.WP_API_PASS;

// Optional: restrict which endpoints can be proxied (defense-in-depth)
const ALLOW = new Set(
  (process.env.MS_WP_PROXY_WHITELIST || 'update-placement,delete-placement')
    .split(',')
    .map(s => s.trim())
);

function isAllowed(endpoint) {
  // Adjust if you need nested paths; right now we allow single-segment names.
  return ALLOW.has(endpoint);
}

// If you also have GET support, mirror the same pattern used in POST below.
export async function POST(req, ctx) {
  // ⬇️ params is async now; await it before reading .mini
  const { mini = [] } = (await ctx.params) || {};
  const parts = Array.isArray(mini) ? mini : [mini];
  const endpoint = parts.join('/'); // e.g., "update-placement,delete-placement"

  if (!isAllowed(endpoint)) {
    return NextResponse.json({ message: 'Endpoint not allowed' }, { status: 403 });
  }
  if (!WP_USER || !WP_PASS) {
    return NextResponse.json({ message: 'WP credentials missing on server' }, { status: 500 });
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {}

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const url = `${WP_URL}/wp-json/mini-sites/v1/${endpoint}`;

  const wpRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await wpRes.text();
  const type = wpRes.headers.get('content-type') || 'application/json';
  return new NextResponse(text, { status: wpRes.status, headers: { 'content-type': type } });
}
