// /src/pages/api/payments/zcredit/create-session.js

function cid() {
  return `zc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
const DEBUG = process.env.DEBUG_ZCREDIT === '1';
const dlog = (id, ...a) => DEBUG && console.log(`[ZCREDIT][${id}]`, ...a);

function toAmountString(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? x.toFixed(2) : '0.00';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = cid();

  try {
    let { form, items, selectedShipping, coupon, orderData, products } = req.body || {};

    console.log('ZCREDIT_CREATE_SESSION', id, {
      form,
      items,
      selectedShipping,
      coupon,
      orderData,
      products,
    });

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

    console.log('ZCREDIT_CREATE_SESSION::items', items);

    if (
      (!Array.isArray(items) || items.length === 0) &&
      Array.isArray(products) &&
      products.length > 0
    ) {
      dlog(id, 'Adapting products -> items');
      items = products.map(productToItem);
    }

    console.log('ZCREDIT_CREATE_SESSION::items::later', items);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty', cid: id });
    }

    dlog(id, 'Incoming items count:', items.length);

    // --- WP authoritative totals (your Group/Quantity logic) ---
    dlog(id, '→ WP /checkout/prepare');
    const prep = await fetchWithTimeout(
      `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/prepare`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form || {},
          items,
          shipping: selectedShipping || null,
          coupon: coupon || null,
        }),
      }
    );
    const draft = await prep.json().catch(() => ({}));
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
      await fetchWithTimeout(
        `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_draft_id: draft.order_draft_id,
            session_id: sessionId,
            totals: draft,
            snapshot: {
              customer: form || {},
              items,
              shipping: selectedShipping || null,
              coupon: coupon || null,
            },
          }),
        }
      ).catch(() => {});
      return res.status(200).json({
        ok: true,
        paymentUrl: `${publicBase}/payment/zcredit/devpay?draft=${encodeURIComponent(draft.order_draft_id)}&sid=${encodeURIComponent(sessionId)}`,
        sessionId,
        orderDraftId: draft.order_draft_id || null,
        cid: id,
      });
    }

    // === Build Z-Credit CreateSession request (unchanged) ===
    const LOCAL = process.env.ZCREDIT_LOCAL || 'He';
    const THEME = (process.env.ZCREDIT_THEME_COLOR || '005ebb').replace('#', '');
    const FAILS = Number(process.env.ZCREDIT_NUMBER_OF_FAILURES || 3);
    const MAXINS = Number(process.env.ZCREDIT_MAX_INSTALLMENTS || 1);

    const SuccessUrl = `${publicBase}/payment/zcredit/iframe-success`;
    const CancelUrl = `${publicBase}/payment/zcredit/return?status=cancel`;
    const FailureRedirectUrl = `${publicBase}/payment/zcredit/return?status=error`;
    const CallbackUrl = `${notifyBase}/api/payments/zcredit/notify?t=${encodeURIComponent(process.env.ZCREDIT_WEBHOOK_SECRET || '')}&status=success`;
    const FailureCallBackUrl = `${notifyBase}/api/payments/zcredit/notify?t=${encodeURIComponent(process.env.ZCREDIT_WEBHOOK_SECRET || '')}&status=failure`;

    const CartItems = Array.isArray(draft?.lines)
      ? draft.lines.map((l, i) => ({
          Amount: Number(l?.unit_price ?? 0),
          Currency: 'ILS',
          Name: `Item ${i + 1} (#${l.product_id})`,
          Description: l?.group_type ? `${l.group_type} pricing` : '',
          Quantity: Number(l?.quantity ?? 1),
          Image: '',
          IsTaxFree: false,
          AdjustAmount: false,
        }))
      : [];

    if (Number(draft.shipping || 0) > 0) {
      CartItems.push({
        Amount: Number(draft.shipping),
        Currency: 'ILS',
        Name: selectedShipping?.title || 'Shipping',
        Description: '',
        Quantity: 1,
        Image: '',
        IsTaxFree: false,
        AdjustAmount: false,
      });
    }

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
      AdditionalText: draft?.order_ref || '',
      ShowCart: true,
      ThemeColor: THEME,
      BitButtonEnabled: false,
      ApplePayButtonEnabled: false,
      GooglePayButtonEnabled: false,
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
      };
      dlog(id, 'CreateSession body (sanitized):', safe);
    }

    const base = (process.env.ZCREDIT_BASE_URL || 'https://pci.zcredit.co.il').replace(/\/$/, '');
    const url = `${base}/webcheckout/api/WebCheckout/CreateSession`;

    const zRes = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
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

    if (hasErr || !sessionUrl) {
      return res.status(400).json({
        error: 'Z-Credit CreateSession returned error',
        cid: id,
        details: zBody || zText || null,
      });
    }

    await fetchWithTimeout(
      `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/draft`,
      {
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
          },
        }),
      }
    ).catch(() => {});

    return res.status(200).json({
      ok: true,
      paymentUrl: sessionUrl,
      sessionId,
      orderDraftId: draft.order_draft_id || null,
      cid: id,
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
