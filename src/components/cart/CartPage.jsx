'use client';
import { useState, useEffect } from 'react';
import { useCartItems } from './cartStore';
import CartItem from './CartItem';
import CartSummary from './CartSummary';
import CartEmpty from './CartEmpty';
import ShippingOptions from './ShippingOptions';
import CouponField from './CouponField';
import CartShimmer from './CartShimmer';

export default function CartPage({
  shippingOptions = [],
  shippingLoading = false,
  acf = {},
  companyData = {},
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
}) {
  const items = useCartItems();
  const [selectedShipping, setSelectedShipping] = useState(null);

  // Coupon logic
  const [validating, setValidating] = useState(false);
  const [coupon, setCoupon] = useState(null); // { valid, amount, type, description, ... }
  const [couponInput, setCouponInput] = useState('');

  useEffect(() => {
    if (!selectedShipping && shippingOptions.length > 0) {
      // ✅ Always select first one
      setSelectedShipping(shippingOptions[0]);
    }
  }, [shippingOptions, selectedShipping]);

  // Coupon validate handler
  const handleValidateCoupon = async ({ code, onError }) => {
    setValidating(true);
    setCoupon(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/coupon/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coupon_code: code, email: acf?.email_address || '' }),
        }
      );
      const data = await res.json();
      setCoupon(data);
      if (!data.valid && data.error) onError(data.error);
    } catch (e) {
      onError('שגיאה באימות קופון');
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon(null);
    setCouponInput('');
  };

  if (!items.length) return <CartEmpty />;

  return (
    <div className="relative bg-bglight">
      <div className="mt-16 max-w-[900px] mx-auto w-full">
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-8 text-center">סל קניות</h1>
          {validating ? (
            <CartShimmer itemCount={items.length || 3} />
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Cart Section: 80% width on desktop */}
              <div className="md:w-[70%] w-full">
                {/* Cart Header */}
                <div className="grid grid-cols-7 gap-0 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                  <div className="text-center font-semibold text-gray-700"></div>
                  <div className="col-span-2 font-semibold text-gray-700">מוצר</div>
                  <div className="text-center font-semibold text-gray-700">מחיר</div>
                  <div className="text-center font-semibold text-gray-700">כמות</div>
                  <div className="text-center font-semibold text-gray-700">סה&quot;כ</div>
                </div>

                {/* Shimmer overlay during validation */}
                <div className={`relative ${validating ? 'pointer-events-none opacity-60' : ''}`}>
                  {/* Cart Items */}
                  <div className="space-y-4">
                    {items.map((item, idx) => (
                      <CartItem
                        key={`${item.product_id}-${idx}`}
                        item={item}
                        idx={idx}
                        companyLogos={companyLogos}
                        pagePlacementMap={pagePlacementMap}
                        customBackAllowedSet={customBackAllowedSet}
                      />
                    ))}
                  </div>
                  {validating && (
                    <div className="absolute inset-0 z-10 bg-white/70 flex items-center justify-center rounded-lg animate-pulse">
                      <div className="w-14 h-14 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Coupon Field */}
                <CouponField
                  couponInput={couponInput}
                  setCouponInput={setCouponInput}
                  onValidate={handleValidateCoupon}
                  validating={validating}
                  couponDetails={coupon}
                  onRemoveCoupon={handleRemoveCoupon}
                />
              </div>

              {/* Shipping Options: 20% width */}
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
      <div className="py-[50px] mt-[50px] bg-white">
        <div className="mt-16 flex justify-center max-w-[900px] mx-auto w-full">
          <div className="w-8/12">
            <CartSummary
              selectedShipping={selectedShipping}
              coupon={coupon && coupon.valid ? coupon : null}
              userMeta={acf}
              companyData={companyData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
