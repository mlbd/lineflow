// pages/api/prefetchProducts/[slug].js
// Server-side prefetch (cache warm) for product images (base + overlay) with dynamic colors from product.acf.color.
// Also can prime ISR JSON for /[slug].
// Auth: Same-origin requests DO NOT need a secret. Cross-origin/server-to-server calls must send:
//   Authorization: Bearer <REVALIDATE_SECRET>
//
// Usage:
//   POST /api/prefetchProducts/:slug?scope=critical|rest|all&primeIsr=1|0&verify=0|1
//     scope:
//       - critical → first CRITICAL_COUNT products
//       - rest     → products after CRITICAL_COUNT
//       - all      → all selected products
//     primeIsr: prime Next data JSON (default 1)
//     verify:   re-fetch a small sample and report HIT/AGE headers (default 0)
// Env:
//   NEXT_PUBLIC_CRITICAL_COUNT   → default 12 (how many are "critical")
//   PREFETCH_CONCURRENCY         → default 10 (parallel fetches)
//   PREFETCH_TIMEOUT_MS          → default 120000
//   PREFETCH_LOG                 → default "1" (print terminal logs); set "0" to disable
//   REVALIDATE_SECRET            → required for cross-origin calls
//   NEXT_BUILD_ID                → optional; enables ISR JSON priming

import pLimit from 'p-limit';
import { wpApiFetch } from '@/lib/wpApi';
import { getProductCardsBatch } from '@/lib/productCache';
import {
  generateProductImageUrl,
  generateProductImageUrlWithOverlay,
} from '@/utils/cloudinaryMockup';

const CRITICAL_COUNT = Number(process.env.NEXT_PUBLIC_CRITICAL_COUNT || 6);
const MAX_FETCH_CONCURRENCY = Number(process.env.PREFETCH_CONCURRENCY || 10);
const PREFETCH_TIMEOUT_MS = Number(process.env.PREFETCH_TIMEOUT_MS || 120000);
const PREFETCH_LOG = (process.env.PREFETCH_LOG ?? '1') !== '0';

// ----- proxy-aware same-origin helpers -----
function getEffectiveProto(req) {
  return (
    req.headers['x-forwarded-proto']?.toString().split(',')[0].trim() ||
    (req.socket?.encrypted ? 'https' : 'http')
  );
}
function getEffectiveHost(req) {
  return req.headers['x-forwarded-host']?.toString().split(',')[0].trim() || req.headers.host || '';
}
function isSameOrigin(req) {
  const proto = getEffectiveProto(req);
  const host = getEffectiveHost(req);
  if (!host) return false;
  const expectedOrigin = `${proto}://${host}`;
  const origin = (req.headers.origin || '').toString();
  const referer = (req.headers.referer || '').toString();
  return origin === expectedOrigin || referer.startsWith(`${expectedOrigin}/`);
}

