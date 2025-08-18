// /src/components/CartSummary.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCartItems, getTotalPrice } from './cartStore';
import { generateCartThumbUrlFromItem } from '@/utils/cloudinaryMockup';

export default function CartSummary({ selectedShipping, coupon, userMeta = {}, companyData = {} }) {
  // 1) Raw items from the store
  const rawItems = useCartItems();

  // 2) Resolve logos object defensively from companyData
  const companyLogos = useMemo(() => {
    // expect shape: { logo_darker:{url,width,height}, logo_lighter:{...}, back_darker:{...}, back_lighter:{...} }
    return companyData?.companyLogos || companyData?.logos || companyData?.acf?.company_logos || {};
  }, [companyData]);

  // Optional per-page/per-product placement overrides or "back" permissions if you have them
  const pagePlacementMap = companyData?.pagePlacementMap || undefined;
  const customBackAllowedSet =
    companyData?.customBackAllowedSet ||
    (Array.isArray(companyData?.backAllowedIds)
      ? new Set(companyData.backAllowedIds.map(String))
      : undefined);

  // 3) Build a **compact + enriched** copy of items for checkout
  const items = useMemo(() => {
    return (rawItems || []).map((it, idx) => {
      // Base thumbnail preference:
      // - For Group items prefer the color's own thumbnail if present
      // - Otherwise fall back to the product/item thumbnail
      const baseThumb =
        it?.options?.group_type === 'Group'
          ? it?.options?.color_thumbnail_url || it?.thumbnail || ''
          : it?.thumbnail || '';

      // Cloudinary mockup (logo applied on top of baseThumb using placements)
      const mockup_url = generateCartThumbUrlFromItem(it, companyLogos, {
        max: 400,
        pagePlacementMap,
        customBackAllowedSet,
      });

      // Keep only fields the backend actually needs to compute totals/order
      // (remove heavy product snapshots/ACF blobs).
      const compact = {
        key: `${it.product_id}:${idx}`, // stable row key if you need it on the server
        product_id: it.product_id,
        name: it.name,
        quantity: it.quantity,
        price: it.price, // unit price
        options: it.options || {},

        // Placements (percent units). If present on the item keep them;
        // otherwise keep minimal reference so WP can resolve by product id.
        placement_coordinates: Array.isArray(it?.placement_coordinates)
          ? it.placement_coordinates
          : Array.isArray(it?.product?.placement_coordinates)
            ? it.product.placement_coordinates
            : [],

        // Thumbs
        thumbnail: baseThumb, // original base/thumb we showed to user
        mockup_url: mockup_url || baseThumb, // generated URL (falls back to base if not cloudinary)
      };

      // Minimal product reference (id only) — handy if your WP code resolves defaults by product
      compact.product = { id: it?.product?.id || it.product_id };

      return compact;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, companyLogos, pagePlacementMap, customBackAllowedSet]);

  // 4) Totals (unchanged) — calculated from the compact/enriched items
  const subtotal = getTotalPrice(items);

  let couponDiscount = 0;
  let couponDescription = '';
  if (coupon?.valid) {
    const amount = Number(coupon.amount || 0);
    if (coupon.type === 'percent') {
      couponDiscount = Math.round(subtotal * (amount / 100));
      couponDescription = `${coupon.amount}% הנחה`;
    } else if (coupon.type === 'fixed') {
      couponDiscount = Math.min(subtotal, Math.round(amount));
      couponDescription = `₪${amount} הנחה`;
    }
  }

  const shippingCost = Number(selectedShipping?.cost || 0);
  const total = Math.max(0, subtotal - couponDiscount + shippingCost);

  // 5) Form (keeps your lock_profile / dummy_email behavior)
  const initialForm = useMemo(() => {
    const dummyEmail = !!userMeta?.dummy_email;
    const locked = !!userMeta?.lock_profile;
    const base = {
      fullName: locked ? '' : userMeta?.full_name || '',
      email: locked || dummyEmail ? '' : userMeta?.email || '',
      phone: locked ? '' : userMeta?.phone || '',
      city: locked ? '' : userMeta?.city || '',
      streetName: locked ? '' : userMeta?.street_name || '',
      streetNumber: locked ? '' : userMeta?.street_number || '',
      invoiceName: '',
    };
    if (dummyEmail) base.email = '';
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState(initialForm);

  const errors = useMemo(() => {
    const e = {};
    const req = ['fullName', 'email', 'phone', 'city', 'streetName', 'streetNumber'];
    req.forEach(k => {
      if (!(form?.[k] || '').toString().trim()) e[k] = 'שדה חובה';
    });
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'אימייל לא תקין';
    if (form.phone && !/^[0-9+\-()\s]{9,15}$/.test(form.phone)) e.phone = 'טלפון לא תקין';
    return e;
  }, [form]);

  const hasErrors = Object.keys(errors).length > 0;
  const isCartEmpty = !Array.isArray(items) || items.length === 0;

  // 6) Payment flow
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);

  async function handleSubmit() {
    setErrorMsg('');
    setPaying(true);
    try {
      const resp = await fetch('/api/payments/zcredit/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form,
          // ⬇️ Send the enriched, compact array
          items,
          selectedShipping,
          coupon: coupon?.valid ? coupon : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Create session failed');
      setPaymentUrl(data.paymentUrl);
      setShowPayModal(true);
    } catch (e) {
      setErrorMsg(e?.message || 'שגיאת תשלום');
    } finally {
      setPaying(false);
    }
  }

  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'ZCREDIT_SUCCESS') {
        const id = e.data?.transactionUniqueId || '';
        window.location.href = `/payment/zcredit/return?status=success&transactionUniqueId=${encodeURIComponent(
          id
        )}`;
      }
      if (e.data?.type === 'ZCREDIT_ERROR') {
        setShowPayModal(false);
        setErrorMsg('התשלום נכשל או בוטל');
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>סכום ביניים</span>
          <span>₪{subtotal.toLocaleString('he-IL')}</span>
        </div>
        {couponDiscount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{couponDescription || 'קופון'}</span>
            <span>-₪{couponDiscount.toLocaleString('he-IL')}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>משלוח</span>
          <span>{shippingCost > 0 ? `₪${shippingCost.toLocaleString('he-IL')}` : 'חינם'}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-semibold text-lg">
          <span>לתשלום</span>
          <span>₪{total.toLocaleString('he-IL')}</span>
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!isCartEmpty && !hasErrors && !paying) handleSubmit();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ['fullName', 'שם מלא'],
            ['email', 'אימייל'],
            ['phone', 'טלפון'],
            ['city', 'עיר'],
            ['streetName', 'רחוב'],
            ['streetNumber', "מס' בית"],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm">
              <div className="mb-1">{label}</div>
              <input
                value={form[key] || ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className={`w-full border rounded px-3 py-2 outline-none ${
                  errors[key] ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors[key] && <div className="text-red-600 text-xs mt-1">{errors[key]}</div>}
            </label>
          ))}
          <label className="block text-sm md:col-span-2">
            <div className="mb-1">שם לחשבונית (אופציונלי)</div>
            <input
              value={form.invoiceName || ''}
              onChange={e => setForm(f => ({ ...f, invoiceName: e.target.value }))}
              className="w-full border rounded px-3 py-2 outline-none border-gray-300"
            />
          </label>
        </div>

        {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}

        <button
          type="submit"
          disabled={isCartEmpty || hasErrors || paying}
          className={`w-full mt-4 py-3 rounded-lg font-semibold text-white transition ${
            isCartEmpty || hasErrors || paying
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title={
            isCartEmpty ? 'העגלה ריקה' : hasErrors ? 'נא למלא את כל השדות הנדרשים' : 'המשך לתשלום'
          }
        >
          {paying ? 'מעבד תשלום…' : 'המשך לתשלום'}
        </button>
      </form>

      {showPayModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">תשלום מאובטח</h3>
              <button onClick={() => setShowPayModal(false)} className="p-2" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="h-[70vh]">
              {paymentUrl ? (
                <iframe
                  src={paymentUrl}
                  title="Z-Credit Payment"
                  className="w-full h-full"
                  allow="payment *"
                />
              ) : (
                <div className="h-full flex items-center justify-center">טוען…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
