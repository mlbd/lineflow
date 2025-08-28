/**
 * /app/api/limon-log/route.js
 *
 * App Router API (JavaScript, no TypeScript) to receive log entries
 * and append them to a public file via /src/server/limonFileLogger.js.
 *
 * Security:
 *  - In production, requires LIMON_LOG_TOKEN to match either:
 *      - Header:  x-limon-token
 *      - Query:   ?token=...
 *  - In development (NODE_ENV !== 'production'), token is not required.
 *
 * Returns: { ok: true, file: "/logs/limon-debug.log" } on success.
 */

import { NextResponse } from 'next/server';
import { appendLogLine } from '@/server/limonFileLogger'; // '../../../src/server/limonFileLogger';

export const dynamic = 'force-dynamic'; // ensure no static caching
export const runtime = 'nodejs'; // we need Node APIs (fs) for file writing

function stringifyArgs(arr) {
  return (Array.isArray(arr) ? arr : [arr])
    .map(a => {
      try {
        if (typeof a === 'string') return a;
        return JSON.stringify(a);
      } catch {
        try {
          return String(a);
        } catch {
          return '[unprintable]';
        }
      }
    })
    .join(' ');
}

export async function POST(req) {
  // Authorization
  const headerToken = req.headers.get('x-limon-token');
  let urlToken = null;
  try {
    const u = new URL(req.url);
    urlToken = u.searchParams.get('token');
  } catch {
    // ignore
  }
  const envToken = process.env.LIMON_LOG_TOKEN;
  const isDev = process.env.NODE_ENV !== 'production';
  const authorized = envToken ? headerToken === envToken || urlToken === envToken : isDev;

  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    );
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Bad JSON' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    );
  }

  const ns = String((body && body.ns) || 'unknown');
  const level = String((body && body.level) || 'debug').toUpperCase();
  const ts = String((body && body.ts) || new Date().toISOString());
  const line = `${ts} [${level}] [${ns}] ${stringifyArgs((body && body.args) || [])}\n`;

  try {
    const publicPath = await appendLogLine(line);
    return NextResponse.json(
      { ok: true, file: publicPath },
      { status: 200, headers: { 'cache-control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e && e.message ? e.message : 'Write failed' },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    );
  }
}