// ----- auth: allow same-origin; else require REVALIDATE_SECRET -----
function assertAuthorized(req) {
  if (isSameOrigin(req)) return true;
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;
  const auth = (req.headers.authorization || '').toString();
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), PREFETCH_TIMEOUT_MS);
  const t0 = process.hrtime.bigint();

  try {
    if (!assertAuthorized(req)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const slug = String(req.query.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });

    const scope = String(req.query.scope || 'all');      // 'critical' | 'rest' | 'all'
    const primeIsr = String(req.query.primeIsr || '1') === '1';
    const wantVerify = String(req.query.verify || '0') === '1';
    // [PATCH] Added: manifest + optimizer flags for returning URL lists
    const wantManifest  = String(req.query.manifest  || '0') === '1';
    const wantOptimizer = String(req.query.optimizer || '0') === '1';
    const optW = Number(req.query.w || 464);
    const optQ = Number(req.query.q || 75);

    // 1) Load company page JSON (same contract as the [slug] page)
    const pageRes = await wpApiFetch(`company-page?slug=${encodeURIComponent(slug)}`);
    if (!pageRes.ok) {
      const body = await pageRes.text().catch(() => '');
      logLine({
        tag: 'prefetch',
        ok: false,
        slug,
        scope,
        error: 'company-page not found',
        status: pageRes.status,
        sample: body.slice(0, 200),
      });
      return res.status(404).json({ ok: false, error: 'company-page not found' });
    }
    const page = await pageRes.json();

    // 2) Normalize product ID buckets
    const allIds = (page?.acf?.selected_products || [])
      .map((p) => (p && typeof p === 'object' ? p.id : p))
      .map((n) => Number(n))
      .filter(Number.isFinite);

    const criticalIds = allIds.slice(0, CRITICAL_COUNT);
    const restIds = allIds.slice(CRITICAL_COUNT);
    const takeIds = scope === 'critical' ? criticalIds : scope === 'rest' ? restIds : allIds;

    // 3) Fetch product cards (cache layer)
    const products = takeIds.length
      ? await getProductCardsBatch(takeIds, {
          ttlSeconds: 60 * 60 * 6,
          staleSeconds: 60 * 60 * 24,
        }).catch(() => [])
      : [];

    // 4) Build Cloudinary URLs to warm (base + overlay + ALL colors)
    const companyLogos = {
      logo_darker: page?.acf?.logo_darker || null,
      logo_lighter: page?.acf?.logo_lighter || null,
      back_darker: page?.acf?.back_darker || null,
      back_lighter: page?.acf?.back_lighter || null,
    };
    const pagePlacementMap = page?.meta?.placement_coordinates || {};
    const customBackAllowedSet = (page?.acf?.custom_logo_products || []).map(String);

    const urls = new Set();
    for (const p of products) {
      // default/base
      try {
        const u = generateProductImageUrl(p, companyLogos, { max: 1400, customBackAllowedSet });
        if (u) urls.add(u);
      } catch {}
      // default/overlay
      try {
        const uo = generateProductImageUrlWithOverlay(p, companyLogos, {
          max: 1400,
          pagePlacementMap,
          customBackAllowedSet,
        });
        if (uo) urls.add(uo);
      } catch {}
      // dynamic colors
      const colors = Array.isArray(p?.acf?.color) ? p.acf.color : [];
      for (let i = 0; i < colors.length; i++) {
        try {
          const uc = generateProductImageUrl(p, companyLogos, {
            max: 1400,
            colorIndex: i,
            customBackAllowedSet,
          });
          if (uc) urls.add(uc);
        } catch {}
        try {
          const uco = generateProductImageUrlWithOverlay(p, companyLogos, {
            max: 1400,
            colorIndex: i,
            pagePlacementMap,
            customBackAllowedSet,
          });
          if (uco) urls.add(uco);
        } catch {}
      }
    }

    // 5) Warm with controlled concurrency
    const limit = pLimit(MAX_FETCH_CONCURRENCY);
    const list = Array.from(urls);

    const warmResults = await Promise.allSettled(
      list.map((u) =>
        limit(async () => {
          const r = await fetch(u, { method: 'GET', cache: 'no-store', signal: controller.signal });
          return {
            url: u,
            status: r.status,
            cf: r.headers.get('cf-cache-status'),
            xcache: r.headers.get('x-cache'),
            age: r.headers.get('age'),
          };
        })
      )
    );

    let attempted = list.length;
    let success = 0;
    let failed = 0;
    for (const r of warmResults) {
      if (r.status === 'fulfilled') success++;
      else failed++;
    }

    // 6) Optionally prime ISR JSON for first visit
    if (primeIsr && process.env.NEXT_BUILD_ID) {
      const jsonUrl = `/_next/data/${process.env.NEXT_BUILD_ID}/${encodeURIComponent(slug)}.json`;
      try {
        await fetch(jsonUrl, { method: 'GET', cache: 'no-store', signal: controller.signal });
      } catch {}
    }

    // 7) Optional verification pass (small sample)
    let verified = 0;
    let hits = 0;
    let verifySample = [];
    if (wantVerify && list.length) {
      const sample = list.slice(0, Math.min(list.length, 8));
      const verifyResults = await Promise.allSettled(
        sample.map((u) =>
          limit(async () => {
            const r = await fetch(u, { method: 'GET', cache: 'no-store', signal: controller.signal });
            const cf = r.headers.get('cf-cache-status') || '';
            const xc = r.headers.get('x-cache') || '';
            const age = Number(r.headers.get('age') || 0);
            const hit = cf.toUpperCase().includes('HIT') || xc.toUpperCase().includes('HIT') || age > 0;
            return { url: u, status: r.status, cf, xcache: xc, age, hit };
          })
        )
      );
      for (const rr of verifyResults) {
        if (rr.status === 'fulfilled') {
          verified++;
          if (rr.value.hit) hits++;
          verifySample.push(rr.value);
        }
      }
    }

    const t1 = process.hrtime.bigint();
    const ms = Math.round(Number(t1 - t0) / 1e6);

    if (PREFETCH_LOG) {
      logLine({
        tag: 'prefetch',
        ok: true,
        slug,
        scope,
        attempted,
        success,
        failed,
        verified,
        hits,
        primeIsr,
        verify: wantVerify,
        ms,
        sample: wantVerify ? verifySample : undefined,
      });
    }

    // [PATCH] Added: optionally include a manifest of warmed URLs
    let optimizerUrls;
    if (wantManifest && wantOptimizer) {
      const origin = `${getEffectiveProto(req)}://${getEffectiveHost(req)}`;
      optimizerUrls = list.map((u) => {
        const nu = new URL(`${origin}/_next/image`);
        nu.searchParams.set('url', u);
        nu.searchParams.set('w', String(optW));
        nu.searchParams.set('q', String(optQ));
        return nu.toString();
      });
    }

    clearTimeout(kill);
    return res.status(200).json({
      ok: true,
      slug,
      scope,
      warmed: attempted,
      success,
      failed,
      verified,
      hits,
      ms,
      // [PATCH] include manifests if requested
      ...(wantManifest ? { urls: list } : {}),
      ...(wantManifest && wantOptimizer ? { optimizerUrls } : {}),
      ...(wantVerify ? { sample: verifySample } : {}),
    });
  } catch (err) {
    clearTimeout(kill);
    const t1 = process.hrtime.bigint();
    const ms = Math.round(Number(t1 - t0) / 1e6);
    if (PREFETCH_LOG) {
      logLine({
        tag: 'prefetch',
        ok: false,
        scope: String(req.query.scope || 'all'),
        slug: String(req.query.slug || ''),
        error: err?.name === 'AbortError' ? 'Timed out' : err?.message || 'Prefetch error',
        ms,
      });
    }
    const msg = err?.name === 'AbortError' ? 'Timed out' : err?.message || 'Prefetch error';
    return res.status(500).json({ ok: false, error: msg });
  }
}

// ----- tiny logger -----
function logLine(obj) {
  try {
    console.log(JSON.stringify(obj));
  } catch {
    // ignore
  }
}
