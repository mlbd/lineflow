import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => {
        set((state) => {
            // For group_type = Group, merge by product/color/size
            if (item.options && item.options.group_type === "Group") {
            const idx = state.items.findIndex(
                (i) =>
                i.product_id === item.product_id &&
                i.options?.group_type === "Group" &&
                i.options?.color === item.options.color &&
                i.options?.size === item.options.size
            );
            if (idx > -1) {
                // Update quantity for matched item
                const newItems = [...state.items];
                newItems[idx] = {
                ...newItems[idx],
                quantity: newItems[idx].quantity + item.quantity,
                };
                return { items: newItems };
            }
            // Add as new if not matched
            return { items: [...state.items, item] };
            }

            // For other types (or single products), merge by product_id & options
            const idx = state.items.findIndex(
            (i) =>
                i.product_id === item.product_id &&
                JSON.stringify(i.options) === JSON.stringify(item.options)
            );
            if (idx > -1) {
            const newItems = [...state.items];
            newItems[idx] = {
                ...newItems[idx],
                quantity: newItems[idx].quantity + item.quantity,
            };
            return { items: newItems };
            }
            return { items: [...state.items, item] };
        });
      },

      
      removeItem: (index) => {
        set((state) => ({
          items: state.items.filter((_, i) => i !== index)
        }));
      },
      
      updateItemQuantity: (index, newQuantity) => {
        set((state) => {
          const newItems = [...state.items];
          if (newItems[index] && newItems[index].quantity !== newQuantity) {
            newItems[index] = { ...newItems[index], quantity: newQuantity };
          }
          return { items: newItems };
        });
      },
      
      clearCart: () => {
        set({ items: [] });
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);

// Simple selectors - no object creation
export const useCartItems = () => useCartStore(state => state.items);
export const useAddItem = () => useCartStore(state => state.addItem);
export const useRemoveItem = () => useCartStore(state => state.removeItem);
export const useUpdateItemQuantity = () => useCartStore(state => state.updateItemQuantity);
export const useClearCart = () => useCartStore(state => state.clearCart);

// Utility functions for calculations
export const getTotalItems = (items) => {
  return items.reduce((total, item) => total + item.quantity, 0);
};

export const getTotalPrice = (items) => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};