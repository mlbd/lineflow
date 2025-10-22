'use client';
import { useState } from 'react';

export default function CouponField({
  couponInput,
  setCouponInput,
  onValidate,
  validating,
  couponDetails,
  onRemoveCoupon,
}) {
  const [error, setError] = useState(null);

  const handleApply = async e => {
    e.preventDefault();
    setError(null);
    const code = (couponInput || '').trim();
    if (!code) {
      setError('Please enter a coupon code.');
      return;
    }
    try {
      await onValidate?.({
        code,
        onError: msg => setError(msg || 'Coupon validation failed.'),
      });
    } catch {
      setError('Coupon verification error'); // "Error validating coupon"
    }
  };

  const handleRemove = () => {
    setError(null);
    onRemoveCoupon?.();
  };

  return (
    <form onSubmit={handleApply} className="relative mt-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-col justify-between items-center gap-3">
          <div className='w-full'>
            <input
              type="text"
              placeholder="Coupon code"
              value={couponInput}
              onChange={e => setCouponInput(e.target.value)}
              className="flex-grow py-2 px-4 border rounded-[8px] h-[58px] text-left focus:ring focus:ring-skyblue w-full bg-grey-100 border-grey-300"
              disabled={validating}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-row w-full gap-2">
            {couponDetails && couponDetails.valid && (
              <button
                type="button"
                className="flex-1 cursor-pointer px-8 py-3.5 bg-tertiary text-white rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] text-base font-semibold leading-snug"
                onClick={handleRemove}
              >
                Remove
              </button>
            )}
            <button
              type="submit"
              disabled={validating}
              className="flex-1 cursor-pointer px-8 py-3.5 border border-tertiary rounded-[100px] text-tertiary hover:bg-tertiary hover:text-white text-base font-semibold leading-snug"
            >
              Apply coupon
            </button>
          </div>
        </div>
      </div>
      {error && <div className="text-red-600 text-base text-center">{error}</div>}
      {couponDetails && couponDetails.valid && (
        <div className="text-green-700 text-center text-sm absolute -bottom-10 w-full">
          Coupon applied successfully: {couponDetails.description || couponDetails.type} (
          {couponDetails.amount}
          {couponDetails.type === 'percent' ? '%' : '$'})
        </div>
      )}
      {couponDetails && !couponDetails.valid && (
        <div className="text-red-600 text-center text-sm absolute -bottom-10 w-full">
          Invalid coupon: {couponDetails.error}
        </div>
      )}
    </form>
  );
}
