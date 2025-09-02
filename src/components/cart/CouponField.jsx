'use client';
import { useState, useMemo } from 'react';

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
      setError('שגיאה באימות קופון'); // "Error validating coupon"
    }
  };

  const handleRemove = () => {
    setError(null);
    onRemoveCoupon?.();
  };

  return (
    <form onSubmit={handleApply} className="relative mt-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-col gap-3">
        <div className="flex flex-col justify-between sm:flex-row gap-2 items-center">
          <div>
            <input
              type="text"
              placeholder="קוד קופון"
              value={couponInput}
              onChange={e => setCouponInput(e.target.value)}
              className="flex-grow py-2 px-4 border rounded-lg text-right focus:ring focus:ring-skyblue"
              disabled={validating}
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            {couponDetails && couponDetails.valid && (
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-bold transition"
                onClick={handleRemove}
              >
                הסר
              </button>
            )}
            <button
              type="submit"
              disabled={validating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold transition"
            >
              החל קופון
            </button>
          </div>
        </div>
      </div>
      {error && <div className="text-red-600 text-base text-center">{error}</div>}
      {couponDetails && couponDetails.valid && (
        <div className="text-green-700 text-center text-sm">
          קופון הופעל בהצלחה: {couponDetails.description || couponDetails.type} (
          {couponDetails.amount}
          {couponDetails.type === 'percent' ? '%' : '₪'})
        </div>
      )}
      {couponDetails && !couponDetails.valid && (
        <div className="text-red-600 text-center text-sm">קופון שגוי: {couponDetails.error}</div>
      )}
    </form>
  );
}
