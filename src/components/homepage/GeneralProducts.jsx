// components/page/ProductsShell.jsx
import ProductSectionNoAction from '@/components/homepage/ProductSectionNoAction';
import { useEffect, useState } from 'react';

function GeneralProducts({ productIds, criticalProducts = [], cacheBust = 0 }) {
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
        const url = `/api/minisites/product-cards?ids=${idsParam}${v}`;
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
  }, [productIds, criticalProducts, cacheBust]);

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

  console.log('ProductsShell products:', products);

  return (
    <>
      <div className="w-full pt-[80px]">
        <div className="container mx-auto">
          <div>
            <h2 className="text-secondary typo-h2 font-bold">
              Our <span className="text-tertiary">Sample</span> Products
            </h2>
          </div>
          <ProductSectionNoAction products={products} />
        </div>
      </div>
    </>
  );
}

// IMPORTANT: default-export the component too
export default GeneralProducts;
