export const runtime = 'nodejs';

export async function GET() {
  return new Response(JSON.stringify({ ok: true, where: 'app/api/ms/health' }), {
    headers: { 'content-type': 'application/json' },
  });
}
