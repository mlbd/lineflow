// [PATCH] Added ProductsContext to share initialProducts without prop-drilling
import { createContext, useContext, useMemo, useState } from 'react';

const ProductsContext = createContext(null);

export function ProductsProvider({ initialProducts = [], children }) {
  // Keep it stateful so later you can modify products (e.g., client filters) if needed
  const [products, setProducts] = useState(initialProducts);
  const value = useMemo(() => ({ products, setProducts }), [products]);
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) {
    throw new Error('useProducts must be used within a <ProductsProvider>');
  }
  return ctx; // { products, setProducts }
}

// Optional convenience
export function useProductById(id) {
  const { products } = useProducts();
  return useMemo(
    () => products?.find?.(p => String(p?.id) === String(id)) || null,
    [products, id]
  );
}
