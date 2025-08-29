// components/cart/cartStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildPlacementSignature } from '@/utils/placements';

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
const round2 = n => Math.round((toNumber(n) + Number.EPSILON) * 100) / 100;

const normalizeSteps = (steps = []) =>
  [...(Array.isArray(steps) ? steps : [])]
    .map(s => ({ quantity: toNumber(s?.quantity), amount: toNumber(s?.amount) }))
    .filter(s => s.quantity > 0) // keep only meaningful tiers
    .sort((a, b) => a.quantity - b.quantity);

// Tiered unit price for Group products (sum across all lines of same product)
const _getStepPrice = (total, regularPrice = 0, discountSteps = []) => {
  let price = toNumber(regularPrice);
  const steps = normalizeSteps(discountSteps);
  if (!steps.length) return price;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (total <= step.quantity) {
      return step.amount > 0 ? step.amount : toNumber(regularPrice);
    }
  }
  const last = steps[steps.length - 1];
  return last.amount > 0 ? last.amount : toNumber(regularPrice);
};

// Unit price for Quantity-type products (pooled by product)
const _getQuantityUnitPrice = (q, steps = [], fallback = 0) => {
  const norm = normalizeSteps(steps);
  let p = toNumber(fallback);
  for (const s of norm) {
    if (q >= s.quantity && s.amount > 0) p = s.amount;
    else if (q < s.quantity) break;
  }
  return p;
};

// NEW: helper to determine pricing group key for Group-line repricing
const _groupKey = () => 'default'; // selection signatures no longer split pools

// For merging: if user didn't change filter, treat as 'default' regardless of stored coordinates
const effectiveSigForMerge = item => {
  return item?.options?.group_type === 'Group'
    ? item?.filter_was_changed
      ? buildPlacementSignature(item?.placement_coordinates)
      : 'default'
    : '';
};

/* ===========================
   Central pooled repricer
   =========================== */
const repriceAfterChange = (items = []) => {
  const next = items.map(x => ({ ...x }));

  // 1) GROUP lines pooled by product_id
  const byProductGroup = new Map();
  next.forEach((it, idx) => {
    if (it?.options?.group_type === 'Group' && it?.product_id != null) {
      const key = String(it.product_id);
      if (!byProductGroup.has(key)) byProductGroup.set(key, []);
      byProductGroup.get(key).push({ idx, it });
    }
  });
  for (const [, rows] of byProductGroup) {
    const totalQty = rows.reduce((s, r) => s + (parseInt(r.it.quantity) || 0), 0);
    const anyWithPricing = rows.find(({ it }) => it.pricing?.discount_steps) || {
      it: { pricing: {} },
    };
    const regular_price = toNumber(anyWithPricing.it.pricing?.regular_price);
    const discount_steps = anyWithPricing.it.pricing?.discount_steps || [];
    if (discount_steps.length) {
      const baseUnit = _getStepPrice(totalQty, regular_price, discount_steps);
      rows.forEach(({ idx }) => {
        const extra = toNumber(next[idx]?.extra_unit_add || 0);
        next[idx] = { ...next[idx], price_base: baseUnit, price: round2(baseUnit + extra) };
      });
    }
  }

  // 2) QUANTITY lines pooled by product_id
  const byProductQty = new Map();
  next.forEach((it, idx) => {
    if (
      it?.product_id != null &&
      (it?.pricing?.type === 'Quantity' || it?.options?.line_type === 'Quantity')
    ) {
      const key = String(it.product_id);
      if (!byProductQty.has(key)) byProductQty.set(key, []);
      byProductQty.get(key).push({ idx, it });
    }
  });
  for (const [, rows] of byProductQty) {
    const totalQty = rows.reduce((s, r) => s + (parseInt(r.it.quantity) || 0), 0);
    const anyWithSteps = rows.find(
      ({ it }) => Array.isArray(it?.pricing?.steps) && it.pricing.steps.length
    ) || { it: {} };
    const steps = anyWithSteps.it.pricing?.steps || [];

    // Fallback base when steps are missing: infer from first row (price - extra)
    let baseUnit = 0;
    if (steps.length) {
      baseUnit = _getQuantityUnitPrice(totalQty, steps, 0);
    } else {
      const probe = rows[0]?.it;
      baseUnit = Math.max(0, toNumber(probe?.price) - toNumber(probe?.extra_unit_add || 0));
    }

    rows.forEach(({ idx }) => {
      const extra = toNumber(next[idx]?.extra_unit_add || 0);
      next[idx] = { ...next[idx], price_base: baseUnit, price: round2(baseUnit + extra) };
    });
  }

  return next;
};

