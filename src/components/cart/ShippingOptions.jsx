'use client';

import { getTotalPrice, useCartItems } from './cartStore';

// [PATCH] Added: cents helpers for precise math + 2-decimal display
const toCents = v => Math.round(Number(v ?? 0) * 100);
const fmt2 = cents => (Math.max(0, Number(cents || 0)) / 100).toFixed(2);

export default function ShippingOptions({
  shippingOptions = [],
  loading = false,
  selectedShipping,
  onShippingSelect,
  coupon = null,
  onRemoveCoupon = null,
}) {
  // [PATCH] Updated: cents-precise subtotal/discount/total
  const items = useCartItems();
  const subtotal = getTotalPrice(items);
  const subtotalCents = toCents(subtotal);
  const shippingCents = toCents(selectedShipping?.cost || 0);

  let couponDiscountCents = 0;
  let couponLabel = '';

  if (coupon && coupon.valid) {
    const amount = Number(coupon.amount || 0);
    const ctype = String(coupon.type || coupon.discount_type || '').toLowerCase();

    if (ctype === 'percent' || ctype === 'percentage' || ctype === 'percent_cart') {
      couponDiscountCents = Math.round((subtotalCents * amount) / 100);
      couponLabel = `${amount}%`;
    } else if (ctype === 'fixed' || ctype === 'fixed_cart') {
      const fixed = toCents(amount);
      couponDiscountCents = Math.min(subtotalCents, fixed);
      couponLabel = `$${amount}`;
    }
  }

  const cartTotalPreciseCents = Math.max(0, subtotalCents - couponDiscountCents + shippingCents);

  return (
    <div className="rounded-[22px] bg-[#F3F2FF] p-6 md:p-7 lg:p-8 shadow-[0_10px_30px_rgba(10,0,110,0.08)] space-y-6">
      <h3 className="text-[18px] font-semibold text-[#0A006E] tracking-[-0.2px]">
        Shipping Option
      </h3>

      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading options...</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {shippingOptions.map(option => (
              <label
                key={option.id}
                className={`relative cursor-pointer flex items-start gap-3 rounded-2xl px-3 py-3 transition
              ${selectedShipping?.id === option.id ? 'bg-transparent' : 'hover:bg-white/50'}
            `}
              >
                {/* radio */}
                <input
                  type="radio"
                  name="shipping"
                  checked={selectedShipping?.id === option.id}
                  onChange={() => onShippingSelect && onShippingSelect(option)}
                  className="mt-1 shrink-0 accent-[#0A006E] h-4 w-4"
                />

                {/* text */}
                <div className="flex flex-col flex-grow">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[15px] text-gray-900">{option.label}</span>

                    {/* right price */}
                    <span className="text-[14px] font-bold text-[#0A006E]">
                      {option.cost === 0
                        ? '$0.00 (Free)'
                        : `$${option.cost.toFixed?.(2) ?? option.cost}`}
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-gray-500">
                    {option.method_id === 'free_shipping'
                      ? 'Free shipping / Self pickup'
                      : 'Paid shipping'}
                  </span>
                </div>
              </label>
            ))}

            {shippingOptions.length === 0 && (
              <div className="text-gray-400 text-center py-4">
                No shipping options available for the current cart.
              </div>
            )}
          </div>

          {/* Total pill */}
          <div className="pt-2">
            <div className="mx-auto w-full rounded-2xl bg-white px-4 py-3 shadow-[0_6px_18px_rgba(16,24,40,0.08)] ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-bold text-gray-800">Total</span>
                <span className="text-[28px] font-extrabold tracking-tight text-[#0A006E]">
                  ${fmt2(cartTotalPreciseCents)}
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pb-1">
            <button
              className="w-full md:w-[92%] mx-auto py-3.5 rounded-full bg-gradient-to-b from-[#0D0071] to-[#0D0071] text-white font-semibold shadow-[0_10px_24px_rgba(10,0,110,0.25)] hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedShipping}
            >
              Proceed to Payment
            </button>
          </div>
        </>
      )}
    </div>
  );
}
