'use client';

import { useCartItems, getTotalPrice, getCartTotalPrice } from './cartStore';

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
    const ctype  = String(coupon.type || coupon.discount_type || '').toLowerCase();

    if (ctype === 'percent' || ctype === 'percentage' || ctype === 'percent_cart') {
      couponDiscountCents = Math.round((subtotalCents * amount) / 100);
      couponLabel = `${amount}%`;
    } else if (ctype === 'fixed' || ctype === 'fixed_cart') {
      const fixed = toCents(amount);
      couponDiscountCents = Math.min(subtotalCents, fixed);
      couponLabel = `${amount}₪`;
    }
  }

  const cartTotalPreciseCents = Math.max(0, subtotalCents - couponDiscountCents + shippingCents);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md space-y-6">
      <h3 className="text-lg font-bold text-gray-900 text-center border-b mb-4 border-gray-200 py-6">
        אפשרויות משלוח
      </h3>

      {loading ? (
        <div className="text-gray-400 text-center py-8">טוען אפשרויות...</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {shippingOptions.map(option => (
              <label
                key={option.id}
                className={`relative cursor-pointer flex py-2 px-4 items-center gap-3 transition-all text-right
                  ${
                    selectedShipping?.id === option.id
                      ? 'border-blue-600 bg-blue-50 shadow'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }
                `}
              >
                <span
                  className={`absolute right-0 h-[100%] z-0 w-[30px] bg-blue-700
                  ${selectedShipping?.id === option.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                ></span>
                <input
                  type="radio"
                  name="shipping"
                  checked={selectedShipping?.id === option.id}
                  onChange={() => onShippingSelect && onShippingSelect(option)}
                  className="mt-1 -right-[8px] shrink-0 relative z-1 accent-blue-600"
                />
                <div className="flex flex-col flex-grow">
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold text-sm text-gray-900">
                      {option.label} {option.cost === 0 ? 'חינם' : `${option.cost} ₪`}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {option.method_id === 'free_shipping'
                      ? 'משלוח חינם / איסוף עצמי'
                      : 'משלוח בתשלום'}
                  </span>
                </div>
              </label>
            ))}
            {shippingOptions.length === 0 && (
              <div className="text-gray-400 text-center py-4">
                אין אפשרויות משלוח זמינות לסל הנוכחי.
              </div>
            )}
          </div>

          {/* Subtotal + Coupon + Checkout */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col justify-center items-center text-sm text-gray-700">
              <span className="text-2xl font-bold">סה&quot;כ:</span>
              <span className="text-3xl font-bold">{fmt2(cartTotalPreciseCents)} ₪</span>
            </div>
            {coupon && coupon.valid && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-pink-600 text-sm font-semibold">
                  <span>קופון:</span>
                  <span className="font-bold">{coupon.code || couponLabel}</span>
                  <span>-{fmt2(couponDiscountCents)}₪</span>
                  {onRemoveCoupon && (
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700 underline text-xs font-normal ml-2"
                      onClick={onRemoveCoupon}
                    >
                      הסר
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="text-center pb-6">
              <button
                className="w-[80%] py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer"
                disabled={!selectedShipping}
              >
                המשך לתשלום
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
