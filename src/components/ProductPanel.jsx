'use client';

import { useEffect, useState } from 'react';

const CACHE_KEY = 'mini_site_products_cache';
const getTodayString = () => new Date().toISOString().split('T')[0];

export default function ProductPanel({ open, onClose, onSelect, wpUrl }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ page: 1, totalPages: 1, totalTried: 0, totalFound: 0 });

  // Helper for filtering/normalizing product list
  const processProducts = (list) =>
    list
      .filter(prod => {
        const thumb = prod.thumbnail || prod.thumbnail_meta?.url;
        return thumb && thumb.includes('cloudinary.com');
      })
      .map(prod => {
        let images = [];
        if (prod.acf?.group_type === 'Group' && Array.isArray(prod.acf.color)) {
          images = [
            ...(prod.thumbnail && prod.thumbnail.includes('cloudinary.com')
              ? [{
                url: prod.thumbnail,
                width: prod.thumbnail_meta?.width,
                height: prod.thumbnail_meta?.height,
              }]
              : []),
            ...prod.acf.color
              .filter(col => col.thumbnail?.url && col.thumbnail.url.includes('cloudinary.com'))
              .map(col => ({
                url: col.thumbnail.url,
                width: col.thumbnail.width,
                height: col.thumbnail.height,
                colorTitle: col.title,
                colorHex: col.color_hex_code,
              })),
          ];
        } else if (prod.thumbnail && prod.thumbnail.includes('cloudinary.com')) {
          images = [{
            url: prod.thumbnail,
            width: prod.thumbnail_meta?.width,
            height: prod.thumbnail_meta?.height,
          }];
        }
        return {
          id: prod.id,
          title: prod.name,
          groupType: prod.acf?.group_type,
          images,
        };
      })
      .filter(prod => prod.images.length > 0);

  // Main fetch (with caching)
  const fetchAllPages = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setProducts([]);
    setProgress({ page: 1, totalPages: 1, totalTried: 0, totalFound: 0 });

    // Try cache
    if (!forceRefresh) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        if (
          Array.isArray(cached.products) &&
          cached.date === getTodayString() &&
          cached.products.length > 0
        ) {
          setProducts(cached.products);
          setLoading(false);
          setProgress({
            page: cached.lastPage || 1,
            totalPages: cached.totalPages || 1,
            totalTried: cached.totalTried || 0,
            totalFound: cached.products.length,
          });
          return;
        }
      } catch (e) {}
    }

    // Else: Fetch everything
    let allProducts = [];
    let page = 1;
    let totalPages = 1;

    try {
      while (true) {
        const res = await fetch(
          `${wpUrl}/wp-json/mini-sites/v1/get-products?page_id=1170&filter=all&page=${page}&per_page=50`
        );
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();

        let productsArr = [];
        let pagination = {};
        if (Array.isArray(data)) {
          productsArr = data;
        } else if (Array.isArray(data.products)) {
          productsArr = data.products;
          pagination = data.pagination || {};
        } else {
          throw new Error(
            (data && (data.message || data.error)) || 'Unexpected API response'
          );
        }

        totalPages = pagination.total_pages || totalPages;
        setProgress(p => ({
          ...p,
          page,
          totalPages,
          totalTried: ((p.totalTried || 0) + productsArr.length),
          totalFound: ((allProducts.length) + 0),
        }));

        const filtered = processProducts(productsArr);
        allProducts = [...allProducts, ...filtered];
        setProducts([...allProducts]);
        setProgress(p => ({
          ...p,
          totalFound: allProducts.length,
        }));

        if (page >= totalPages) break;
        page += 1;
      }

      setLoading(false);
      if (allProducts.length === 0) {
        setError('No products found matching criteria after checking all pages.');
      } else {
        // Cache it
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            products: allProducts,
            date: getTodayString(),
            lastPage: page,
            totalPages,
            totalTried: progress.totalTried,
          })
        );
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to load products');
    }
  };

    useEffect(() => {
    const interval = setInterval(async () => {
        const res = await fetch('/api/clear-products-cache');
        const data = await res.json();
        if (data.cacheClearedAt !== localStorage.getItem('cacheClearedAt')) {
        localStorage.removeItem(CACHE_KEY);
        localStorage.setItem('cacheClearedAt', data.cacheClearedAt);
        }
    }, 60000); // check every 60s
    return () => clearInterval(interval);
    }, []);

  // Only fetch or load cache when panel is opened
  useEffect(() => {
    if (!open) return;
    fetchAllPages();
    // eslint-disable-next-line
  }, [open, wpUrl]);

  // Optionally: Manual refresh button (for debugging)
//   <button onClick={()=>{localStorage.removeItem(CACHE_KEY); fetchAllPages(true);}}>Force Refresh</button>

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-[340px] bg-white shadow-lg z-50 border-r transform transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ maxHeight: '100vh', overflowY: 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Select Product</h2>
        <button onClick={onClose} className="cursor-pointer ml-2 text-xl">
          ×
        </button>
      </div>
      <div className="p-3">
        {loading && (
          <div className="mb-2 text-sm text-blue-600">
            {progress.totalFound > 0 && (
              <div>
                <span className="font-semibold">{progress.totalFound}</span> product{progress.totalFound !== 1 && 's'} found so far.
              </div>
            )}
            <div>
              Fetching page <span className="font-semibold">{progress.page}</span> of <span className="font-semibold">{progress.totalPages}</span>
              {progress.totalTried > 0 && (
                <> ({progress.totalTried} products checked...)</>
              )}
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="text-red-600 text-sm mb-2">{error}</div>
        )}
        {!loading && !error && products.length > 0 && (
          <div className="mb-2 text-green-700 text-xs">
            Finished. Found <span className="font-semibold">{products.length}</span> matching product{products.length !== 1 && 's'} in {progress.totalPages} page{progress.totalPages !== 1 && 's'}.
          </div>
        )}
        {!loading && !error && products.length === 0 && (
          <div className="text-gray-500 text-sm mb-2">
            No products found matching criteria.
          </div>
        )}
        {!error && products.length > 0 && (
          products.map(prod => (
            <div key={prod.id} className="mb-4">
              <div className="font-bold text-sm mb-1">
                {prod.title} <span className="text-gray-500">({prod.id})</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {prod.images.map((img, idx) => (
                  <div
                    key={img.url + idx}
                    className="border rounded cursor-pointer hover:bg-muted transition"
                    onClick={() => {
                      onSelect(img.url, prod.id);
                      onClose();
                    }}
                  >
                    <img
                      src={img.url}
                      alt={prod.title}
                      width={img.width || 80}
                      height={img.height || 80}
                      className="w-20 h-20 object-contain rounded"
                      style={img.colorHex ? { border: `2px solid ${img.colorHex}` } : {}}
                    />
                    {img.colorTitle && (
                      <div className="text-xs text-center" style={img.colorHex ? { color: img.colorHex } : {}}>
                        {img.colorTitle}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
