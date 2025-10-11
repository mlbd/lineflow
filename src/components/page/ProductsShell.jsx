// components/page/ProductsShell.jsx
import { useEffect, useState } from 'react';
import ProductListSection from '@/components/page/ProductListSection';
import ProductSectionWithAction from '@/components/homepage/ProductSectionWithAction';
import CartPage from '@/components/cart/CartPage';

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

        // [PATCH] Append v=cacheBust so CDN won't reuse older JSON after a revalidate
        const v = cacheBust ? `&v=${encodeURIComponent(String(cacheBust))}` : '';
        const url = `/api/minisites/product-cards?ids=${idsParam}&slug=${encodeURIComponent(slug)}${v}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log('ProductsShell fetched:', json);
        const fetched = Array.isArray(json?.products) ? json.products : [];

        if (!ignore) {
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
            merged.sort(
              (a, b) => (indexById.get(String(a.id)) ?? 0) - (indexById.get(String(b.id)) ?? 0)
            );
          }

          setProducts(merged);
        }
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
