// src/pages/api/minisites/product-cards.js
// Returns product card data for a list of product IDs.
// Caching strategy:
//  - Default: CDN cache 5 minutes (s-maxage=300) + stale-while-revalidate 1 day.
//  - If `fresh=1` AND a valid secret is provided: bypass CDN & in-memory cache,
//    force-refresh from WP, and respond with `Cache-Control: private, no-store`.
//
// Security:
//  - `fresh=1` requires either ?secret=<REVALIDATE_SECRET> or header x-ms-cache-secret: <REVALIDATE_SECRET>
//  - Disallows non-GET methods.

import { getProductCardsBatch, forceRefreshProducts } from '@/lib/productCache';

const SIX_HOURS = 60 * 60 * 6;
const ONE_DAY = 60 * 60 * 24;
const MAX_IDS = 250; // hard safety cap

function parseIds(idsParam) {
  return String(idsParam || '')
    .split(',')
    .map(s => Number(s))
    .filter(n => Number.isFinite(n) && n > 0);
}

export default async function handler(req, res) {
  try {
    // Method guard
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(204).end();
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Input
    const idsParam = req.query.ids;
    if (!idsParam) return res.status(400).json({ error: 'Missing required query param: ids' });

    const allIds = parseIds(idsParam);
    if (!allIds.length) return res.status(400).json({ error: 'No valid product IDs provided' });

    const ids = allIds.slice(0, MAX_IDS); // guard
    const slug = (req.query.slug ? String(req.query.slug) : '').trim() || undefined;

    // Fresh/secret handling
    const wantFresh = String(req.query.fresh || '') === '1';
    const providedSecret = req.headers['x-ms-cache-secret'] || req.query.secret;
    const secretOk = !!providedSecret && providedSecret === process.env.REVALIDATE_SECRET;

    // Disable caching at the function level only when doing a privileged fresh fetch.
    // Otherwise, default to fast CDN caching for public requests.
    let products;
    if (wantFresh && secretOk) {
      // Force-refresh from WP and bypass in-memory cache/CDN for this response
      products = await forceRefreshProducts(ids, {
        ttlSeconds: SIX_HOURS,
        staleSeconds: ONE_DAY,
        slug,
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('x-cache-mode', 'fresh');
    } else {
      // Use in-memory cache, allow CDN to cache
      products = await getProductCardsBatch(ids, {
        ttlSeconds: SIX_HOURS,
        staleSeconds: ONE_DAY,
        slug,
      });

      // If no explicit cache header already set (it won't be in this branch), set CDN caching
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
      res.setHeader('x-cache-mode', 'cached');
    }

    // Optional diagnostics
    res.setHeader('x-products-count', String(products?.length || 0));
    if (slug) res.setHeader('x-company-slug', String(slug));

    return res.status(200).json({ products });
  } catch (e) {
    console.error('/api/minisites/product-cards error:', e);
    return res.status(500).json({ error: 'Failed to load product cards' });
  }
}
