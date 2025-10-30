import ProductDescription from '@/components/common/ProductDescription';
import ProductOrderRangeLabel from '@/components/common/ProductOrderRangeLabel';
import FilterMenu from '@/components/homepage/FilterMenu';
import AddToCartModal from '@/components/page/AddToCartModal';
import ProductColorBoxes from '@/components/page/ProductColorBoxes';
import ProductPriceLabel from '@/components/page/ProductPriceLabel';
import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { generateProductImageUrlWithOverlay } from '@/utils/cloudinaryMockup';
import Image from 'next/image';

// [PATCH] Helpers for hover variant prefetch
const NEXT_IMG_W = 464;  // must match your <Image width>
const NEXT_IMG_Q = 75;   // default Next quality
function buildNextImageUrl(src, w = NEXT_IMG_W, q = NEXT_IMG_Q) {
  // Exactly how Next builds optimizer requests
  const u = new URL('/_next/image', window.location.origin);
  u.searchParams.set('url', src);
  u.searchParams.set('w', String(w));
  u.searchParams.set('q', String(q));
  return u.toString();
}

// Simple prefetch via Image objects (browser memory/disk cache) + warms Next optimizer route
async function prefetchUrls(urls) {
  const seen = new Set();
  const tasks = [];
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    tasks.push(new Promise((resolve) => {
      try {
        const img = new Image();
        img.decoding = 'async';
        img.loading = 'eager';
        img.src = u;
        img.onload = img.onerror = () => resolve();
      } catch {
        resolve();
      }
    }));
  }
  // Don't block UI forever
  await Promise.race([Promise.allSettled(tasks), new Promise(r => setTimeout(r, 1200))]);
}


// [PATCH] Added shimmer helpers for blur placeholder
// Place near the imports at the top of the file.
const shimmer = (w, h) => `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <defs>
      <linearGradient id="g">
        <stop stop-color="#f2f2f2" offset="20%" />
        <stop stop-color="#e6e6e6" offset="50%" />
        <stop stop-color="#f2f2f2" offset="70%" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="#f6f7f8" />
    <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
    <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1.4s" repeatCount="indefinite"  />
  </svg>`;
const toBase64 = str =>
  typeof window === 'undefined' ? Buffer.from(str).toString('base64') : window.btoa(str);

