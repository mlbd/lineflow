import ProductDescription from '@/components/common/ProductDescription';
import ProductOrderRangeLabel from '@/components/common/ProductOrderRangeLabel';
import FilterMenu from '@/components/homepage/FilterMenu';
import AddToCartModal from '@/components/page/AddToCartModal';
import ProductColorBoxes from '@/components/page/ProductColorBoxes';
import ProductPriceLabel from '@/components/page/ProductPriceLabel';
import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import { useEffect, useMemo, useState } from 'react';

import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { generateProductImageUrl } from '@/utils/cloudinaryMockup';
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
function ShimmerImage({ src, alt, priority = false, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const isClickable = typeof onClick === 'function';

  const handleKeyDown = e => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

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
}) {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalProduct, setModalProduct] = useState(null);
  const [cartModalProduct, setCartModalProduct] = useState(null);

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

      const url = generateProductImageUrl(productForThumb, companyLogos, {
        max: 300,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {visibleProducts.map((p, idx) => {
            // 🚩 Overwrite placements if user selected any for this product
            const override = filters?.[String(p.id)] || null;
            const productForThumb = override ? { ...p, placement_coordinates: override } : p;

            // If override exists, DO NOT pass pagePlacementMap (so it doesn't override the override)
            const url = generateProductImageUrl(productForThumb, companyLogos, {
              max: 300,
              ...(override ? {} : { pagePlacementMap }),
              customBackAllowedSet,
            });

            return (
              <>
                <div key={p.id} class="flex-1 inline-flex flex-col justify-start items-end gap-4">
                  <div class="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <ShimmerImage
                      src={url}
                      alt={p.name}
                      priority={idx < PRODUCT_PER_PAGE} // eager-preload only first page items
                      onClick={() => setModalProduct(p)}
                      className="cursor-pointer"
                    />
                  </div>
                  <div class="self-stretch flex flex-col justify-start items-start gap-[30px]">
                    <div class="self-stretch flex flex-col justify-start items-start gap-3">
                      <div
                        class="self-stretch justify-start text-secondary text-2xl font-semibold cursor-pointer"
                        onClick={() => setModalProduct(p)}
                      >
                        {p.name}
                      </div>
                      <div class="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                        <ProductDescription p={p} limitLines={2} moreLabel="Read more" />
                        <div
                          data-icon="false"
                          data-property-1="Without Outline"
                          class="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                        >
                          <div class="justify-start"></div>
                        </div>
                      </div>
                      <ProductColorBoxes acf={p.acf} onBoxClick={({ color, index }) => {
    // your example:
    setModalProduct(p);
    // (optional) you can also read which color/index was clicked via args
  }} />
                    </div>
                    <div class="self-stretch inline-flex justify-between items-center">
                      <ProductPriceLabel product={p} bumpPrice={null} priceMode="min" />
                      <ProductOrderRangeLabel product={p} itemsMode="min" />
                      <button
                        type="button"
                        class="px-6 cursor-pointer py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5 text-white text-base font-semibold leading-snug"
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
