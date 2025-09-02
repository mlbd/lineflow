// CartPage.jsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCartItems, useCustomerNote, useSetCustomerNote } from './cartStore';
import CartItem from './CartItem';
import Checkout from './Checkout';
import CartEmpty from './CartEmpty';
import ShippingOptions from './ShippingOptions';
import CouponField from './CouponField';
import CartShimmer from './CartShimmer';

import ProductQuickViewModal from '@/components/page/ProductQuickViewModal';
import AddToCartModal from '@/components/page/AddToCartModal';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { wpApiFetch } from '@/lib/wpApi';

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

  const [selectedShipping, setSelectedShipping] = useState(null);
  const [validating, setValidating] = useState(false);
  const [coupon, setCoupon] = useState(null);
  const [couponInput, setCouponInput] = useState('');

  // 🔧 Toggle if you ever want to switch grouping off quickly
  const GROUP_CART_BY_PRODUCT = true;

  // Arrange items so that same product_id are siblings (stable by first appearance).
  // IMPORTANT: we keep each entry's original store index so remove/update still target correctly.
  const arranged = useMemo(() => {
    if (!GROUP_CART_BY_PRODUCT) {
      return (Array.isArray(items) ? items : []).map((it, idx) => ({ it, storeIndex: idx }));
    }
    const withIndex = (Array.isArray(items) ? items : []).map((it, idx) => ({
      it,
      storeIndex: idx,
    }));
    const groups = new Map(); // pid -> entries[]
    for (const entry of withIndex) {
      const pid = String(entry.it?.product_id ?? '');
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push(entry);
    }
    const out = [];
    for (const entries of groups.values()) out.push(...entries);
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

  const handleValidateCoupon = async ({ code, onError }) => {
    console.log('handleValidateCoupon', acf);
    setValidating(true);
    setCoupon(null);
    try {
      const res = await wpApiFetch(`coupon-validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon_code: code, email: acf?.email_address || 'dummy@example.com' }),
      });
      const data = await res.json();
      setCoupon(data);
      if (!data?.valid && data?.error) onError?.(data.error);
    } catch {
      onError?.('שגיאה באימות קופון');
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon(null);
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
      <div className="mt-16 max-w-[900px] mx-auto w-full">
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-8 text-center">סל קניות</h1>

          {validating ? (
            <CartShimmer itemCount={items.length || 3} />
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Cart Section */}
              <div className="md:w-[70%] w-full">
                {/* Header */}
                {arranged.length > 0 && (
                  <div className="grid grid-cols-7 gap-0 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                    <div className="text-center font-semibold text-gray-700"></div>
                    <div className="col-span-2 font-semibold text-gray-700">מוצר</div>
                    <div className="text-center font-semibold text-gray-700">מחיר</div>
                    <div className="text-center font-semibold text-gray-700">כמות</div>
                    <div className="text-center font-semibold text-gray-700">סה&quot;כ</div>
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
                        placeholder="כל הערה שקיימת בנוגע להזמנה מוזמנים להקליד כאן."
                        className="w-full border rounded px-3 py-2 outline-none border-gray-300 min-h-[80px] bg-white text-gray-700"
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Shipping / Summary */}
              <div className="md:w-[30%] min-w-[260px] max-w-[370px] w-full sticky top-8 self-start">
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
        <div className="mt-16 flex justify-center max-w-[900px] mx-auto w-full">
          <div className="w-8/12">
            <Checkout
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
