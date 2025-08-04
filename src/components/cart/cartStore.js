import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: item => {
        set(state => {
          if (item.options && item.options.group_type === 'Group') {
            const idx = state.items.findIndex(
              i =>
                i.product_id === item.product_id &&
                i.options?.group_type === 'Group' &&
                i.options?.color === item.options.color &&
                i.options?.size === item.options.size
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
          }

          const idx = state.items.findIndex(
            i =>
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

      addOrUpdateItem: item => {
        set(state => {
          const items = [...state.items];
          const matchIndex = items.findIndex(i =>
            i.product_id === item.product_id &&
            i.options?.group_type === 'Group' &&
            i.options?.color === item.options?.color &&
            i.options?.size === item.options?.size
          );

          if (matchIndex > -1) {
            console.log(`[CartStore] Updating existing item ${item.product_id} (${item.options.color} / ${item.options.size})`);
            items[matchIndex].quantity += item.quantity;
            return { items };
          }

          console.log(`[CartStore] Adding NEW item ${item.product_id} (${item.options.color} / ${item.options.size})`);
          return { items: [...items, item] };
        });
      },

      removeItem: index => {
        set(state => ({
          items: state.items.filter((_, i) => i !== index),
        }));
      },

      updateItemQuantity: (index, newQuantity) => {
        set(state => {
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

// Hooks
export const useCartItems = () => useCartStore(state => state.items);
export const useAddItem = () => useCartStore(state => state.addItem);
export const useAddOrUpdateItem = () => useCartStore(state => state.addOrUpdateItem);
export const useRemoveItem = () => useCartStore(state => state.removeItem);
export const useUpdateItemQuantity = () => useCartStore(state => state.updateItemQuantity);
export const useClearCart = () => useCartStore(state => state.clearCart);

// Utility functions
export const getTotalItems = items => {
  return items.reduce((total, item) => total + item.quantity, 0);
};

export const getTotalPrice = items => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

export const getCartTotalPrice = (items, { coupon = null, shippingCost = 0 } = {}) => {
  const subtotal = getTotalPrice(items);

  let couponDiscount = 0;
  if (coupon && coupon.valid) {
    const couponAmount = Number(coupon.amount);
    if (coupon.type === 'percent') {
      couponDiscount = Math.round(subtotal * (couponAmount / 100));
    } else {
      couponDiscount = couponAmount;
    }
  }

  const total = Math.max(0, subtotal + Number(shippingCost) - couponDiscount);
  return total;
};
