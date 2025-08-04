'use client';
import { useCartItems, getTotalPrice } from './cartStore';
import { useState } from 'react';

export default function CartSummary({ selectedShipping, zCreditToken, coupon, userMeta = {} }) {
  console.log("userMeta", userMeta);
  const items = useCartItems();
  const subtotal = getTotalPrice(items);

  // Coupon discount calculation
  let couponDiscount = 0;
  let couponDescription = '';
  if (coupon && coupon.valid) {
    const couponAmount = Number(coupon.amount); // <-- force number!
    if (coupon.type === 'percent') {
      couponDiscount = Math.round(subtotal * (couponAmount / 100));
      couponDescription = `${coupon.amount}% הנחה`;
    } else {
      couponDiscount = couponAmount;
      couponDescription = `${coupon.amount} ₪ הנחה`;
    }
  }

  console.log("coupon", coupon);
  console.log("selectedShipping", selectedShipping);
  console.log("subtotal", subtotal);

  const total =
    Math.max(
      0,
      subtotal + (selectedShipping?.cost || 0) - couponDiscount
    );

  const [form, setForm] = useState({
    fullName: (userMeta.first_name || '') + (userMeta.last_name ? ' ' + userMeta.last_name : ''),
    invoiceName: userMeta.invoice || '',
    email: userMeta.user_email || '',
    phone: userMeta.phone || '',
    city: userMeta.city || '',
    streetName: userMeta.streetName || '',
    streetNumber: userMeta.streetNumber || ''
  });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = () => {
    // Example: open Z‑Credit checkout form (iframe or redirect) with token + form-data
    // Use your Z‑Credit JS integration per API documentation
    window.ZCredit && window.ZCredit.open({ token: zCreditToken, fields: form });
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
          <span className="font-bold">{selectedShipping.label} ({selectedShipping.cost} ₪)</span>
        </div>
      )}
      {coupon && coupon.valid && (
        <div className="flex justify-between text-pink-600 font-bold">
          <span>קופון:</span>
          <span>
            {coupon.description || couponDescription} &nbsp; (-{couponDiscount} ₪)
          </span>
        </div>
      )}
      <div className="flex justify-between text-lg">
        <span>סה"כ לתשלום:</span>
        <span className="font-bold">{total} ₪</span>
      </div>

      {/* Z-Credit Custom Form */}
      <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="fullName"
            placeholder="Full Name"
            required
            value={form.fullName}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            name="invoiceName"
            placeholder="Invoice Name"
            required
            value={form.invoiceName}
            onChange={handleChange}
            className="border p-2 rounded"
          />
        </div>
        <div className="mt-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="phone"
            placeholder="Phone"
            required
            value={form.phone}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            name="city"
            placeholder="City"
            required
            value={form.city}
            onChange={handleChange}
            className="border p-2 rounded"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="streetName"
            placeholder="Street Name"
            required
            value={form.streetName}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            name="streetNumber"
            placeholder="Street Number"
            required
            value={form.streetNumber}
            onChange={handleChange}
            className="border p-2 rounded"
          />
        </div>
        <button
          type="submit"
          disabled={!zCreditToken}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
        >
          המשך לתשלום Z‑Credit
        </button>
      </form>
    </div>
  );
}
