// /src/components/Checkout.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCartItems, getTotalPrice } from './cartStore';
import { generateHoverThumbUrlFromItem } from '@/utils/cloudinaryMockup';

export default function Checkout({
  selectedShipping,
  coupon,
  userMeta = {},
  companyData = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
  slug = '',
}) {
  // 1) Raw items from the cart store
  const rawItems = useCartItems();

  console.log('Checkout::userMeta', { userMeta });
  // 2) Resolve logos object defensively from companyData
  const companyLogos = useMemo(() => {
    if (!userMeta) return {};

    const logoTypes = ['logo_darker', 'logo_lighter', 'back_darker', 'back_lighter'];

    return logoTypes.reduce(
      (acc, type) => ({
        ...acc,
        [type]: { ...userMeta[type] },
      }),
      {}
    );
  }, [userMeta]);

  console.log('Checkout::companyLogos', { companyLogos });
  console.log('Checkout::rawItems', { rawItems });

  // Helper to safely read strings
  const s = v => (v == null ? '' : String(v));

  // 3) Build **products** for ml_create_order() (no PHP changes needed)
  const products = useMemo(() => {
    return (rawItems || []).flatMap((it, idx) => {
      // Base thumb (what user saw)
      const baseThumb =
        it?.options?.group_type === 'Group'
          ? it?.options?.color_thumbnail_url || it?.thumbnail || ''
          : it?.thumbnail || '';

      // Cloudinary mockups (square thumb + full)
      const thumbUrl = generateHoverThumbUrlFromItem(it, companyLogos, {
        max: 400,
        customBackAllowedSet, // ❌ no pagePlacementMap here — cart is frozen
      });

      console.log('🎨 thumbUrl', thumbUrl, it, companyLogos, customBackAllowedSet);

      const fullUrl = generateHoverThumbUrlFromItem(it, companyLogos, {
        max: 1400,
        customBackAllowedSet,
      });

      // Placement → human title (e.g. "Front, Back")
      const artItemTitle = (
        Array.isArray(it?.placement_coordinates)
          ? it.placement_coordinates
          : Array.isArray(it?.product?.placement_coordinates)
            ? it.product.placement_coordinates
            : []
      )
        .filter(p => p && p.active)
        .map(p => s(p.name))
        .filter(Boolean)
        .join(', ');

      // Try to extract color/size data commonly used in your cart options
      const colorName = s(it?.options?.color || it?.options?.color_name);
      const sizeName = s(it?.options?.size || it?.options?.size_name);

      // Optional extras your PHP looks for (safe defaults if absent)
      const alarnd_color_key =
        it?.options?.color_index != null ? String(it.options.color_index) : '';
      const alarnd_custom_color = s(it?.options?.custom_color_hex);
      const alarnd_step_key = s(it?.options?.step_key);
      const default_dark_logo = s(companyLogos?.logo_darker?.url);
      const alarnd_artwork_id = s(it?.options?.artwork_id);
      const alarnd_artwork_id2 = s(it?.options?.artwork_id2);
      const group_type = s(it?.options?.line_type);
      const placement_signature = s(it?.placement_signature);

      // Single product entry per cart line:
      return [
        {
          // REQUIRED by ml_create_order loop:
          product_id: it.product_id,
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),

          // Common product options (PHP adds as order item meta)
          color: colorName,
          size: sizeName,

          // Extra keys ml_create_order reads (safe to be empty strings):
          alarnd_color_key,
          alarnd_custom_color,
          alarnd_step_key,
          placement_title_map: artItemTitle,
          default_dark_logo,
          alarnd_artwork_id,
          alarnd_artwork_id2,
          placement_signature,
          group_type,

          // Cloudinary thumbs: PHP uses `_cloudinary_thumbnail` meta and also prints <img>
          cloudinary_thumbnail: {
            thumb: thumbUrl || baseThumb || '',
            full: fullUrl || thumbUrl || baseThumb || '',
          },

          // (Optional) anything else you want the server to have for logs/debug
          // placement_signature: s(it?.placement_signature),
          // filter_was_changed: !!it?.filter_was_changed,
        },
      ];
    });
  }, [rawItems, companyLogos, pagePlacementMap, customBackAllowedSet]);

  // 4) Totals — calculated from the products (unit price * qty)
  const subtotal = getTotalPrice(products);

  console.log('products', products);
  console.log('subtotal', subtotal);

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
      fullName: locked ? '' : userMeta?.full_name || companyData?.name || '',
      email: locked || dummyEmail ? '' : userMeta?.email_address || '',
      phone: locked ? '' : userMeta?.phone || '',
      city: locked ? '' : userMeta?.city || '',
      streetName: locked ? '' : userMeta?.street_address || '',
      streetNumber: locked ? '' : userMeta?.street_number || '',
      invoiceName: locked ? '' : userMeta?.invoice || '',
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
  const isCartEmpty = !Array.isArray(products) || products.length === 0;

  // 6) Payment flow
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);

  // === Build ml_create_order-compatible payload ===
  const shipping_method_info = useMemo(() => {
    if (!selectedShipping) return {};
    // Your PHP uses: id, title, cost
    return {
      id: selectedShipping.id ?? selectedShipping.method_id ?? '',
      title: selectedShipping.title ?? selectedShipping.label ?? '',
      cost: Number(selectedShipping.cost || 0),
    };
  }, [selectedShipping]);

  const customerInfo = useMemo(
    () => ({
      customer_name: s(form.fullName),
      customer_phone: s(form.phone),
      customer_email: s(form.email),
      invoice_name: s(form.invoiceName),
      customer_city: s(form.city),
      customer_address: s(form.streetName),
      customer_address_number: s(form.streetNumber),
    }),
    [form]
  );

  // Woo set_address expects Woo keys; we provide sensible fields.
  const shippingInfo = useMemo(
    () => ({
      first_name: s(form.fullName),
      email: s(form.email),
      phone: s(form.phone),
      city: s(form.city),
      address_1: `${s(form.streetName)} ${s(form.streetNumber)}`.trim(),
      // Optional extras; Woo ignores unknown keys safely
      address_number: s(form.streetNumber),
      company: s(form.invoiceName),
    }),
    [form]
  );

  async function handleSubmit() {
    console.log('slug', slug);
    setErrorMsg('');
    setPaying(true);
    try {
      // Optional user id for PHP proof_id (updates user meta etc.)
      const proof_id =
        Number(userMeta?.id || userMeta?.user_id || 0) > 0
          ? Number(userMeta?.id || userMeta?.user_id || 0)
          : '';

      // This object matches ml_create_order($data) schema
      const wpPayload = {
        proof_id,
        products,
        customerInfo,
        shipping_method_info,
        shippingInfo,
        // The rest are optional in your PHP:
        // cardNumber: '',
        extraMeta: {},
        response: {},
        note: '',
        slug,
        pageSlug: slug || null,
        // update: true|false  (handled by your server after payment callback)
        // token_update: false,
      };

      const resp = await fetch('/api/payments/zcredit/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // What the Next.js route needs to create ZCredit session:
          // (keep sending coupon so the API can apply it to Woo cart before order create)
          coupon: coupon?.valid ? coupon : null,
          // pass page slug
          pageSlug: slug || null,
          // And pass-through for ml_create_order (server will call it using this):
          orderData: wpPayload,
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
        window.location.href = `/payment/zcredit/return?status=success&slug=${slug}&transactionUniqueId=${encodeURIComponent(
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
          className={`w-full cursor-pointer mt-4 py-3 rounded-lg font-semibold text-white transition ${
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