// [PATCH] Added ShimmerImage component that uses next/image with Twitch-like shimmer overlay.
// Fixed dimensions prevent layout shift; overlay fades out on complete.
// [PATCH] Updated ShimmerImage to use a ref + decode() + cached-complete check
function ShimmerImage({ src, alt, priority = false, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null); // [PATCH] Added
  const isClickable = typeof onClick === 'function';

  const handleKeyDown = e => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  // [PATCH] Reset + handle cached images that are already complete
  useEffect(() => {
    setLoaded(false);
    const img = imgRef.current;
    if (!img) return;

    // If the browser has already loaded & decoded it (e.g., bfcache/CDN/cache),
    // the onLoad handler may not fire, so short-circuit to loaded.
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div
      className={`relative max-w-[464px] max-h-[310px] overflow-hidden rounded-2xl ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? alt || 'Open image' : undefined}
    >
      <Image
        unoptimized
        ref={imgRef} // [PATCH] Forward ref to the underlying <img>
        src={src}
        alt={alt || ''}
        width={464}
        height={310}
        className="rounded-2xl object-cover max-w-full w-[464px] max-h-[310px] select-none"
        placeholder="blur"
        blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(464, 310))}`}
        loading={priority ? 'eager' : 'lazy'}
        priority={priority}
        // [PATCH] Reliable onLoad:
        // - If decode() is supported, wait for it so we fade only after decoding.
        // - Fallback: mark loaded immediately.
        onLoad={e => {
          const img = e.currentTarget;
          if (typeof img.decode === 'function') {
            img
              .decode()
              .catch(() => {}) // ignore decode errors, still show the image
              .finally(() => setLoaded(true));
          } else {
            setLoaded(true);
          }
        }}
        draggable={false}
      />
      {/* shimmer sweep overlay (unchanged) */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="absolute -inset-x-1 inset-y-0 animate-[shimmer_1.5s_infinite_linear] bg-[linear-gradient(110deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_40%,rgba(255,255,255,0.55)_50%,rgba(0,0,0,0)_60%,rgba(0,0,0,0)_100%)]" />
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

const PRODUCT_PER_PAGE = 6;

export default function ProductSectionWithAction({
  products = [],
  bumpPrice,
  onCartAddSuccess,
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
  enableHoverPreview = false,
}) {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalProduct, setModalProduct] = useState(null);
  const [cartModalProduct, setCartModalProduct] = useState(null);
  const [hoveredColorIndexMap, setHoveredColorIndexMap] = useState({});


  // Simple hover handler — do not prefetch or warm images here.
  const handleBoxHover = (product, colorIndex) => {
    setHoveredColorIndexMap(prev => {
      const copy = { ...(prev || {}) };
      if (colorIndex === null || colorIndex === undefined) {
        delete copy[String(product.id)];
      } else {
        copy[String(product.id)] = Number(colorIndex);
      }
      return copy;
    });
  };

  // 🔁 re-render when any product's override changes
  const filters = useAreaFilterStore(s => s.filters);

  const allCategories = useMemo(() => {
    return Array.from(new Set(products.flatMap(p => p.categories?.map(c => c.slug) || [])));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? products
        : products.filter(p => (p.categories || []).some(cat => cat.slug === selectedCategory));
    return filtered.slice(0, page * PRODUCT_PER_PAGE);
  }, [products, page, selectedCategory]);


  const hasMore = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? products
        : products.filter(p => (p.categories || []).some(cat => cat.slug === selectedCategory));
    return visibleProducts.length < filtered.length;
  }, [visibleProducts, products, selectedCategory]);

  const handleLoadMore = () => setPage(prev => prev + 1);
  const categoryName = slug => slug;

  console.log('visibleProducts', visibleProducts);

  // [PATCH] One-time per-render prefetch for all hover color variants of *visible* products
  useEffect(() => {
    // Respect Data Saver / very slow networks
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return;

    // Build all overlay URLs for each colorIndex per visible product
    const directUrls = new Set();
    for (const p of visibleProducts) {
      const override = useAreaFilterStore.getState()?.filters?.[String(p.id)] || null;
      const productForThumb = override ? { ...p, placement_coordinates: override } : p;
      const colors = Array.isArray(p?.acf?.color) ? p.acf.color : [];
      // include the default (no color index) too, in case hover returns to base
      try {
        const base = generateProductImageUrlWithOverlay(productForThumb, companyLogos, {
          max: 1500,
          ...(override ? {} : { pagePlacementMap }),
          customBackAllowedSet,
        });
        if (base) directUrls.add(base);
      } catch {}
      for (let i = 0; i < colors.length; i++) {
        try {
          const u = generateProductImageUrlWithOverlay(productForThumb, companyLogos, {
            max: 1500,
            colorIndex: i,
            ...(override ? {} : { pagePlacementMap }),
            customBackAllowedSet,
          });
          if (u) directUrls.add(u);
        } catch {}
      }
    }

    // Convert to Next optimizer URLs so the *exact* request used by <Image> is cached
    const nextImgUrls = Array.from(directUrls).map(src => buildNextImageUrl(src, NEXT_IMG_W, NEXT_IMG_Q));

    // Schedule politely (idle if possible), then prefetch
    const runner = () => { prefetchUrls(nextImgUrls); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(runner, { timeout: 800 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    } else {
      const t = setTimeout(runner, 50);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleProducts, companyLogos, pagePlacementMap, customBackAllowedSet]);


  return (
    <section className="w-full flex justify-center bg-white py-10 rounded-3xl px-10 mt-10">
      <div className="w-full">
        <FilterMenu
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          allCategories={allCategories}
          categoryName={categoryName}
          alignment="justify-center"
        />

        {/* Product Grid */}
        <div data-catalog-products className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {visibleProducts.map((p, idx) => {
            // 🚩 Overwrite placements if user selected any for this product
            const override = filters?.[String(p.id)] || null;
            const productForThumb = override ? { ...p, placement_coordinates: override } : p;

            // If override exists, DO NOT pass pagePlacementMap (so it doesn't override the override)
            const hoverIdxForRender = hoveredColorIndexMap?.[String(p.id)];
            // Use high-res images in product sections to avoid blurry thumbnails on larger screens
            // Use overlay generator so the hover-preview URL matches preloaded overlay images
            const url = generateProductImageUrlWithOverlay(productForThumb, companyLogos, {
              max: 1500,
              colorIndex: typeof hoverIdxForRender === 'number' ? hoverIdxForRender : undefined,
              ...(override ? {} : { pagePlacementMap }),
              customBackAllowedSet,
            });

            return (
              <>
                <div
                  key={p.id}
                  className="flex-1 inline-flex flex-col justify-start items-end gap-4"
                >
                  <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <ShimmerImage
                      src={url}
                      alt={p.name}
                      priority={idx < PRODUCT_PER_PAGE} // eager-preload only first page items
                      onClick={() => setModalProduct(p)}
                      className="cursor-pointer"
                      
                    />
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                    <div className="self-stretch flex flex-col justify-start items-start gap-3">
                      <div
                        className="self-stretch justify-start text-secondary text-2xl font-semibold cursor-pointer"
                        onClick={() => setModalProduct(p)}
                      >
                        {p.name}
                      </div>
                      <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                        <ProductDescription p={p} limitLines={2} moreLabel="Read more" />
                        <div
                          data-icon="false"
                          data-property-1="Without Outline"
                          className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                        >
                          <div className="justify-start"></div>
                        </div>
                      </div>
                      <ProductColorBoxes
                        acf={p.acf}
                        onBoxClick={({ color, index }) => {
                          // click behavior: open modal (existing behavior)
                          setModalProduct(p);
                        }}
                        onBoxHover={(clr, index) => {
                          if (!enableHoverPreview) return;
                          // when index is null -> clear
                          handleBoxHover(productForThumb, index);
                        }}
                      />
                    </div>
                    <div className="self-stretch inline-flex justify-between items-center">
                      <ProductPriceLabel product={p} bumpPrice={null} priceMode="min" />
                      <ProductOrderRangeLabel product={p} itemsMode="min" />
                      <button
                        type="button"
                        className="px-6 cursor-pointer py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5 text-white text-base font-semibold leading-snug"
                        onClick={() => setModalProduct(p)}
                      >
                        More Info
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          })}
          {visibleProducts.length === 0 && (
            <div className="col-span-3 text-center text-gray-400 py-10">
              No products in this category.
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center mt-12">
            <button
              type="button"
              onClick={handleLoadMore}
              className="cursor-pointer px-8 py-4 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] text-white text-base font-semibold leading-snug"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductQuickViewModal
        open={!!modalProduct}
        onClose={() => setModalProduct(null)}
        product={modalProduct}
        onAddToCart={nextProduct => {
          setModalProduct(null);
          setTimeout(() => setCartModalProduct(nextProduct || modalProduct), 120);
        }}
        companyLogos={companyLogos}
        bumpPrice={bumpPrice}
        pagePlacementMap={pagePlacementMap}
        customBackAllowedSet={customBackAllowedSet}
      />
      <AddToCartModal
        open={!!cartModalProduct}
        onClose={() => setCartModalProduct(null)}
        product={cartModalProduct}
        bumpPrice={bumpPrice}
        onOpenQuickView={p => {
          setCartModalProduct(null);
          setTimeout(() => setModalProduct(p), 120);
        }}
        onCartAddSuccess={onCartAddSuccess}
        pagePlacementMap={pagePlacementMap}
        customBackAllowedSet={customBackAllowedSet}
      />
    </section>
  );
}
