import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { getLogFilePath } from '@/server/limonFileLogger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const srvToken = process.env.LIMON_LOG_TOKEN || '';

  const isDev = process.env.NODE_ENV !== 'production';
  const authorized = srvToken ? token === srvToken : isDev;

  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const filePath = getLogFilePath();
    await fs.writeFile(filePath, ''); // truncate contents
    return NextResponse.json({ ok: true, message: 'Log cleared' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
