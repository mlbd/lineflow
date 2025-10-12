// CartPage.jsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CartEmpty from './CartEmpty';
import CartItem from './CartItem';
import CartShimmer from './CartShimmer';
import {
  useCartItems,
  useCoupon,
  useCustomerNote,
  useRemoveCoupon,
  useSetCoupon,
  useSetCustomerNote,
} from './cartStore';
import Checkout from './Checkout';
import CouponField from './CouponField';
import ShippingOptions from './ShippingOptions';
import StripeCheckout from './StripeCheckout';

import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import AddToCartModal from '@/components/page/AddToCartModal';
import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import { wpApiFetch } from '@/lib/wpApi';

// [PATCH] Added: Normalize a placements array/string into a stable signature used for cart-only grouping
// Put this below your imports and ABOVE findProductLocally()
function __toPlacementSig(arrLike) {
  let arr = [];
  if (Array.isArray(arrLike)) {
    arr = arrLike;
  } else if (typeof arrLike === 'string') {
    try {
      const parsed = JSON.parse(arrLike);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {}
  }
  if (!arr.length) return 'default';

  // Build "name:active[:sideOrBack]" parts, sort for stability
  const parts = arr
    .map(p => {
      if (!p) return '';
      const name = String(p?.name || '')
        .trim()
        .toLowerCase();
      const active = p?.active ? 1 : 0;
      const side = p?.side ? String(p.side).trim().toLowerCase() : p?.__forceBack ? 'back' : '';
      return `${name}:${active}${side ? `:${side}` : ''}`;
    })
    .filter(Boolean)
    .sort();

  return parts.length ? parts.join('|') : 'default';
}

// [PATCH] Added: Get a cart-line’s placements signature (works for both Group and Quantity flows)
function placementSigForCart(item) {
  // Quantity flow: you already set this in AddToCartQuantity.jsx
  const explicit = item?.options?.placement_merge_key;
  if (explicit) return String(explicit);

  // If filter/placements were never changed, consider it "default"
  if (!item?.filter_was_changed) return 'default';

  // Otherwise derive from frozen snapshot on the line (both flows store it)
  const coords = item?.placement_coordinates || item?.options?.placement_coordinates;
  const sig = __toPlacementSig(coords);
  return sig || 'default';
}

function findProductLocally(id, initialProducts, companyData) {
  const pid = String(id);
  if (Array.isArray(initialProducts)) {
    const p = initialProducts.find(pr => String(pr?.id) === pid);
    if (p) return p;
  }
  if (companyData && Array.isArray(companyData.products)) {
    const p = companyData.products.find(pr => String(pr?.id) === pid);
    if (p) return p;
  }
  return null;
}

export default function CartPage({
  initialProducts = [], // ✅ passed from [slug].jsx
  shippingOptions = [],
  shippingLoading = false,
  acf = {},
  companyData = {},
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
  slug = '',
}) {
  const items = useCartItems();
  const customerNote = useCustomerNote();
  const setCustomerNote = useSetCustomerNote();

  // [PATCH] Added: use coupon from persisted store (no local state)
  const coupon = useCoupon();
  const setCouponStore = useSetCoupon();
  const removeCouponStore = useRemoveCoupon();

  const [selectedShipping, setSelectedShipping] = useState(null);
  const [validating, setValidating] = useState(false);
  const [couponInput, setCouponInput] = useState('');

  // 🔧 Toggle if you ever want to switch grouping off quickly
  const GROUP_CART_BY_PRODUCT = true;

  // [PATCH] Updated: Arrange items by product_id, then by placement signature (cart-only visual grouping)
  const arranged = useMemo(() => {
    if (!GROUP_CART_BY_PRODUCT) {
      return (Array.isArray(items) ? items : []).map((it, idx) => ({ it, storeIndex: idx }));
    }

    // Keep original store index so remove/update still target correctly
    const withIndex = (Array.isArray(items) ? items : []).map((it, idx) => ({
      it,
      storeIndex: idx,
    }));

    // 1) Group by product_id in first-seen order
    const byPid = new Map(); // pid -> entries[]
    const pidOrder = [];
    for (const entry of withIndex) {
      const pid = String(entry.it?.product_id ?? '');
      if (!byPid.has(pid)) {
        byPid.set(pid, []);
        pidOrder.push(pid);
      }
      byPid.get(pid).push(entry);
    }

    // 2) Within each product, subgroup by placements signature in first-seen order
    const out = [];
    for (const pid of pidOrder) {
      const entries = byPid.get(pid) || [];

      const bySig = new Map(); // sig -> entries[]
      const sigOrder = [];
      for (const e of entries) {
        const sig = placementSigForCart(e.it);
        if (!bySig.has(sig)) {
          bySig.set(sig, []);
          sigOrder.push(sig);
        }
        bySig.get(sig).push(e);
      }

      // Keep stable order within each subgroup by original index
      for (const sig of sigOrder) {
        const sub = bySig.get(sig) || [];
        sub.sort((a, b) => a.storeIndex - b.storeIndex);
        out.push(...sub);
      }
    }

    return out;
  }, [items]);

  // ✅ Single "modal router": only ONE Radix Dialog mounted at a time
  //    kind: 'quick' | 'add' | null
  const [modal, setModal] = useState({ kind: null, product: null });

  useEffect(() => {
    if (!selectedShipping && shippingOptions.length > 0) {
      setSelectedShipping(shippingOptions[0]);
    }
  }, [shippingOptions, selectedShipping]);

  // [PATCH] New: on mount/when store coupon changes, prefill the input
  useEffect(() => {
    if (coupon?.code) setCouponInput(prev => (prev?.trim() ? prev : coupon.code));
  }, [coupon?.code]);

  const handleValidateCoupon = async ({ code, onError }) => {
    console.log('handleValidateCoupon', acf);
    setValidating(true);
    try {
      const res = await wpApiFetch(`coupon-validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_code: code,
          email: acf?.email_address || 'dummy@example.com',
        }),
      });
      const data = await res.json();
      // [PATCH] Added: persist coupon in store so it survives refresh
      // Also store the code explicitly in case API doesn't echo it back.
      setCouponStore({ ...data, code });
      if (!data?.valid && data?.error) onError?.(data.error);
    } catch {
      onError?.('Coupon verification error');
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    // [PATCH] Updated: remove from store and clear input
    removeCouponStore();
    setCouponInput('');
  };

  // Open Add-To-Cart directly from the cart row (pre-populate filters + form)
  const onOpenEditFromCart = useCallback(
    item => {
      const pid = String(item?.product_id || '');
      const placements = Array.isArray(item?.placement_coordinates)
        ? item.placement_coordinates
        : [];

      // 1) Prime area filter store so AddToCart* shows same active areas
      try {
        useAreaFilterStore.setState(s => ({
          filters: { ...(s.filters || {}), [pid]: placements },
        }));
      } catch {}

      // 2) Hydrate product object (no fetch)
      let product = findProductLocally(pid, initialProducts, companyData);
      if (!product) {
        product = {
          id: item.product_id,
          name: item.name,
          thumbnail: item.thumbnail,
          price: item.price,
          regular_price: item.regular_price ?? item.price,
          acf: { ...(item?.acf || {}) },
        };
      }

      // Ensure ACF has the right pricing arrays + group type
      const acfOut = product.acf ? { ...product.acf } : {};

      // Group-type tiers
      if (
        (!acfOut.discount_steps || !acfOut.discount_steps.length) &&
        item?.pricing?.discount_steps
      ) {
        acfOut.discount_steps = item.pricing.discount_steps;
      }

      // Quantity-type tiers
      if ((!acfOut.quantity_steps || !acfOut.quantity_steps.length) && item?.pricing?.steps) {
        acfOut.quantity_steps = item.pricing.steps;
      }

      // Ensure group_type is present
      if (!acfOut.group_type && item?.options?.group_type) {
        acfOut.group_type = item.options.group_type;
      }

      if (product.regular_price == null && product.price != null) {
        product = { ...product, regular_price: product.price };
      }

      // 3) Open AddToCart modal directly with snapshot placements
      setModal({
        kind: 'add',
        product: { ...product, placement_coordinates: placements, acf: acfOut },
      });
    },
    [initialProducts, companyData]
  );

  return (
    <div className="relative bg-bglight">
      <div className="mt-16 w-full py-8 px-4">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Shopping Cart</h1>

          {validating ? (
            <CartShimmer itemCount={items.length || 3} />
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Cart Section */}
              <div className="md:w-[65%] w-full">
                {/* Header */}
                {arranged.length > 0 && (
                  <div className="grid grid-cols-7 gap-0 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                    <div className="text-center font-semibold text-gray-700"></div>
                    <div className="col-span-2 font-semibold text-gray-700">Product</div>
                    <div className="text-center font-semibold text-gray-700">Price</div>
                    <div className="text-center font-semibold text-gray-700">Quantity</div>
                    <div className="text-center font-semibold text-gray-700">Total</div>
                  </div>
                )}

                {/* Items + shimmer overlay */}
                <div className={`relative ${validating ? 'pointer-events-none opacity-60' : ''}`}>
                  <div className="space-y-4">
                    {arranged.length > 0 ? (
                      arranged.map(({ it, storeIndex }) => (
                        <CartItem
                          key={`${it.product_id}-${storeIndex}`}
                          item={it}
                          idx={storeIndex}
                          companyLogos={companyLogos}
                          pagePlacementMap={pagePlacementMap}
                          customBackAllowedSet={customBackAllowedSet}
                          onOpenEditFromCart={onOpenEditFromCart}
                        />
                      ))
                    ) : (
                      // Show the empty-state inside the items section
                      <div className="py-6">
                        <CartEmpty />
                      </div>
                    )}
                  </div>

                  {validating && (
                    <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center rounded-lg animate-pulse">
                      <div className="w-14 h-14 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Coupon */}
                {arranged.length > 0 && (
                  <>
                    <CouponField
                      couponInput={couponInput}
                      setCouponInput={setCouponInput}
                      onValidate={handleValidateCoupon}
                      validating={validating}
                      couponDetails={coupon}
                      onRemoveCoupon={handleRemoveCoupon}
                    />

                    {/* Customer Note */}
                    <div className="mt-4">
                      <textarea
                        value={customerNote}
                        onChange={e => setCustomerNote(e.target.value)}
                        placeholder="Any notes regarding the order can be entered here."
                        className="w-full border rounded px-3 py-2 outline-none border-gray-300 min-h-[80px] bg-white text-gray-700"
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Shipping / Summary */}
              <div className="md:w-[35%] min-w-[260px] max-w-[370px] w-full sticky top-8 self-start">
                <ShippingOptions
                  shippingOptions={shippingOptions}
                  loading={shippingLoading}
                  selectedShipping={selectedShipping}
                  onShippingSelect={setSelectedShipping}
                  coupon={coupon && coupon.valid ? coupon : null}
                  onRemoveCoupon={() => setCoupon(null)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checkout block */}
      <div className="py-[50px] mt-[50px] bg-white">
        <div className="container mx-auto">
          <div className="mt-16 flex justify-center">
            <StripeCheckout
              selectedShipping={selectedShipping}
              coupon={coupon && coupon.valid ? coupon : null}
              userMeta={acf}
              companyData={companyData}
              pagePlacementMap={pagePlacementMap}
              customBackAllowedSet={customBackAllowedSet}
              slug={slug}
            />
          </div>
        </div>
      </div>

      {/* 🔀 Modal router — prevents two Dialogs from mounting at once */}
      {modal.kind === 'quick' && (
        <ProductQuickViewModal
          open
          onClose={() => setModal({ kind: null, product: null })}
          product={modal.product}
          onAddToCart={nextProduct => {
            const chosen = nextProduct || modal.product;
            // close QuickView, then open AddToCart on next tick
            setModal({ kind: null, product: null });
            setTimeout(() => setModal({ kind: 'add', product: chosen }), 0);
          }}
          companyLogos={companyLogos}
          bumpPrice={acf?.bump_price}
          pagePlacementMap={pagePlacementMap}
          customBackAllowedSet={customBackAllowedSet}
        />
      )}

      {modal.kind === 'add' && (
        <AddToCartModal
          open
          onClose={() => setModal({ kind: null, product: null })}
          product={modal.product}
          bumpPrice={acf?.bump_price}
          onOpenQuickView={p => {
            const chosen = p || modal.product;
            setModal({ kind: null, product: null });
            setTimeout(() => setModal({ kind: 'quick', product: chosen }), 0);
          }}
          onCartAddSuccess={() => {
            // optional: toast / refresh
          }}
          pagePlacementMap={pagePlacementMap}
          customBackAllowedSet={customBackAllowedSet}
        />
      )}
    </div>
  );
}
