// pages/api/minisites/product-cards.js
import { getProductCardsBatch } from '@/lib/productCache';

/**
 * GET /api/minisites/product-cards?ids=1,2,3&slug=company-slug
 * - Returns compact product cards for a given list of IDs.
 * - Server-cached (s-maxage) with long SWR for speed on Vercel.
 * - Keeps all business logic server-side (ACF merges, pricing, etc.) via getProductCardsBatch.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const idsParam = String(req.query.ids || '').trim();
    if (!idsParam) {
      // No IDs provided = nothing to return
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.status(200).json({ products: [] });
    }

    // Parse IDs, cap to a reasonable number to avoid abuse
    const MAX_IDS = 200;
    const ids = idsParam
      .split(',')
      .map(x => Number(x))
      .filter(n => Number.isFinite(n))
      .slice(0, MAX_IDS);

    if (!ids.length) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.status(200).json({ products: [] });
    }

    // Optional: company slug context (if your helper can use it)
    const slug = String(req.query.slug || '').trim() || undefined;

    const products = await getProductCardsBatch(ids, {
      ttlSeconds: 60 * 60 * 6, // 6h fresh in your own cache layer (if implemented)
      staleSeconds: 60 * 60 * 24, // serve stale up to 24h while revalidating
      slug, // pass-through, safe if unused
    });

    // Edge/server cache headers (fast for most users; function won't run each time)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');

    // Optional weak ETag to allow 304s between CDN <-> browser if payload unchanged
    try {
      const crypto = await import('node:crypto');
      const bodyStr = JSON.stringify({ products });
      const etag = `W/"${crypto.createHash('sha1').update(bodyStr).digest('hex')}"`;
      res.setHeader('ETag', etag);

      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();
      }

      return res.status(200).json({ products });
    } catch {
      // If crypto is not available for some reason, just return normally
      return res.status(200).json({ products });
    }
  } catch (e) {
    console.error('/api/minisites/product-cards error:', e);
    return res.status(500).json({ error: 'Failed to load product cards' });
  }
}
