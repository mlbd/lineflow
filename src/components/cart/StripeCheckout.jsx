// /src/components/StripeCheckout.jsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useCartItems, useCustomerNote, useClearCart, useCoupon } from './cartStore';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from '@stripe/react-stripe-js';

// Publishable key must be exposed to client (NEXT_PUBLIC_)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// ---------- UI helpers ----------
const inputCls =
  'w-full border rounded px-3 py-2 outline-none border-gray-300 bg-white text-gray-700';
const labelCls = 'block text-sm';
const sectionCard = 'bg-white border rounded-lg p-6';

// Floating input styles (66px height + animated label)
const floatInput =
  'peer block w-full h-[66px] rounded border border-gray-300 bg-white text-gray-800 ' +
  'px-3 pt-6 pb-2 outline-none placeholder-transparent transition ' +
  'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500';
const floatLabelBase =
  'pointer-events-none absolute left-3 transition-all duration-150 text-gray-500';
const floatLabelRest = 'top-1/2 -translate-y-1/2';
const floatLabelRaised = 'top-2 text-xs translate-y-0 text-gray-600';

// ---- Local helpers ----
function toProducts(items = []) {
  // Normalize your cart items to a minimal product line array
  return (Array.isArray(items) ? items : []).map(it => ({
    product_id: it.product_id,
    quantity: Number(it.quantity || 0),
    price: Number(it.price || 0),
  }));
}

function calcSubtotal(products = []) {
  return (Array.isArray(products) ? products : []).reduce(
    (sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 0),
    0
  );
}

function getShippingCost(selectedShipping) {
  const v = Number(
    selectedShipping?.price ?? selectedShipping?.cost ?? selectedShipping?.amount ?? 0
  );
  return Number.isFinite(v) ? v : 0;
}

// [PATCH] Updated CountrySelect to only allow United States (US)
function CountrySelect({ valueCode, onChange, className = '' }) {
  // Ensure form state is always US
  useEffect(() => {
    if (valueCode !== 'US') {
      onChange?.({ code: 'US', label: 'United States' });
    }
  }, [valueCode, onChange]);

  return (
    <select
      className={`${inputCls} ${className}`}
      value="US"
      onChange={() => onChange?.({ code: 'US', label: 'United States' })}
      required
    >
      <option value="US">United States</option>
    </select>
  );
}

export default function StripeCheckout(props) {
  return (
    <Elements stripe={stripePromise} options={{ locale: 'en' }}>
      <StripeCheckoutInner {...props} />
    </Elements>
  );
}

