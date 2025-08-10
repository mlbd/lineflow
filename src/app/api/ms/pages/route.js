export const runtime = 'nodejs';
import { unstable_cache } from 'next/cache';

const REVALIDATE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PER_PAGE = 50;
const WP_URL = process.env.WP_SITE_URL || process.env.NEXT_PUBLIC_WP_SITE_URL;

const isCloudinary = (u = '') => /cloudinary\.com/i.test(u || '');
function getPublicIdFromCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const vIdx = parts.findIndex(p => /^v\d+$/i.test(p));
    const after = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;
    return (after[after.length - 1] || '').replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return '';
  }
}

async function fetchPagesPage(page = 1) {
  const res = await fetch(
    `${WP_URL}/wp-json/mini-sites/v1/pages?per_page=${PER_PAGE}&page=${page}`,
    { next: { revalidate: REVALIDATE_SECONDS } }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Pages HTTP ${res.status}`);
  return json;
}

async function loadAllFilteredPages() {
  const first = await fetchPagesPage(1);
  const totalPages = Number(first?.pagination?.total_pages || 1);
  let raw = Array.isArray(first?.pages) ? first.pages : [];
  for (let p = 2; p <= totalPages; p++) {
    const pg = await fetchPagesPage(p);
    raw = raw.concat(Array.isArray(pg?.pages) ? pg.pages : []);
  }
  const filtered = raw
    .filter(p => p?.logo_darker?.url && isCloudinary(p.logo_darker.url))
    .map(p => ({
      id: p.id,
      title: p.title,
      darkerUrl: p.logo_darker.url,
      darkerId: getPublicIdFromCloudinaryUrl(p.logo_darker.url),
    }));

  return {
    pages: filtered,
    pagination: {
      total: filtered.length,
      per_page: filtered.length,
      current_page: 1,
      total_pages: 1,
    },
  };
}

export async function GET() {
  const cached = unstable_cache(loadAllFilteredPages, ['ms:pages:all:v1'], {
    revalidate: REVALIDATE_SECONDS,
    tags: ['ms:pages'],
  });
  try {
    const data = await cached();
    return new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': `s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Failed' }), { status: 500 });
  }
}
