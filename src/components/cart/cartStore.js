// components/cart/cartStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ===========================
   Currency-safe number utils
   =========================== */
const toNumber = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[^\d.-]/g, ''); // strips ₪, commas, spaces, etc.
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const normalizeSteps = (steps = []) =>
  [...(Array.isArray(steps) ? steps : [])]
    .map(s => ({ quantity: toNumber(s?.quantity), amount: toNumber(s?.amount) }))
    .filter(s => s.quantity > 0) // keep only meaningful tiers
    .sort((a, b) => a.quantity - b.quantity);

// Tiered unit price for Group products (sum across all lines of same product)
const _getStepPrice = (total, regularPrice = 0, discountSteps = []) => {
  let price = toNumber(regularPrice);
  const steps = normalizeSteps(discountSteps);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    // If total is <= this tier max, use it
    if (total <= step.quantity) {
      return step.amount > 0 ? step.amount : toNumber(regularPrice);
    }
  }
  // Beyond highest tier, use last step’s amount
  const last = steps[steps.length - 1];
  return last.amount > 0 ? last.amount : toNumber(regularPrice);
};

// Unit price for Quantity-type products (per-line)
const _getQuantityUnitPrice = (q, steps = [], fallback = 0) => {
  const norm = normalizeSteps(steps);
  let p = toNumber(fallback);
  for (const s of norm) {
    if (q >= s.quantity && s.amount > 0) p = s.amount;
    else if (q < s.quantity) break;
  }
  return p;
};

/* ===========================
   Placement signature helpers
   =========================== */
const buildPlacementSignature = placements => {
  try {
    const actives = (Array.isArray(placements) ? placements : [])
      .filter(p => p && p.name && p.active)
      .map(p => String(p.name).trim().toLowerCase());
    return actives.length ? actives.sort().join('|') : 'default';
  } catch {
    return 'default';
  }
};

// For merging: if user didn't change filter, treat as 'default' regardless of stored coordinates
const effectiveSigForMerge = item => {
  return item?.options?.group_type === 'Group'
    ? item?.filter_was_changed
      ? buildPlacementSignature(item?.placement_coordinates)
      : 'default'
    : '';
};

/* ===========================
   Store
   =========================== */
