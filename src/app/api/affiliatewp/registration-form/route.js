import { affiliateWpRegistrationPage, fetchAffiliateRegistrationForm } from '@/lib/affiliatewp';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { html, error } = await fetchAffiliateRegistrationForm();
  const status = html ? 200 : 503;

  return new NextResponse(JSON.stringify({ html, error, pageUrl: affiliateWpRegistrationPage }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'access-control-allow-origin': '*',
    },
  });
}