function StripeCheckoutInner({
  selectedShipping,
  coupon,
  userMeta = {},
  companyData = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
  slug = '',
  onClearCart, // optional callback from parent to clear cart
}) {
  // [PATCH] Added prefill control flags (lock_profile & dummy_email)
  const locked = !!userMeta?.lock_profile;
  const dummyEmail = !!userMeta?.dummy_email;

  const items = useCartItems();
  // [PATCH] Get clearCart action from the zustand cart store
  const clearCartStore = useClearCart();
  const couponObj = coupon && coupon.valid ? coupon : null;
  const customerNote = useCustomerNote();

  // Left column form (defaults: Country = United States)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'United States',
    countryCode: 'US',
    address: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    cardholder: '',
  });

  // [PATCH] Added Stripe Elements completeness state
  const [cardComplete, setCardComplete] = useState(false);
  const [expComplete, setExpComplete] = useState(false);
  const [cvcComplete, setCvcComplete] = useState(false);

  // [PATCH] Added: key to force-remount Stripe Elements when resetting the form
  const [cardElementsKey, setCardElementsKey] = useState(0);

  // [PATCH] Added a helper to compute prefill from userMeta respecting lock_profile & dummy_email
  // Place this just after the `const [cvcComplete, setCvcComplete] = useState(false);`
  const computePrefill = useCallback(
    base => ({
      ...base,
      // Email honors both lock_profile and dummy_email
      email:
        locked || dummyEmail
          ? ''
          : userMeta?.email_address || userMeta?.email_adress || base.email || '',
      // Phone/City only honor lock_profile
      phone: locked ? base.phone : userMeta?.phone || base.phone || '',
      city: locked ? base.city : userMeta?.city || base.city || '',
      // (Optional examples for future use, kept commented to avoid changing prior behavior)
      // firstName: locked ? base.firstName : (userMeta?.full_name ? String(userMeta.full_name).split(' ')[0] : base.firstName),
      // lastName:  locked ? base.lastName  : (userMeta?.full_name ? String(userMeta.full_name).split(' ').slice(1).join(' ') : base.lastName),
      // address:   locked ? base.address   : ([userMeta?.street_number, userMeta?.street_address].filter(Boolean).join(' ') || base.address),
    }),
    [locked, dummyEmail, userMeta]
  );

  // [PATCH] Update the initial prefill effect to use computePrefill helper
  // Replace the existing useEffect that prefilled email/phone/city with the block below.
  useEffect(() => {
    setForm(f =>
      computePrefill({
        ...f,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [PATCH] Added: resetStripeElements helper to clear iframe fields
  function resetStripeElements() {
    try {
      if (elements) {
        const numberEl = elements.getElement(CardNumberElement);
        const expEl = elements.getElement(CardExpiryElement);
        const cvcEl = elements.getElement(CardCvcElement);
        // Clear values if mounted
        numberEl?.clear?.();
        expEl?.clear?.();
        cvcEl?.clear?.();
      }
    } catch (e) {
      console.warn('[stripe] clear elements failed:', e);
    }
    // Force remount as a fallback across browsers (e.g., Safari)
    setCardElementsKey(k => k + 1);

    // Also reset completeness gates so CTA stays disabled until user re-enters card
    setCardComplete(false);
    setExpComplete(false);
    setCvcComplete(false);
  }

  // [PATCH] Add a reset function that clears the form to defaults, then re-applies userMeta prefill
  // Find the existing resetFormWithPrefill() and append the call as shown below:

  function resetFormWithPrefill() {
    const base = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: 'United States',
      countryCode: 'US',
      address: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      cardholder: '',
    };
    setForm(computePrefill(base));

    // [PATCH] Reset Stripe Elements too (card number / expiry / cvc)
    resetStripeElements();
  }

  // ---------- 2) Still inside StripeCheckoutInner — add a prefill effect (once) ----------
  // [PATCH] Prefill form values from userMeta (email/phone/city) respecting lock_profile & dummy_email
  useEffect(() => {
    setForm(f => ({
      ...f,
      email:
        locked || dummyEmail
          ? ''
          : userMeta?.email_address || userMeta?.email_adress || f.email || '',
      phone: locked ? f.phone : userMeta?.phone || f.phone || '',
      city: locked ? f.city : userMeta?.city || f.city || '',
      // (Optional) You can uncomment the following lines if you'd also like to prefill names/addresses safely:
      // firstName: locked ? f.firstName : (userMeta?.full_name ? String(userMeta.full_name).split(' ')[0] : f.firstName),
      // lastName:  locked ? f.lastName  : (userMeta?.full_name ? String(userMeta.full_name).split(' ').slice(1).join(' ') : f.lastName),
      // address:   locked ? f.address   : ([userMeta?.street_number, userMeta?.street_address].filter(Boolean).join(' ') || f.address),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- 3) Update canSubmit logic to include Stripe Element completeness ----------
  const stripe = useStripe();
  const elements = useElements();

  const products = useMemo(() => toProducts(items), [items]);
  const shippingCost = useMemo(() => getShippingCost(selectedShipping), [selectedShipping]);
  const subtotal = useMemo(() => calcSubtotal(products), [products]);
  const total = useMemo(() => {
    // Display-only math; server validates again
    let subtotalCents = Math.round(Number(subtotal || 0) * 100);
    const shippingCents = Math.round(Number(shippingCost || 0) * 100);
    let discountCents = 0;
    if (couponObj && couponObj.valid) {
      const type = String(couponObj.type || couponObj.discount_type || '').toLowerCase();
      const amount = Number(couponObj.amount || 0);
      if (['percent', 'percentage', 'percent_cart'].includes(type)) {
        discountCents = Math.round((subtotalCents * amount) / 100);
      } else if (['fixed', 'fixed_cart'].includes(type)) {
        discountCents = Math.min(subtotalCents, Math.round(amount * 100));
      }
    }
    const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
    return totalCents / 100;
  }, [subtotal, shippingCost, couponObj]);

  // -------- Required fields gating (disable button until valid + non-zero total + card fields complete) --------
  const isFormValid = !!(
    form.firstName &&
    form.lastName &&
    form.email &&
    form.phone &&
    form.countryCode &&
    form.address &&
    form.city &&
    form.zip
  );

  // [PATCH] Updated canSubmit to require card/exp/cvc completeness
  const canSubmit = !!(
    stripe &&
    isFormValid &&
    Number(total) > 0 &&
    cardComplete &&
    expComplete &&
    cvcComplete
  );

  const [status, setStatus] = useState({ kind: 'idle' }); // idle | paying | finalizing | success | error

  // Guards to avoid reconfirming the same PI and to block double-submit
  const lastClientSecretRef = useRef(null);
  const confirmingRef = useRef(false);

  // Build Woo-friendly customer object (keys like Woo expects)
  const customerForWoo = {
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone: form.phone,
    country: form.countryCode, // ISO 2 (US, GB, BD, …)
    state: form.state,
    city: form.city,
    postcode: form.zip,
    address_1: form.address,
    address_2: form.address2,
  };

  // Map products -> items (stable key)
  const itemsForSnapshot = products.map((p, idx) => ({
    key: `${p?.product_id ?? ''}:${idx}`,
    ...p,
  }));

  // [PATCH] Prefer clearing via cartStore; still call parent callback if provided.
  // Also keep server/local fallbacks.
  async function tryClearCart() {
    try {
      // Primary: clear from local zustand store
      clearCartStore?.();
    } catch (_) {}

    try {
      // Back-compat: let host app do extra cleanup if it wants
      onClearCart?.();
    } catch (_) {}
  }

  // === 1) ADD: new server-authoritative verifier ===
  // [PATCH] Added verifyAndCreateOrder (server decides success; client only reflects it)
  // Place this helper near your other helpers (e.g., right above handlePay or where finalizeOrder used to be).
  async function verifyAndCreateOrder(
    intentId,
    {
      customerForWoo,
      itemsForSnapshot,
      customerNote,
      selectedShipping,
      couponObj,
      slug,
      setStatus,
      confirmingRef,
    }
  ) {
    const res = await fetch('/api/payments/stripe/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId,
        snapshot: {
          customer: customerForWoo,
          items: itemsForSnapshot,
          note: customerNote || '',
          shipping: selectedShipping || null,
          coupon: couponObj || null,
          page_slug: slug || null,
        },
      }),
    });

    if (!res.ok) {
      let msg = 'Finalize failed';
      try {
        const j = await res.json();
        msg = j?.error || msg;
      } catch {
        const t = await res.text();
        msg = `${msg}: ${t}`;
      }
      setStatus({ kind: 'error', message: msg });
      confirmingRef.current = false;
      return;
    }

    const data = await res.json();
    setStatus({ kind: 'success', data });
    confirmingRef.current = false;
  }

  // Shared finalizer: verifies with server & creates WP order
  async function finalizeOrder(intentId) {
    return verifyAndCreateOrder(intentId, {
      customerForWoo,
      itemsForSnapshot,
      customerNote,
      selectedShipping,
      couponObj,
      slug,
      setStatus,
      confirmingRef,
    });
  }

  // Main submit
  async function handlePay(e) {
    e?.preventDefault?.();
    if (!stripe || !elements) return;
    if (!canSubmit) return;
    if (status.kind === 'paying' || status.kind === 'finalizing' || confirmingRef.current) return; // prevent double submit

    try {
      setStatus({ kind: 'paying', message: 'Processing payment…' });

      // [PATCH] Added a per-click attemptId to force a fresh PaymentIntent for each checkout attempt
      const attemptId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      console.log('[checkout] attemptId', attemptId, 'items', products, 'total preview', total);

      // 1) Server: create intent (server recomputes amount & validates)
      const createRes = await fetch('/api/payments/stripe/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: products,
          coupon: couponObj,
          shippingCost,
          customer: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            address: {
              country: form.countryCode,
              line1: form.address,
              line2: form.address2,
              city: form.city,
              state: form.state,
              postal_code: form.zip,
            },
          },
          note: customerNote || '',
          slug,
          // [PATCH] new
          attemptId,
        }),
      });

      if (!createRes.ok) {
        let msg = 'Create intent failed';
        try {
          const j = await createRes.json();
          msg = j?.error || msg;
          if (j?.code) msg += ` (code: ${j.code})`;
        } catch {
          const t = await createRes.text();
          msg = `${msg}: ${t}`;
        }
        setStatus({ kind: 'error', message: msg });
        return;
      }

      const { clientSecret } = await createRes.json();

      // If we already handled this PI, don't reconfirm; just retrieve and continue
      if (lastClientSecretRef.current === clientSecret) {
        const { paymentIntent: piExisting } = await stripe.retrievePaymentIntent(clientSecret);
        if (piExisting?.status === 'succeeded') {
          setStatus({ kind: 'finalizing', message: 'Confirming payment & creating order…' });
          await verifyAndCreateOrder(piExisting.id, {
            customerForWoo,
            itemsForSnapshot,
            customerNote,
            selectedShipping,
            couponObj,
            slug,
            setStatus,
            confirmingRef,
          });
          return;
        }
      }
      lastClientSecretRef.current = clientSecret;

      // 2) Confirm with split Elements
      const card = elements.getElement(CardNumberElement);
      if (!card) {
        setStatus({
          kind: 'error',
          message: 'Card input not ready yet. Please wait a moment.',
        });
        return;
      }
      confirmingRef.current = true;

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: form.cardholder || `${form.firstName} ${form.lastName}`.trim(),
            email: form.email,
            phone: form.phone,
            address: {
              country: form.countryCode,
              line1: form.address,
              line2: form.address2 || undefined,
              city: form.city,
              state: form.state,
              postal_code: form.zip,
            },
          },
        },
      });

      if (error) {
        // If PI is already in a terminal state (often "succeeded"), treat as success
        if (error.code === 'payment_intent_unexpected_state') {
          try {
            const { paymentIntent: pi } = await stripe.retrievePaymentIntent(clientSecret);
            if (pi?.status === 'succeeded') {
              setStatus({ kind: 'finalizing', message: 'Confirming payment & creating order…' });
              await verifyAndCreateOrder(pi.id, {
                customerForWoo,
                itemsForSnapshot,
                customerNote,
                selectedShipping,
                couponObj,
                slug,
                setStatus,
                confirmingRef,
              });
              return;
            }
          } catch (e2) {
            console.error('[stripe:retrievePaymentIntent] failed', e2);
          }
        }

        const details = [
          error.message,
          error.code ? `code: ${error.code}` : null,
          error.decline_code ? `decline: ${error.decline_code}` : null,
          error.type ? `type: ${error.type}` : null,
          error.payment_intent?.status ? `pi_status: ${error.payment_intent.status}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        console.error('[stripe:confirmCardPayment] error', error);
        setStatus({ kind: 'error', message: details || 'Payment failed.' });
        confirmingRef.current = false;
        return;
      }

      if (paymentIntent?.status !== 'succeeded') {
        setStatus({
          kind: 'error',
          message: `Payment status: ${paymentIntent?.status || 'unknown'}`,
        });
        confirmingRef.current = false;
        return;
      }

      // 3) Finalize with WP (show overlay message while creating order)
      setStatus({ kind: 'finalizing', message: 'Confirming payment & creating order…' });
      await verifyAndCreateOrder(paymentIntent.id, {
        customerForWoo,
        itemsForSnapshot,
        customerNote,
        selectedShipping,
        couponObj,
        slug,
        setStatus,
        confirmingRef,
      });
    } catch (err) {
      console.error('[stripe:checkout] unexpected error', err);
      setStatus({
        kind: 'error',
        message: err?.message || 'Unexpected error.',
      });
      confirmingRef.current = false;
    }
  }

  // Clear cart once we have a successful order
  useEffect(() => {
    if (status.kind === 'success') {
      tryClearCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.kind]);

  // ---- UI ----
  return (
    <>
      <form onSubmit={handlePay} className="grid md:grid-cols-2 gap-6">
        {/* Left column (DO NOT touch Right column per requirement) */}
        <div className="space-y-6">
          <div className={sectionCard}>
            <div className="customer-info-section">
              <h3 className="text-lg font-semibold mb-4">Customer Info</h3>

              {/* Row: First / Last */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FloatingField
                  id="firstName"
                  label="First Name"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={v => setForm(f => ({ ...f, firstName: v }))}
                  required
                />
                <FloatingField
                  id="lastName"
                  label="Last Name"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={v => setForm(f => ({ ...f, lastName: v }))}
                  required
                />
              </div>

              {/* Row: Email / Phone (both required) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <FloatingField
                  id="email"
                  type="email"
                  label="Email"
                  placeholder="Email"
                  value={form.email}
                  onChange={v => setForm(f => ({ ...f, email: v }))}
                  required
                  autoComplete="email"
                />
                <FloatingField
                  id="phone"
                  label="Phone"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={v => setForm(f => ({ ...f, phone: v }))}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="shipping-address mt-6">
              <h3 className="text-lg font-semibold mb-4">Shipping Address</h3>

              {/* Country/Region (default: United States) */}
              <div className="relative">
                <CountrySelect
                  valueCode={form.countryCode}
                  onChange={({ code, label }) =>
                    setForm(f => ({ ...f, countryCode: code, country: label }))
                  }
                  className="h-[66px]"
                />
              </div>

              {/* Address line 1 (required) */}
              <div className="mt-3">
                <FloatingField
                  id="address1"
                  label="Address"
                  placeholder="Address"
                  value={form.address}
                  onChange={v => setForm(f => ({ ...f, address: v }))}
                  required
                  autoComplete="address-line1"
                />
              </div>

              {/* Address line 2 (optional) */}
              <div className="mt-3">
                <FloatingField
                  id="address2"
                  label="Additional Info (Optional)"
                  placeholder="Additional Info (Optional)"
                  value={form.address2}
                  onChange={v => setForm(f => ({ ...f, address2: v }))}
                  autoComplete="address-line2"
                />
              </div>

              {/* City / State / ZIP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <FloatingField
                  id="city"
                  label="City"
                  placeholder="City"
                  value={form.city}
                  onChange={v => setForm(f => ({ ...f, city: v }))}
                  required
                  autoComplete="address-level2"
                />
                <FloatingField
                  id="state"
                  label="State"
                  placeholder="State"
                  value={form.state}
                  onChange={v => setForm(f => ({ ...f, state: v }))}
                  autoComplete="address-level1"
                />
                <FloatingField
                  id="zip"
                  label="ZIP Code"
                  placeholder="ZIP Code"
                  value={form.zip}
                  onChange={v => setForm(f => ({ ...f, zip: v }))}
                  required
                  autoComplete="postal-code"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column (DON'T TOUCH payment fields / placeholders) */}
        <div className="space-y-6">
          <div className={sectionCard}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Payment Method</h3>
              <div className="text-xs text-gray-500">VISA • MasterCard</div>
            </div>

            <div className="space-y-3">
              <Field>
                <div className={`${inputCls} py-3`}>
                  <CardNumberElement
                    key={`card-number-${cardElementsKey}`}
                    options={{ showIcon: true }}
                    onChange={e => setCardComplete(!!e?.complete)}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field>
                  <div className={`${inputCls} py-3`}>
                    <CardExpiryElement
                      key={`card-expiry-${cardElementsKey}`}
                      onChange={e => setExpComplete(!!e?.complete)}
                    />
                  </div>
                </Field>
                <Field>
                  <div className={`${inputCls} py-3`}>
                    <CardCvcElement
                      key={`card-expiry-${cardElementsKey}`}
                      onChange={e => setCvcComplete(!!e?.complete)}
                    />
                  </div>
                </Field>
              </div>

              <FloatingField
                id="cardholder"
                label="Card Holder Name"
                placeholder="Card Holder Name"
                value={form.cardholder}
                onChange={v => setForm(f => ({ ...f, cardholder: v }))}
              />
            </div>

            {/* Summary */}
            <div className="bg-indigo-50 rounded-xl p-4 mt-6 text-sm">
              <Row k="Subtotal" v={`$${Number(subtotal).toFixed(2)}`} />
              <Row k="Shipping" v={shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'Free'} />
              {couponObj && (
                <Row k={couponObj?.code ? `Coupon (${couponObj.code})` : 'Coupon'} v="applied" />
              )}
              <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${Number(total).toFixed(2)}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={!canSubmit || status.kind === 'paying' || status.kind === 'finalizing'}
              aria-disabled={!canSubmit || status.kind === 'paying' || status.kind === 'finalizing'}
              aria-busy={status.kind === 'paying' || status.kind === 'finalizing'}
              className={`w-full cursor-pointer mt-4 py-3 rounded-lg font-semibold text-white transition ${
                !canSubmit || status.kind === 'paying' || status.kind === 'finalizing'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-900 hover:bg-indigo-800'
              }`}
            >
              {status.kind === 'paying' || status.kind === 'finalizing'
                ? 'Processing…'
                : 'Proceed to Payment'}
            </button>

            {status.kind === 'error' && (
              <div className="text-red-600 text-sm mt-3">{status.message}</div>
            )}
          </div>
        </div>
      </form>

      {/* Full-screen overlay while paying/finalizing (freezes cart & checkout) */}
      {(status.kind === 'paying' || status.kind === 'finalizing') && (
        <FullscreenOverlay message={status.message || 'Processing…'} />
      )}

      {/* Success Modal (order details) */}
      {status.kind === 'success' && (
        <OrderSuccessModal
          order={(status.data || {}).order}
          total={total}
          email={form.email}
          onClose={() => {
            resetFormWithPrefill();
            setStatus({ kind: 'idle' });
          }}
        />
      )}
    </>
  );
}

/* ------- Small presentational components ------- */

// [PATCH] Updated FloatingField to raise/animate the label when the input gains focus
function FloatingField({
  id,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  required = false,
  autoComplete,
}) {
  // [PATCH] Added focus state to trigger animation before typing
  const [isFocused, setIsFocused] = useState(false);

  // [PATCH] Decide if label should be raised based on focus OR existing value
  const raised = isFocused || (!!value && String(value).length > 0);

  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        className={floatInput} // h-[66px] with transitions already defined globally
        placeholder=" " // keep placeholder hidden; floating label acts as visual placeholder
        value={value}
        onChange={e => onChange?.(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        aria-label={label}
        // [PATCH] Animate label on focus/blur (cursor enters/leaves)
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {/* [PATCH] Use focus OR value to control label position */}
      <span className={`${floatLabelBase} ${raised ? floatLabelRaised : floatLabelRest}`}>
        {placeholder || label}
      </span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className={labelCls}>
      <div className="mb-1">{label}</div>
      {children}
    </label>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function FullscreenOverlay({ message = 'Processing…' }) {
  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm grid place-items-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-white rounded-xl px-6 py-5 shadow-xl flex items-center gap-4">
        <div className="h-6 w-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
        <div className="text-gray-800 font-medium">{message}</div>
      </div>
    </div>
  );
}

function OrderSuccessModal({ order, total, email, onClose }) {
  const orderId = order?.id || order?.order_id;
  return (
    <div className="fixed inset-0 z-[1001] bg-black/60 grid place-items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-xl font-semibold mb-2">Payment Successful ✅</h2>
        <p className="text-sm text-gray-600 mb-4">
          Your payment was successful and your order has been created.
        </p>

        <div className="space-y-2 text-sm text-gray-800">
          <div>
            <span className="font-semibold">Order ID:</span> {orderId || 'N/A'}
          </div>
          <div>
            <span className="font-semibold">Total:</span>{' '}
            {order?.total_formatted || `$${Number(total).toFixed(2)}`}
          </div>
          <div>
            <span className="font-semibold">Email:</span> {email}
          </div>
        </div>

        {orderId && (
          <a href={`/order/${orderId}`} className="inline-block mt-4 underline text-indigo-700">
            View order details
          </a>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
