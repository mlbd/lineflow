// app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/session';
import { verifyCredentials } from '@/lib/auth';

// Simple in-memory attempts map (use Redis/Upstash in prod for multi-instance)
const attempts = new Map(); // key: ip, value: { count, firstTs }
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 8; // max in window
const JITTER_MS = [180, 420]; // random delay range

function clientIP(req) {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0] || req.headers.get('x-real-ip') || '0.0.0.0').trim();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(req) {
  const ip = clientIP(req);

  // Honeypot
  const body = await req.json().catch(() => ({}));
  if (body.website) {
    await sleep(randInt(...JITTER_MS));
    return NextResponse.json({ ok: true }, { status: 200 }); // pretend OK, but do nothing
  }

  // Rate limit
  const now = Date.now();
  const bucket = attempts.get(ip) || { count: 0, firstTs: now };
  if (now - bucket.firstTs > WINDOW_MS) {
    bucket.count = 0;
    bucket.firstTs = now;
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }

  const { username, password } = body || {};
  const ok = verifyCredentials(username, password);

  // Random delay to reduce timing side-channels
  await sleep(randInt(...JITTER_MS));

  if (!ok) {
    bucket.count += 1;
    attempts.set(ip, bucket);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // success: reset attempts and set session cookie
  attempts.delete(ip);
  const cookie = await createSessionCookie(username, 12);
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.append('Set-Cookie', cookie);
  return res;
}
