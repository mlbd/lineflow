// /src/pages/api/payments/zcredit/create-session.js
import { wpApiFetch } from '@/lib/wpApi';
import { limon_file_log, limon_pretty } from '@/utils/limonLogger';

function cid() {
  return `zc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
const DEBUG = process.env.DEBUG_ZCREDIT === '1';
const dlog = (id, ...a) => DEBUG && console.log(`[ZCREDIT][${id}]`, ...a);

function toAmountString(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? x.toFixed(2) : '0.00';
}

// [PATCH] Added: detect absolute URLs so we use native fetch (not wpApiFetch) for externals
function isAbsoluteUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u);
}

// [PATCH] Added: optional Basic Auth header (if your gateway is protected)
// Set ZCREDIT_BASIC_AUTH="user:pass"  OR  ZCREDIT_BASIC_FROM_KEY="1" (uses KEY as user and empty pass)
function getZcreditAuthHeader() {
  const basic = (process.env.ZCREDIT_BASIC_AUTH || '').trim(); // "user:pass"
  if (basic)
    try {
      return `Basic ${Buffer.from(basic, 'utf8').toString('base64')}`;
    } catch {}
  if (process.env.ZCREDIT_BASIC_FROM_KEY === '1') {
    const key = (process.env.ZCREDIT_KEY || '').trim();
    if (key) return `Basic ${Buffer.from(`${key}:`, 'utf8').toString('base64')}`;
  }
  return '';
}

// [PATCH] Updated: use fetch for absolute URLs; wpApiFetch for relative WP routes
async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const call = isAbsoluteUrl(url) ? fetch : wpApiFetch;
    return await call(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Map ml_create_order "products" entry -> minimal "item" the WP prepare endpoint expects */
function productToItem(p, idx) {
  return {
    key: `${p?.product_id ?? ''}:${idx}`,
    ...p,
  };
}

// --- NEW: sanitize a single-segment slug (matches /[slug]) ---
function sanitizeSlug(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  // allow a-z, 0-9, dash, underscore only (single segment)
  return s.replace(/[^a-z0-9_-]/g, '').slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = cid();

  try {
    let { form, items, selectedShipping, coupon, orderData, products, pageSlug } = req.body || {};

    // Accept alternative fields (defensive)
    if (!pageSlug && req.body?.slug) pageSlug = req.body.slug;
    if (!pageSlug && orderData?.page_slug) pageSlug = orderData.page_slug;

    const safeSlug = sanitizeSlug(pageSlug);
    const slugParam = safeSlug ? `&slug=${encodeURIComponent(safeSlug)}` : '';

    dlog(id, 'Incoming payload', { hasItems: Array.isArray(items), safeSlug });

    // --- Fallbacks so both client payload shapes work ---
    if (
      (!Array.isArray(items) || items.length === 0) &&
      orderData &&
      Array.isArray(orderData.products)
    ) {
      dlog(id, 'Adapting orderData.products -> items');
      items = orderData.products.map(productToItem);
      // Also adapt form/shipping from orderData if not provided:
      if (!form && orderData.customerInfo) {
        const c = orderData.customerInfo;
        form = {
          fullName: c.customer_name || '',
          email: c.customer_email || '',
          phone: c.customer_phone || '',
          city: c.customer_city || '',
          streetName: c.customer_address || '',
          streetNumber: c.customer_address_number || '',
          invoiceName: c.invoice_name || '',
        };
      }
      if (!selectedShipping && orderData.shipping_method_info) {
        selectedShipping = {
          id: orderData.shipping_method_info.id || '',
          title: orderData.shipping_method_info.title || '',
          cost: Number(orderData.shipping_method_info.cost || 0),
        };
      }
    }

    if (
      (!Array.isArray(items) || items.length === 0) &&
      Array.isArray(products) &&
      products.length > 0
    ) {
      dlog(id, 'Adapting products -> items');
      items = products.map(productToItem);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty', cid: id });
    }

    // --- WP authoritative totals (your Group/Quantity logic) ---
    dlog(id, '→ WP /checkout/prepare');
    const prep = await fetchWithTimeout(`checkout/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: form || {},
        items,
        note: orderData?.note || '',
        shipping: selectedShipping || null,
        coupon: coupon || null,
        // NEW: store page slug in the draft snapshot too (handy for admin/order notes)
        page_slug: safeSlug || null,
      }),
    });
    const draft = await prep.json().catch(() => ({}));

    limon_file_log(
      'create-session',
      'zCredit::create-session::checkout/prepare',
      limon_pretty(draft)
    );

    dlog(id, 'WP prepare status', prep.status, 'body', draft);
    if (!prep.ok) {
      return res
        .status(400)
        .json({ error: draft?.message || 'WP prepare failed', cid: id, details: draft });
    }

    const KEY = (process.env.ZCREDIT_KEY || '').trim();
    if (!KEY)
      return res
        .status(400)
        .json({ error: 'Missing ZCREDIT_KEY (WebCheckout private key)', cid: id });

    const publicBase = (process.env.ZCREDIT_PUBLIC_BASE || '').replace(/\/$/, '');
    const notifyBase = (process.env.ZCREDIT_NOTIFY_BASE || publicBase).replace(/\/$/, '');

    // Dev simulator
    if (process.env.ZCREDIT_SIMULATE === '1') {
      const sessionId = `SIM-${Date.now()}`;
      await fetchWithTimeout(`checkout/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_draft_id: draft.order_draft_id,
          session_id: sessionId,
          totals: draft,
          snapshot: {
            customer: form || {},
            items,
            note: orderData?.note || '',
            shipping: selectedShipping || null,
            coupon: coupon || null,
            page_slug: safeSlug || null, // NEW
          },
        }),
      }).catch(() => {});
      return res.status(200).json({
        ok: true,
        // NEW: include slug in devpay URL so the return/success pages can link back home
        paymentUrl: `${publicBase}/payment/zcredit/devpay?draft=${encodeURIComponent(draft.order_draft_id)}&sid=${encodeURIComponent(sessionId)}${slugParam}`,
        sessionId,
        orderDraftId: draft.order_draft_id || null,
        cid: id,
      });
    }

    // === Build Z-Credit CreateSession request ===
    const LOCAL = process.env.ZCREDIT_LOCAL || 'He';
    const THEME = (process.env.ZCREDIT_THEME_COLOR || '005ebb').replace('#', '');
    const FAILS = Number(process.env.ZCREDIT_NUMBER_OF_FAILURES || 3);
    const MAXINS = Number(process.env.ZCREDIT_MAX_INSTALLMENTS || 1);

    // NEW: append ?slug=... so the success/return pages can render a "Back to home page" link.
    const SuccessUrl = `${publicBase}/payment/zcredit/iframe-success${slugParam ? `?${slugParam.slice(1)}` : ''}`;
    const CancelUrl = `${publicBase}/payment/zcredit/return?status=cancel${slugParam}`;
    const FailureRedirectUrl = `${publicBase}/payment/zcredit/return?status=error${slugParam}`;
    const CallbackUrl = `${notifyBase}/api/payments/zcredit/notify?t=${encodeURIComponent(process.env.ZCREDIT_WEBHOOK_SECRET || '')}&status=success`;
    const FailureCallBackUrl = `${notifyBase}/api/payments/zcredit/notify?t=${encodeURIComponent(process.env.ZCREDIT_WEBHOOK_SECRET || '')}&status=failure`;

    // [PATCH] Updated: CartItems logic with coupon type support (fixed_cart | percent)
    const CartItems = (() => {
      // [PATCH] Added: helpers
      const num = (v) => {
        const x = Number(v ?? 0);
        return Number.isFinite(x) ? x : 0;
      };
      const clampMoney = (v) => Number(Math.max(0, num(v)).toFixed(2));

      // [PATCH] Added: compute discount from coupon type
      function computeDiscountFromCoupon(c, subtotal, shipping) {
        if (!c) return 0;
        const type = String(c?.discount_type ?? c?.type ?? '').toLowerCase();
        const amountRaw = num(c?.amount ?? c?.value ?? c?.coupon_amount);
        const base = num(subtotal) + num(shipping);

        if (!base || amountRaw <= 0) return 0;

        if (type === 'fixed_cart' || type === 'fixed') {
          // Fixed money off the cart total
          return Math.min(amountRaw, base);
        }
        if (type === 'percent' || type === 'percentage' || type === 'percent_cart') {
          // Percent off the cart total
          const pct = amountRaw / 100;
          return Math.min(base * pct, base);
        }
        // Unknown type → no computed discount here
        return 0;
      }

      const lines = Array.isArray(draft?.lines) ? draft.lines : [];

      // Subtotal = Σ(unit_price * quantity)
      const subtotal = lines.reduce(
        (acc, l) => acc + num(l?.unit_price) * num(l?.quantity ?? 1),
        0
      );

      // Shipping from WP draft first, fallback to selectedShipping.cost
      const shipping = clampMoney(num(draft?.shipping) || num(selectedShipping?.cost));
      const baseTotal = clampMoney(subtotal + shipping);

      // Try to compute discount from coupon type first
      const couponDiscount = computeDiscountFromCoupon(coupon, subtotal, shipping);

      // Also detect any discount WP may have calculated (fallback only)
      const discountCandidates = [
        draft?.discount_total,
        draft?.discount,
        draft?.coupon_amount,
        draft?.coupon_discount,
      ].map(num);
      const wpDiscount = Math.max(0, discountCandidates.find((v) => v > 0) || 0);

      // Do we have a coupon?
      const hasCoupon =
        !!coupon &&
        String(coupon?.code ?? coupon).trim() !== '' &&
        (String(coupon?.discount_type ?? coupon?.type ?? '').trim() !== '' || couponDiscount > 0);

      // Final payable total
      let payableTotal;
      if (hasCoupon) {
        // With coupon: trust our type math over draft total
        const discount = couponDiscount > 0 ? couponDiscount : wpDiscount;
        payableTotal = clampMoney(baseTotal - discount);
      } else {
        // No coupon: prefer draft total if present, else derive
        const draftTotal = num(draft?.total);
        const derived = clampMoney(baseTotal - wpDiscount);
        payableTotal = draftTotal > 0 ? clampMoney(draftTotal) : derived;
      }

      if (hasCoupon) {
        // Single adjusted item to match payable total exactly
        const descBits = [
          'Adjusted total: items + shipping − coupon',
          (() => {
            const t = String(coupon?.discount_type ?? coupon?.type ?? '').toLowerCase();
            if (t === 'fixed_cart' || t === 'fixed') return `type=fixed_cart amount=${num(coupon?.amount).toFixed(2)}`;
            if (t === 'percent' || t === 'percentage' || t === 'percent_cart')
              return `type=percent value=${num(coupon?.amount)}%`;
            return '';
          })(),
          coupon?.code ? `code=${coupon.code}` : '',
          // Optional human math if you already have a helper like toAmountString()
          // `${toAmountString(subtotal)} + ${toAmountString(shipping)} − ${toAmountString(couponDiscount || wpDiscount)} = ${toAmountString(payableTotal)}`
        ].filter(Boolean);

        return [
          {
            Amount: payableTotal,
            Currency: 'ILS',
            Name: 'Order Total',
            Description: descBits.join(' | '), // [PATCH] Added: explain why single item
            Quantity: 1,
            Image: '',
            IsTaxFree: false,
            AdjustAmount: true,
          },
        ];
      }

      // No coupon: detailed items (no negative discount line!)
      const detailed = lines.map((l, i) => ({
        Amount: clampMoney(l?.unit_price),
        Currency: 'ILS',
        Name: `${((l?.name ?? '') + '').trim() || `Item ${i + 1}`} (#${l?.product_id ?? ''})`,
        Description: l?.group_type ? `${l.group_type} pricing` : '',
        Quantity: Math.max(1, num(l?.quantity ?? 1)),
        Image: '',
        IsTaxFree: false,
        AdjustAmount: false,
      }));

      if (shipping > 0) {
        detailed.push({
          Amount: shipping,
          Currency: 'ILS',
          Name: selectedShipping?.title || 'Shipping',
          Description: '',
          Quantity: 1,
          Image: '',
          IsTaxFree: false,
          AdjustAmount: false,
        });
      }

      return detailed;
    })();

    // [PATCH] Added: log CartItems for diagnostics (optional)
    limon_file_log('CreateSession', 'zCredit::CreateSession::CartItems', limon_pretty(CartItems));


    const Customer = {
      Email: (form?.email || '').trim(),
      Name: (form?.fullName || form?.invoiceName || '').trim(),
      PhoneNumber: (form?.phone || '').trim(),
      Attributes: {
        HolderId: 'none',
        Name: 'required',
        PhoneNumber: 'required',
        Email: 'optional',
      },
    };

    const body = {
      Key: KEY,
      Local: LOCAL,
      UniqueId: String(draft.order_draft_id || ''),
      SuccessUrl,
      CancelUrl,
      CallbackUrl,
      FailureCallBackUrl,
      FailureRedirectUrl,
      NumberOfFailures: FAILS,
      PaymentType: 'regular',
      CreateInvoice: false,
      AdditionalText: '',
      ShowCart: false,
      ThemeColor: THEME,
      BitButtonEnabled: true,
      ApplePayButtonEnabled: true,
      GooglePayButtonEnabled: true,
      Installments: { Type: MAXINS > 1 ? 'regular' : 'none', MinQuantity: 1, MaxQuantity: MAXINS },
      Customer,
      CartItems,
      FocusType: 'None',
      CardsIcons: {
        ShowVisaIcon: true,
        ShowMastercardIcon: true,
        ShowDinersIcon: true,
        ShowAmericanExpressIcon: true,
        ShowIsracardIcon: true,
      },
      IssuerWhiteList: [],
      BrandWhiteList: [],
      UseLightMode: false,
      UseCustomCSS: false,
      BackgroundColor: 'FFFFFF',
      ShowTotalSumInPayButton: true,
      ForceCaptcha: false,
      CustomCSS: '',
      Bypass3DS: false,
    };

    if (DEBUG) {
      const safe = {
        ...body,
        Key: body.Key ? '[set]' : '[empty]',
        CartItemsCount: CartItems.length,
        SuccessUrl,
        CancelUrl,
        FailureRedirectUrl,
      };
      dlog(id, 'CreateSession body (sanitized):', safe);
    }

    const base = (process.env.ZCREDIT_BASE_URL || 'https://pci.zcredit.co.il').replace(/\/$/, '');
    const url = `${base}/webcheckout/api/WebCheckout/CreateSession`;

    dlog(id, 'CreateSession--------', url);
    limon_file_log(
      'CreateSession',
      'zCredit::CreateSession::url',
      url,
      'zCredit::CreateSession::body',
      limon_pretty(body)
    );

    // [PATCH] Updated: build headers and (optionally) add Authorization for Z-Credit
    const zHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      // 'Accept-Language': 'he-IL', // optional
    };
    // [PATCH] Added: optional Basic auth support via env
    const auth = getZcreditAuthHeader();
    limon_file_log('CreateSession', 'zCredit::CreateSession::auth', limon_pretty(auth));
    if (auth) zHeaders.Authorization = auth;

    limon_file_log('CreateSession', 'zCredit::CreateSession::zHeaders', limon_pretty(zHeaders));

    const zRes = await fetchWithTimeout(url, {
      method: 'POST',
      headers: zHeaders, // [PATCH] Updated
      body: JSON.stringify(body),
    });

    let zBody = null,
      zText = null;
    try {
      zBody = await zRes.json();
    } catch {
      zText = await zRes.text().catch(() => '');
    }
    dlog(id, 'CreateSession status', zRes.status, zBody || zText);

    if (!zRes.ok) {
      return res.status(400).json({
        error: 'Z-Credit CreateSession failed',
        cid: id,
        status: zRes.status,
        details: zBody || zText || null,
      });
    }

    const hasErr = zBody?.HasError || zBody?.Data?.HasError;
    const sessionUrl = zBody?.Data?.SessionUrl || zBody?.SessionUrl || null;
    const sessionId = zBody?.Data?.SessionId || zBody?.SessionId || null;

    limon_file_log(
      'CreateSession',
      'zCredit::CreateSession::return',
      limon_pretty(hasErr),
      limon_pretty(sessionUrl),
      limon_pretty(sessionId),
      limon_pretty(zBody)
    );

    if (hasErr || !sessionUrl) {
      return res.status(400).json({
        error:
          zBody?.Data?.ReturnMessage ||
          zBody?.ReturnMessage ||
          'Z-Credit CreateSession returned error',
        cid: id,
        details: zBody || zText || null,
      });
    }

    // Store draft snapshot (with page_slug) for WP completion
    await fetchWithTimeout(`checkout/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_draft_id: draft.order_draft_id,
        session_id: sessionId || null,
        totals: draft,
        snapshot: {
          customer: form || {},
          items,
          shipping: selectedShipping || null,
          coupon: coupon || null,
          page_slug: safeSlug || null, // NEW
        },
      }),
    }).catch(() => {});

    return res.status(200).json({
      ok: true,
      paymentUrl: sessionUrl,
      sessionId,
      orderDraftId: draft.order_draft_id || null,
      cid: id,
      // NEW: echo back the slug so the client can also keep it around if needed
      pageSlug: safeSlug || null,
    });
  } catch (err) {
    console.error(`[ZCREDIT][${id}] FATAL`, err);
    return res.status(500).json({
      error: 'Server error creating session',
      cid: id,
      ...(DEBUG ? { details: String(err?.message || err) } : {}),
    });
  }
}
