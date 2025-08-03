import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductPriceLabel from '@/components/page/ProductPriceLabel';
import ProductColorBoxes from '@/components/page/ProductColorBoxes';
import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import AddToCartModal from '@/components/page/AddToCartModal';
import Image from 'next/image'; // <-- import Image!

const PRODUCT_PER_PAGE = 12;

export default function ProductListSection({ wpUrl, pageId, bumpPrice, onCartAddSuccess }) {
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal state
  const [cartModalProduct, setCartModalProduct] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // Fetch first page of products on mount
  useEffect(() => {
    async function fetchInitialProducts() {
      setLoading(true);
      try {
        const url = `${wpUrl}/wp-json/mini-sites/v1/get-products?page_id=${pageId}&filter=all&page=1&per_page=${PRODUCT_PER_PAGE}`;
        const res = await fetch(url);
        const data = await res.json();
        setAllProducts(data.products || []);
        setTotalPages(data.pagination?.total_pages || 1);

        // Extract unique category slugs from loaded products
        const catList = Array.from(
          new Set(
            (data.products || []).flatMap(p => p.categories?.map(c => c.slug) || []).filter(Boolean)
          )
        );
        setCategories(catList);
      } catch (err) {
        // Optionally show error UI
      } finally {
        setLoading(false);
      }
    }
    fetchInitialProducts();
    // eslint-disable-next-line
  }, [wpUrl, pageId]);

  // Load more handler
  const handleLoadMore = async () => {
    if (loadingMore || page + 1 > totalPages) return;
    setLoadingMore(true);
    try {
      const url = `${wpUrl}/wp-json/mini-sites/v1/get-products?page_id=${pageId}&filter=all&page=${page + 1}&per_page=${PRODUCT_PER_PAGE}`;
      const res = await fetch(url);
      const data = await res.json();
      const newProducts = data.products || [];
      setAllProducts(prev => [...prev, ...newProducts]);
      setTotalPages(data.pagination?.total_pages || 1);
      setPage(prev => prev + 1);

      // Update categories from any new products loaded
      setCategories(prev =>
        Array.from(
          new Set([...prev, ...newProducts.flatMap(p => p.categories?.map(c => c.slug) || [])])
        )
      );
    } catch (err) {
      // Optionally show error UI
    } finally {
      setLoadingMore(false);
    }
  };

  // Only filter from products already loaded so far
  const filteredProducts =
    selectedCategory === 'all'
      ? allProducts
      : allProducts.filter(p => (p.categories || []).some(cat => cat.slug === selectedCategory));

  // Helper: map category slug to readable name if needed (currently just slug)
  const categoryName = slug => slug;

  // Handlers for modal
  const handleOpenModal = product => {
    setModalProduct(product);
  };

  const handleAddToCartFromCard = product => {
    setModalProduct(null);
    setTimeout(() => setCartModalProduct(product), 120);
  };

  const handleAddToCartFromModal = product => {
    setModalProduct(null);
    setTimeout(() => setCartModalProduct(product), 120);
  };

  const handleOpenQuickViewFromCartModal = product => {
    setCartModalProduct(null);
    setTimeout(() => setModalProduct(product), 120);
  };

  return (
    <section className="w-full py-10 flex justify-center">
      <div className="max-w-[var(--site-max-width)] w-full px-4">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2 items-center justify-center">
          {[
            { value: 'all', label: 'הצג הכל' },
            ...categories.map(cat => ({ value: cat, label: categoryName(cat) })),
          ].map(({ value, label }) => {
            const isActive = selectedCategory === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedCategory(value)}
                className={
                  `
                  transition
                  px-4 py-2
                  text-base font-semibold
                  border-b-4
                  border-transparent
                  text-primary
                  hover:text-skyblue
                  active:text-skyblue
                  focus:text-skyblue
                  hover:border-b-skyblue
                  active:border-b-skyblue
                  focus:border-b-skyblue
                  ` + (isActive ? ' text-skyblue border-b-skyblue' : '')
                }
                style={{
                  background: 'none',
                  outline: 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredProducts.map(p => (
            <div key={p.id} className="bg-bglight rounded-2xl shadow flex flex-col items-center">
              <div
                className="w-full h-[200px] flex items-center cursor-pointer overflow-hidden rounded-t-2xl"
                onClick={() => handleOpenModal(p)}
              >
                <div className="relative w-full h-[200px] bg-bglighter mb-3">
                <Image
                    src={p.thumbnail}
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
                  onClick={() => handleOpenModal(p)}
                >
                  {p.name}
                </h3>
                <ProductColorBoxes acf={p.acf} onBoxClick={() => handleOpenModal(p)} />
                <ProductPriceLabel product={p} />
                <Button
                  variant="link"
                  className="text-skyblue mt-2 font-medium text-lg cursor-pointer"
                  onClick={() => handleOpenModal(p)}
                >
                  לפרטים על המוצר
                </Button>
                <Button
                  onClick={() => handleAddToCartFromCard(p)}
                  className="bg-accent rounded-[11px] mt-5 w-auto text-primary font-bold hover:bg-[#002266] hover:text-white text-[17px] py-[23px] px-[25px] transition cursor-pointer"
                >
                  הוסף להזמנה
                </Button>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && !loading && (
            <div className="col-span-3 text-center text-gray-400 py-10">
              אין מוצרים בקטגוריה זו.
            </div>
          )}
        </div>
        {/* Load More Button */}
        {page < totalPages && (
          <div className="flex justify-center mt-8">
            {loadingMore ? (
              <Button size="sm" disabled className="flex items-center gap-2">
                <Loader2 className="animate-spin w-4 h-4" />
                טוען...
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleLoadMore}
                className="bg-deepblue text-white font-semibold shadow hover:bg-[#002266] transition"
              >
                טען עוד
              </Button>
            )}
          </div>
        )}
        {loading && (
          <div className="flex justify-center py-8 text-deepblue text-lg">טוען מוצרים...</div>
        )}
      </div>
      {/* Modal: Product Quick View */}
      <ProductQuickViewModal
        open={!!modalProduct}
        onClose={() => setModalProduct(null)}
        product={modalProduct}
        onAddToCart={() => handleAddToCartFromModal(modalProduct)}
        bumpPrice={bumpPrice}
      />
      <AddToCartModal
        open={!!cartModalProduct}
        onClose={() => setCartModalProduct(null)}
        product={cartModalProduct}
        bumpPrice={bumpPrice}
        onOpenQuickView={handleOpenQuickViewFromCartModal}
        onCartAddSuccess={onCartAddSuccess}
      />
    </section>
  );
}