/* ===========================
   Store
   =========================== */
export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      customerNote: '',
      setCustomerNote: note => set({ customerNote: note }),

      /* Add item (merge rules):
         - GROUP: merge by product_id + color + size + signature
         - NON-GROUP: merge by deep-equal options
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
                // keep prev.extra_unit_add if present
                extra_unit_add:
                  prev.extra_unit_add != null ? prev.extra_unit_add : item.extra_unit_add || 0,
              };
            } else {
              newItems.push({
                ...item,
                extra_unit_add: item?.extra_unit_add || 0,
              });
            }

            // ✅ Reprice all pools (Group + Quantity) after change
            return { items: repriceAfterChange(newItems) };
          }

          // NON-GROUP flow (Quantity-type or simple)
          const idx = newItems.findIndex(
            i =>
              i.product_id === item.product_id &&
              JSON.stringify(i.options || {}) === JSON.stringify(item.options || {})
          );

          if (idx > -1) {
            const prev = newItems[idx];
            const nextQty = (parseInt(prev.quantity) || 0) + (parseInt(item.quantity) || 0);

            // derive base (unit without extras) from steps for this *merged* line
            const prevBaseFallback = toNumber(
              prev.price_base != null
                ? prev.price_base
                : toNumber(prev.price) - toNumber(prev.extra_unit_add || 0)
            );
            const base = _getQuantityUnitPrice(
              nextQty,
              prev.pricing?.steps || [],
              prevBaseFallback
            );
            const extra = toNumber(
              prev.extra_unit_add != null ? prev.extra_unit_add : item?.extra_unit_add || 0
            );

            newItems[idx] = {
              ...prev,
              quantity: nextQty,
              price_base: base,
              price: round2(base + extra),
              extra_unit_add: extra,
            };

            // ✅ Reprice pools so ALL Quantity lines of this product get the pooled tier
            return { items: repriceAfterChange(newItems) };
          }

          // New non-group line
          const extra = toNumber(item?.extra_unit_add || 0);
          const baseFallback = toNumber(
            item.price_base != null ? item.price_base : toNumber(item.price) - extra
          );
          const base = _getQuantityUnitPrice(
            toNumber(item.quantity),
            item.pricing?.steps || [],
            baseFallback
          );
          const itemsOut = [
            ...newItems,
            { ...item, price_base: base, price: round2(base + extra), extra_unit_add: extra },
          ];

          // ✅ Reprice pools across all items (handles separate lines with different placements)
          return { items: repriceAfterChange(itemsOut) };
        });
      },

      /* Add or update (same behavior as addItem) */
      addOrUpdateItem: item => {
        get().addItem(item);
      },

      removeItem: index => {
        set(state => {
          const newItems = state.items.filter((_, i) => i !== index);
          // ✅ Reprice pools after removal
          return { items: repriceAfterChange(newItems) };
        });
      },

      /* Change quantity; re-price accordingly (Group tier or Quantity steps) */
      updateItemQuantity: (index, newQuantity) => {
        set(state => {
          const newItems = [...state.items];
          if (!newItems[index]) return { items: newItems };

          const q = Math.max(0, parseInt(newQuantity) || 0);
          newItems[index] = { ...newItems[index], quantity: q };

          // ✅ Unified repricer handles both Group and Quantity pools
          return { items: repriceAfterChange(newItems) };
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
export const useCustomerNote = () => useCartStore(s => s.customerNote);
export const useSetCustomerNote = () => useCartStore(s => s.setCustomerNote);

export const getTotalItems = items =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + (parseInt(item.quantity) || 0),
    0
  );

export const getTotalPrice = items =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) =>
      total + Math.round(toNumber(item.price) * (parseInt(item.quantity) || 0) * 100) / 100,
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