export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      /* Add item (merge rules restored):
         - GROUP: merge by product_id + color + size + sig
           where sig = 'default' if filter_was_changed !== true,
                 else signature of active placements.
         - NON-GROUP: previous behavior (options deep equality).
      */
      addItem: item => {
        set(state => {
          const newItems = [...(Array.isArray(state.items) ? state.items : [])];

          // GROUP flow (color/size grid)
          if (item?.options?.group_type === 'Group') {
            const pid = String(item.product_id || '');
            const color = String(item?.options?.color || '');
            const size = String(item?.options?.size || '');
            const inSig = effectiveSigForMerge(item);

            const matchIdx = newItems.findIndex(i => {
              if (i?.options?.group_type !== 'Group') return false;
              return (
                String(i.product_id || '') === pid &&
                String(i?.options?.color || '') === color &&
                String(i?.options?.size || '') === size &&
                effectiveSigForMerge(i) === inSig
              );
            });

            if (matchIdx > -1) {
              const prev = newItems[matchIdx];
              const nextQty = (parseInt(prev.quantity) || 0) + (parseInt(item.quantity) || 0);

              newItems[matchIdx] = {
                ...prev,
                quantity: nextQty,
              };
            } else {
              newItems.push(item);
            }

            // Re-price all GROUP lines of this product by current tier
            const groupLines = newItems
              .map((it, idx) => ({ it, idx }))
              .filter(
                ({ it }) => it.product_id === item.product_id && it?.options?.group_type === 'Group'
              );

            // Prefer pricing data from any line (fallback to current item)
            const anyWithPricing = groupLines.find(({ it }) => it.pricing?.discount_steps) || {
              it: { pricing: item.pricing || {} },
            };

            const regular_price = toNumber(anyWithPricing.it.pricing?.regular_price);
            const discount_steps = anyWithPricing.it.pricing?.discount_steps || [];

            if (discount_steps && discount_steps.length) {
              const totalQty = groupLines.reduce(
                (sum, { it }) => sum + (parseInt(it.quantity) || 0),
                0
              );
              const newUnit = _getStepPrice(totalQty, regular_price, discount_steps);
              groupLines.forEach(({ idx }) => {
                newItems[idx] = { ...newItems[idx], price: newUnit };
              });
            }

            return { items: newItems };
          }

          // NON-GROUP flow (Quantity-type or simple)
          const idx = newItems.findIndex(
            i =>
              i.product_id === item.product_id &&
              JSON.stringify(i.options || {}) === JSON.stringify(item.options || {})
          );

          if (idx > -1) {
            const nextQty =
              (parseInt(newItems[idx].quantity) || 0) + (parseInt(item.quantity) || 0);
            let nextPrice = toNumber(newItems[idx].price);

            if (newItems[idx].pricing?.steps) {
              nextPrice = _getQuantityUnitPrice(nextQty, newItems[idx].pricing.steps, nextPrice);
            }

            newItems[idx] = {
              ...newItems[idx],
              quantity: nextQty,
              price: nextPrice,
            };
            return { items: newItems };
          }

          return { items: [...newItems, item] };
        });
      },

      /* Add or update (same behavior as addItem, exposed for clarity) */
      addOrUpdateItem: item => {
        get().addItem(item);
      },

      removeItem: index => {
        set(state => ({
          items: state.items.filter((_, i) => i !== index),
        }));
      },

      /* Change quantity; re-price accordingly (Group tier or Quantity steps) */
      updateItemQuantity: (index, newQuantity) => {
        set(state => {
          const newItems = [...state.items];
          if (!newItems[index]) return { items: newItems };

          const q = Math.max(0, parseInt(newQuantity) || 0);
          newItems[index] = { ...newItems[index], quantity: q };

          const item = newItems[index];

          // GROUP reprice across all lines for this product
          if (item.options?.group_type === 'Group' && item.pricing?.discount_steps) {
            const pid = item.product_id;
            const groupLines = newItems
              .map((it, idx) => ({ it, idx }))
              .filter(({ it }) => it.product_id === pid && it.options?.group_type === 'Group');

            const totalQty = groupLines.reduce(
              (sum, { it }) => sum + (parseInt(it.quantity) || 0),
              0
            );
            const unit = _getStepPrice(
              totalQty,
              toNumber(item.pricing.regular_price),
              item.pricing.discount_steps
            );

            groupLines.forEach(({ idx }) => {
              newItems[idx] = { ...newItems[idx], price: unit };
            });
            return { items: newItems };
          }

          // QUANTITY-type: reprice this line only via steps (if present)
          if (item.pricing?.steps) {
            const unit = _getQuantityUnitPrice(q, item.pricing.steps, toNumber(item.price));
            newItems[index] = { ...newItems[index], price: unit };
          }

          return { items: newItems };
        });
      },

      clearCart: () => {
        set({ items: [] });
      },
    }),
    { name: 'cart-storage' }
  )
);

/* ===========================
   Selectors / helpers
   =========================== */
export const useCartItems = () => useCartStore(s => s.items);
export const useAddItem = () => useCartStore(s => s.addItem);
export const useAddOrUpdateItem = () => useCartStore(s => s.addOrUpdateItem);
export const useRemoveItem = () => useCartStore(s => s.removeItem);
export const useUpdateItemQuantity = () => useCartStore(s => s.updateItemQuantity);
export const useClearCart = () => useCartStore(s => s.clearCart);

export const getTotalItems = items =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + (parseInt(item.quantity) || 0),
    0
  );

export const getTotalPrice = items =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + Math.round(toNumber(item.price) * (parseInt(item.quantity) || 0) * 100) / 100,
    0
  );

export const getCartTotalPrice = (items, { coupon = null, shippingCost = 0 } = {}) => {
  const subtotal = getTotalPrice(items);

  let couponDiscount = 0;
  if (coupon && coupon.valid) {
    const couponAmount = toNumber(coupon.amount);
    if (coupon.type === 'percent') {
      couponDiscount = Math.round(subtotal * (couponAmount / 100));
    } else {
      couponDiscount = couponAmount;
    }
  }

  const total = Math.max(0, subtotal + toNumber(shippingCost) - couponDiscount);
  return total;
};
