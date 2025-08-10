import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductPriceLabel from '@/components/page/ProductPriceLabel';
import ProductColorBoxes from '@/components/page/ProductColorBoxes';
import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import AddToCartModal from '@/components/page/AddToCartModal';
import Image from 'next/image';
import { generateProductImageUrl } from '@/utils/cloudinaryMockup';

const PRODUCT_PER_PAGE = 12;

export default function ProductListSection({
  products = [],
  bumpPrice,
  onCartAddSuccess,
  companyLogos = {},
}) {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalProduct, setModalProduct] = useState(null);
  const [cartModalProduct, setCartModalProduct] = useState(null);

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

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  const categoryName = slug => slug;

  console.log('visibleProducts', visibleProducts);

  return (
    <section className="w-full py-10 flex justify-center">
      <div className="max-w-[var(--site-max-width)] w-full px-4">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2 items-center justify-center">
          {[
            { value: 'all', label: 'הצג הכל' },
            ...allCategories.map(cat => ({ value: cat, label: categoryName(cat) })),
          ].map(({ value, label }) => {
            const isActive = selectedCategory === value;
            return (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={`
                  transition px-4 py-2 text-base font-semibold border-b-4 border-transparent text-primary
                  hover:text-skyblue hover:border-b-skyblue
                  ${isActive ? 'text-skyblue border-b-skyblue' : ''}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {visibleProducts.map(p => (
            <div key={p.id} className="bg-bglight rounded-2xl shadow flex flex-col items-center">
              <div
                className="w-full h-[200px] flex items-center cursor-pointer overflow-hidden rounded-t-2xl"
                onClick={() => setModalProduct(p)}
              >
                <div className="relative w-full h-[200px] bg-bglighter mb-3">
                  <Image
                    src={generateProductImageUrl(p, companyLogos)}
                    alt={p.name}
                    fill
                    className="object-contain"
                    loading="lazy"
                    unoptimized
                  />
                </div>
              </div>
              <div className="w-full p-7 flex flex-col justify-center items-center flex-grow">
                <h3
                  className="text-xl w-full text-center font-medium mb-2 text-primary cursor-pointer"
                  onClick={() => setModalProduct(p)}
                >
                  {p.name}
                </h3>
                <ProductColorBoxes acf={p.acf} onBoxClick={() => setModalProduct(p)} />
                <ProductPriceLabel product={p} bumpPrice={bumpPrice} />
                <Button
                  variant="link"
                  className="text-skyblue mt-2 font-medium text-lg cursor-pointer"
                  onClick={() => setModalProduct(p)}
                >
                  לפרטים על המוצר
                </Button>
                <Button
                  onClick={() => {
                    setModalProduct(null);
                    setTimeout(() => setCartModalProduct(p), 120);
                  }}
                  id={`add-to-cart-${p.id}`}
                  className="bg-accent rounded-[11px] mt-5 w-auto text-primary font-bold hover:bg-[#002266] hover:text-white text-[17px] py-[23px] px-[25px] transition cursor-pointer"
                >
                  הוסף להזמנה
                </Button>
              </div>
            </div>
          ))}
          {visibleProducts.length === 0 && (
            <div className="col-span-3 text-center text-gray-400 py-10">
              אין מוצרים בקטגוריה זו.
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <Button size="sm" onClick={handleLoadMore} className="alarnd-btn w-auto py-6 px-8">
              טען עוד
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductQuickViewModal
        open={!!modalProduct}
        onClose={() => setModalProduct(null)}
        product={modalProduct}
        onAddToCart={() => {
          setModalProduct(null);
          setTimeout(() => setCartModalProduct(modalProduct), 120);
        }}
        companyLogos={companyLogos}
        bumpPrice={bumpPrice}
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
      />
    </section>
  );
}
