// app/api/ms/menu/route.js
import { NextResponse } from 'next/server';
import { getOrFetchMenu } from '@/lib/menuCache';
import { wpApiFetch } from '@/lib/wpApi';

export async function GET(req) {
  try {
    const menu = await getOrFetchMenu(
      'main-menu',
      async () => {
        const res = await wpApiFetch('menu?name=main-menu');
        return await res.json();
      },
      {
        ttlSeconds: 21600, // 6h fresh
        staleSeconds: 86400, // 1d stale
      }
    );

    return NextResponse.json({
      ok: true,
      items: Array.isArray(menu) ? menu : menu?.items || [],
    });
  } catch (err) {
    console.error('Menu route error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
