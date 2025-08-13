'use client';
import { useCartItems, getTotalPrice } from './cartStore';
import { useMemo, useState } from 'react';

export default function CartSummary({ selectedShipping, coupon, userMeta = {}, companyData = {} }) {
  const items = useCartItems();
  const subtotal = getTotalPrice(items);

  // --- Prices / coupon ---
  let couponDiscount = 0;
  let couponDescription = '';
  if (coupon?.valid) {
    const amount = Number(coupon.amount || 0);
    if (coupon.type === 'percent') {
      couponDiscount = Math.round(subtotal * (amount / 100));
      couponDescription = `${coupon.amount}% הנחה`;
    } else {
      couponDiscount = amount;
      couponDescription = `${coupon.amount} ₪ הנחה`;
    }
  }
  const total = Math.max(0, subtotal + (selectedShipping?.cost || 0) - couponDiscount);

  // --- One-time initial values (respect lock_profile/dummy_email ONLY for defaults) ---
  const initialForm = useMemo(() => {
    const lockAll = !!userMeta?.lock_profile;
    const dummyEmail = !!userMeta?.dummy_email;

    const base = {
      fullName: companyData.name || '',
      invoiceName: userMeta.invoice || '',
      email: userMeta.email_address || '',
      phone: userMeta.phone || '',
      city: userMeta.city || '',
      streetName: userMeta.street_address || '',
      streetNumber: userMeta.street_number || '',
    };

    if (lockAll) {
      // Clear all defaults (user can still type afterwards)
      return {
        fullName: '',
        invoiceName: '',
        email: '',
        phone: '',
        city: '',
        streetName: '',
        streetNumber: '',
      };
    }

    // Only clear email default if dummy_email is true
    if (dummyEmail) {
      return { ...base, email: '' };
    }

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; don't keep wiping user typing on prop changes

  const [form, setForm] = useState(initialForm);

  // --- Validation (invoiceName is optional) ---
  const errors = useMemo(() => {
    const e = {};
    const emailOk = form.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

    if (!form.fullName?.trim()) e.fullName = 'Required';
    if (!form.email?.trim()) e.email = 'Required';
    else if (!emailOk) e.email = 'Invalid email';
    if (!form.phone?.trim()) e.phone = 'Required';
    if (!form.city?.trim()) e.city = 'Required';
    if (!form.streetName?.trim()) e.streetName = 'Required';
    if (!form.streetNumber?.trim()) e.streetNumber = 'Required';

    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isCartEmpty = items.length === 0;

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const baseInput = 'border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 transition';
  const errorInput = 'border-red-500 focus:ring-red-500';

  const handleSubmit = () => {
    // Replace with your real checkout action
    console.log('Submitting order with data:', form);
  };

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold">סיכום הזמנה</h2>

      <div className="flex justify-between">
        <span>סכום ביניים:</span>
        <span className="font-bold">{subtotal} ₪</span>
      </div>

      {selectedShipping && (
        <div className="flex justify-between">
          <span>משלוח:</span>
          <span className="font-bold">
            {selectedShipping.label}{' '}
            {Number(selectedShipping.cost) === 0 ? '(חינם)' : `(${selectedShipping.cost} ₪)`}
          </span>
        </div>
      )}

      {coupon?.valid && (
        <div className="flex justify-between text-pink-600 font-bold">
          <span>קופון:</span>
          <span>
            {coupon.description || couponDescription} &nbsp; (-{couponDiscount} ₪)
          </span>
        </div>
      )}

      <div className="flex justify-between text-lg">
        <span>סה&quot;כ לתשלום:</span>
        <span className="font-bold">{total} ₪</span>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!hasErrors && !isCartEmpty) handleSubmit();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              name="fullName"
              placeholder="Full Name"
              value={form.fullName}
              onChange={handleChange}
              className={`${baseInput} ${errors.fullName ? errorInput : ''} w-full`}
            />
            {errors.fullName && <p className="text-red-600 text-sm mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <input
              name="invoiceName"
              placeholder="Invoice Name (optional)"
              value={form.invoiceName}
              onChange={handleChange}
              className={`${baseInput} w-full`}
            />
          </div>
        </div>

        <div className="mt-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className={`${baseInput} ${errors.email ? errorInput : ''} w-full`}
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              name="phone"
              placeholder="Phone"
              value={form.phone}
              onChange={handleChange}
              className={`${baseInput} ${errors.phone ? errorInput : ''} w-full`}
            />
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
          </div>

          <div>
            <input
              name="city"
              placeholder="City"
              value={form.city}
              onChange={handleChange}
              className={`${baseInput} ${errors.city ? errorInput : ''} w-full`}
            />
            {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city}</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              name="streetName"
              placeholder="Street Name"
              value={form.streetName}
              onChange={handleChange}
              className={`${baseInput} ${errors.streetName ? errorInput : ''} w-full`}
            />
            {errors.streetName && <p className="text-red-600 text-sm mt-1">{errors.streetName}</p>}
          </div>

          <div>
            <input
              name="streetNumber"
              placeholder="Street Number"
              value={form.streetNumber}
              onChange={handleChange}
              className={`${baseInput} ${errors.streetNumber ? errorInput : ''} w-full`}
            />
            {errors.streetNumber && (
              <p className="text-red-600 text-sm mt-1">{errors.streetNumber}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isCartEmpty || hasErrors}
          className={`w-full mt-6 py-3 rounded-lg font-semibold text-white transition
            ${isCartEmpty || hasErrors ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
          `}
          title={
            isCartEmpty ? 'העגלה ריקה' : hasErrors ? 'נא למלא את כל השדות הנדרשים' : 'שליחת הזמנה'
          }
        >
          המשך לתשלום
        </button>
      </form>
    </div>
  );
}
