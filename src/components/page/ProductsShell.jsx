// components/page/ProductsShell.jsx
import CartPage from '@/components/cart/CartPage';
import ProductSectionWithAction from '@/components/homepage/ProductSectionWithAction';
import { generateProductImageUrl, generateProductImageUrlWithOverlay } from '@/utils/cloudinaryMockup';
import { useEffect, useState } from 'react';

export function ProductsShell({
  slug,
  productIds,
  cacheBust = 0,
  criticalProducts = [],
  bumpPrice,
  companyLogos,
  pagePlacementMap,
  customBackAllowedSet,
  shippingOptions,
  acf,
  companyData,
  cartSectionRef,
}) {
  const [products, setProducts] = useState(criticalProducts);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    (async () => {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        setProducts([]);
        return;
      }
      setErr('');
      setLoading(true);

      try {
        const idsParam = encodeURIComponent(productIds.join(','));
        const v = cacheBust ? `&v=${encodeURIComponent(String(cacheBust))}` : '';
        const url = `/api/minisites/product-cards?ids=${idsParam}&slug=${encodeURIComponent(slug)}${v}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log('ProductsShell fetched:', json);
        const fetched = Array.isArray(json?.products) ? json.products : [];

        const indexById = new Map(productIds.map((id, i) => [String(id), i]));
        const inFlightById = new Map(fetched.map(p => [String(p?.id), p]));
        const ssrById = new Map(criticalProducts.map(p => [String(p?.id), p]));

        const merged = productIds
          .map(id => inFlightById.get(String(id)) || ssrById.get(String(id)))
          .filter(Boolean);

        if (merged.length < productIds.length) {
          const seen = new Set(merged.map(p => String(p.id)));
          fetched.forEach(p => {
            const k = String(p?.id);
            if (!seen.has(k)) merged.push(p);
          });
          merged.sort((a, b) => (indexById.get(String(a.id)) ?? 0) - (indexById.get(String(b.id)) ?? 0));
        }

        setProducts(merged);
      } catch (e) {
        if (!ignore) {
          console.error('ProductsShell fetch error:', e);
          setErr(e?.message || 'Failed to load products');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [productIds, slug, criticalProducts, cacheBust]);

  // Background warm: preload all product images (and a few color variants) in the background.
  // This helps "Load more" and hover-preview to feel instant by warming browser & CDN caches.
  useEffect(() => {
    if (!Array.isArray(products) || products.length === 0) return;

    let cancelled = false;
    const MAX_PRELOAD = Number(process.env.NEXT_PUBLIC_MAX_PRELOAD_IMAGES || 200);
    const COLORS_PER_PRODUCT = Number(process.env.NEXT_PUBLIC_PRELOAD_COLORS_PER_PRODUCT || 3);
    const CONCURRENCY = Number(process.env.NEXT_PUBLIC_PRELOAD_CONCURRENCY || 6);

    // Build list of candidate URLs (high-res)
    const urls = [];
    for (const p of products) {
      try {
        // base thumbnail (no overlay)
        const u = generateProductImageUrl(p, companyLogos, { max: 1400 });
        if (u) urls.push(u);
      } catch (_) {}

      const colors = Array.isArray(p?.acf?.color) ? p.acf.color : [];
      for (let i = 0; i < Math.min(colors.length, COLORS_PER_PRODUCT); i++) {
        try {
          // color-specific thumbnail (no overlay)
          const uc = generateProductImageUrl(p, companyLogos, { max: 1400, colorIndex: i });
          if (uc) urls.push(uc);
        } catch (_) {}
        try {
          // color-specific thumbnail WITH overlay/logo — this is what hover previews use
          const uo = generateProductImageUrlWithOverlay(p, companyLogos, {
            max: 1400,
            colorIndex: i,
            pagePlacementMap,
            customBackAllowedSet,
          });
          if (uo) urls.push(uo);
        } catch (_) {}
      }

      // also add a base overlayed image if placements exist (covers default logo on product)
      try {
        const baseOverlay = generateProductImageUrlWithOverlay(p, companyLogos, {
          max: 1400,
          pagePlacementMap,
          customBackAllowedSet,
        });
        if (baseOverlay) urls.push(baseOverlay);
      } catch (_) {}

      if (urls.length >= MAX_PRELOAD) break;
    }

    // Build a set of URLs the server already asked the browser to preload
    // (rendered as <link rel="preload" as="image" href="..."> in the page Head).
    // If the server already preloaded an image we should skip re-downloading it
    // from the client-side preloader to avoid redundant bandwidth usage.
    const preloadedSet = new Set();
    try {
      if (typeof document !== 'undefined') {
        Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).forEach(l => {
          try {
            if (l && l.href) preloadedSet.add(l.href);
          } catch (e) {}
        });
      }
    } catch (e) {}

  const uniqueAll = Array.from(new Set(urls));
  // remove anything server-preloaded
  const candidate = uniqueAll.filter(u => u && !preloadedSet.has(u));

  // If the deploy enables full preloads, preload all candidate URLs for the
  // current catalog page (covers hover variants and all load-more pages).
  // This is bandwidth-heavy, enable only when you want maximum instant UX.
  const PRELOAD_ALL = process.env.NEXT_PUBLIC_PRELOAD_ALL_IMAGES === '1';
  const unique = PRELOAD_ALL ? candidate : candidate.slice(0, MAX_PRELOAD);

    if (unique.length === 0) return;

    const preloadImage = url =>
      new Promise(resolve => {
        const img = new window.Image();
        let done = false;
        const cleanup = () => {
          if (done) return;
          done = true;
          img.onload = img.onerror = null;
          resolve();
        };
        img.onload = cleanup;
        img.onerror = cleanup;
        img.src = url;
        // safety timeout
        setTimeout(cleanup, 10000);
      });

    (async () => {
      for (let i = 0; i < unique.length && !cancelled; i += CONCURRENCY) {
        const batch = unique.slice(i, i + CONCURRENCY).map(u => preloadImage(u));
        await Promise.allSettled(batch);
        if (cancelled) break;
        // small pause to avoid saturating network
        await new Promise(r => setTimeout(r, 150));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [products, companyLogos]);

  if (!products.length && loading) {
    return (
      <div className="text-center py-12 text-gray-400" role="status" aria-live="polite">
        Loading products…
      </div>
    );
  }

  if (err && !products.length) {
    return (
      <div className="text-center py-12 text-red-600">
        We couldn&apos;t load the products. Please refresh the page.
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto">
        <ProductSectionWithAction
          products={products}
          bumpPrice={bumpPrice}
          onCartAddSuccess={() => {
            if (cartSectionRef?.current) {
              cartSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          companyLogos={companyLogos}
          pagePlacementMap={pagePlacementMap}
          customBackAllowedSet={customBackAllowedSet}
          enableHoverPreview={true}
        />
      </div>

      <div className="w-full" ref={cartSectionRef}>
        <CartPage
          initialProducts={products}
          products={products}
          shippingOptions={shippingOptions}
          shippingLoading={false}
          acf={acf}
          companyData={companyData}
          companyLogos={companyLogos}
          pagePlacementMap={pagePlacementMap}
          customBackAllowedSet={customBackAllowedSet}
          slug={slug}
        />
      </div>
    </>
  );
}

// IMPORTANT: default-export the component too
export default ProductsShell;
