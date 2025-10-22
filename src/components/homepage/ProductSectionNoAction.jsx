import ProductDescription from '@/components/common/ProductDescription';
import ProductOrderRangeLabel from '@/components/common/ProductOrderRangeLabel';
import FilterMenu from '@/components/homepage/FilterMenu';
import ProductColorBoxes from '@/components/page/ProductColorBoxes';
import ProductPriceLabel from '@/components/page/ProductPriceLabel';
import { useEffect, useMemo, useState } from 'react';

import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { generateProductImageUrl } from '@/utils/cloudinaryMockup';

const PRODUCT_PER_PAGE = 6;

export default function ProductSectionNoAction({ products = [] }) {
  const bumpPrice = 0;
  const companyLogos = {};
  const pagePlacementMap = {};
  const customBackAllowedSet = {};

  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
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
    <section className="w-full py-10 flex justify-center">
      <div className="w-full">
        <FilterMenu
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          allCategories={allCategories}
          categoryName={categoryName}
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
                <div key={p.id} className="flex-1 inline-flex flex-col justify-start items-end gap-4">
                  <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <img
                      className="self-stretch rounded-2xl flex flex-col justify-start items-end gap-2.5"
                      src={url}
                    />
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                    <div className="self-stretch flex flex-col justify-start items-start gap-3">
                      <div className="self-stretch justify-start text-secondary text-2xl font-semibold">
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
                      <ProductColorBoxes acf={p.acf} />
                    </div>
                    <div className="self-stretch inline-flex justify-between items-center">
                      <ProductPriceLabel product={p} bumpPrice={null} priceMode="min" />
                      <ProductOrderRangeLabel product={p} itemsMode="min" />
                      <button
                        type="button"
                        className="px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5 text-white text-base font-semibold leading-snug"
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
    </section>
  );
}
