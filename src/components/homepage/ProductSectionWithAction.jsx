import ProductDescription from '@/components/common/ProductDescription';
import ProductOrderRangeLabel from '@/components/common/ProductOrderRangeLabel';
import FilterMenu from '@/components/homepage/FilterMenu';
import AddToCartModal from '@/components/page/AddToCartModal';
import ProductColorBoxes from '@/components/page/ProductColorBoxes';
import ProductPriceLabel from '@/components/page/ProductPriceLabel';
import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import { useEffect, useMemo, useState, useRef } from 'react';

import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { generateProductImageUrl, generateProductImageUrlWithOverlay } from '@/utils/cloudinaryMockup';
import Image from 'next/image';

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
function ShimmerImage({ src, alt, priority = false, onClick, hoverPreviewActive = false }) {
  const [loaded, setLoaded] = useState(true);
  const isClickable = typeof onClick === 'function';

  const handleKeyDown = e => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  // Reset shimmer when src changes only if this is a hover-preview change
  useEffect(() => {
    try {
      if (hoverPreviewActive) {
        // show shimmer until image reports loaded
        setLoaded(false);
      } else {
        // suppress shimmer for non-hover renders (keep image visible)
        setLoaded(true);
      }
    } catch (_) {}
  }, [src, hoverPreviewActive]);

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
        src={src}
        alt={alt || ''}
        width={464}
        height={310}
        className="rounded-2xl object-cover max-w-full w-[464px] max-h-[310px] select-none"
        placeholder="blur"
        blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(464, 310))}`}
        loading={priority ? 'eager' : 'lazy'}
        priority={priority}
        // When unoptimized is true Next won't proxy the image through the internal
        // image optimizer (/ _next/image). This ensures the browser requests the
        // original Cloudinary URL directly — matching our client-side preloads —
        // which eliminates the extra optimizer-roundtrip that was causing hover
        // preview delays.
        unoptimized={true}
        onLoadingComplete={() => setLoaded(true)}
        draggable={false}
      />
      {/* shimmer sweep overlay (like twitch) */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          loaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="absolute -inset-x-1 inset-y-0 animate-[shimmer_1.5s_infinite_linear] bg-[linear-gradient(110deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_40%,rgba(255,255,255,0.55)_50%,rgba(0,0,0,0)_60%,rgba(0,0,0,0)_100%)]" />
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
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
  // enable hover-to-preview in catalogs only (opt-in)
  enableHoverPreview = false,
}) {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalProduct, setModalProduct] = useState(null);
  const [cartModalProduct, setCartModalProduct] = useState(null);
  const [hoveredColorIndexMap, setHoveredColorIndexMap] = useState({});

  // Keep per-product pending preload controllers so we can cancel or dedupe
  const preloadControllersRef = useRef({});

  // product is the full product object so we can generate the exact overlay URL and warm it
  // We wait briefly (race) for the prefetch to complete before setting hovered state so the
  // displayed <Image> can reuse the browser cache and avoid an extra network roundtrip.
  const handleBoxHover = (product, colorIndex) => {
    try {
      const pid = String(product.id);

      // cancel any previous pending preload for this product
      const previous = preloadControllersRef.current[pid];
      if (previous) {
        try {
          previous.img.onload = null;
          previous.img.onerror = null;
        } catch (__) {}
        clearTimeout(previous.timeout);
        delete preloadControllersRef.current[pid];
      }

      // if hovering a color (not clearing)
      if (colorIndex !== null && colorIndex !== undefined) {
        const override = filters?.[String(product.id)] || null;
        const productForThumb = override ? { ...product, placement_coordinates: override } : product;

        // generate the exact overlay URL (includes company logos and colorIndex)
        const preloadUrl = generateProductImageUrlWithOverlay(productForThumb, companyLogos, {
          max: 1500,
          colorIndex: Number(colorIndex),
          ...(override ? {} : { pagePlacementMap }),
          customBackAllowedSet,
        });

        try {
          const img = new window.Image();
          let settled = false;

          const finish = () => {
            if (settled) return;
            settled = true;
            // set hovered index so UI swaps to preloaded url
            setHoveredColorIndexMap(prev => {
              const copy = { ...(prev || {}) };
              copy[pid] = Number(colorIndex);
              return copy;
            });
            // cleanup controller
            try {
              img.onload = null;
              img.onerror = null;
            } catch (__) {}
            const c = preloadControllersRef.current[pid];
            if (c) {
              clearTimeout(c.timeout);
              delete preloadControllersRef.current[pid];
            }
          };

          img.onload = finish;
          img.onerror = finish;
          img.src = preloadUrl;

          // fallback: don't wait more than 180ms to avoid blocking UI
          const timeout = setTimeout(finish, 180);

          // store controller so we can cancel if another hover happens
          preloadControllersRef.current[pid] = { img, timeout };
        } catch (err) {
          // warming failed; immediately set hovered state to avoid blocking UI
          setHoveredColorIndexMap(prev => {
            const copy = { ...(prev || {}) };
            copy[pid] = Number(colorIndex);
            return copy;
          });
        }
      } else {
        // clear hover
        setHoveredColorIndexMap(prev => {
          const copy = { ...(prev || {}) };
          delete copy[String(product.id)];
          return copy;
        });
      }
    } catch (e) {
      // fail silently; fallback to immediate set
      setHoveredColorIndexMap(prev => {
        const copy = { ...(prev || {}) };
        if (colorIndex === null || colorIndex === undefined) {
          delete copy[String(product.id)];
        } else {
          copy[String(product.id)] = Number(colorIndex);
        }
        return copy;
      });
    }
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

  useEffect(() => {
    // Preload only first PRODUCT_PER_PAGE thumbnails
      visibleProducts.forEach(p => {
      const override = filters?.[String(p.id)] || null;
      const productForThumb = override ? { ...p, placement_coordinates: override } : p;

      // request a higher-resolution thumbnail for product sections so images appear crisp
      // Preload the default thumbnail (no hover color). Hover-specific variants are warmed on hover.
      const url = generateProductImageUrlWithOverlay(productForThumb, companyLogos, {
        max: 1500,
        ...(override ? {} : { pagePlacementMap }),
        customBackAllowedSet,
      });

      // 👇 Use native browser Image, not `next/image`
      const img = new window.Image();
      img.src = url;
    });
  }, [visibleProducts, filters, companyLogos, pagePlacementMap, customBackAllowedSet]);

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
                      hoverPreviewActive={
                        enableHoverPreview &&
                        typeof hoveredColorIndexMap?.[String(p.id)] === 'number'
                      }
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
