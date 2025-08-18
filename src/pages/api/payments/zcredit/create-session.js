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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = cid();

  try {
    const { form, items, selectedShipping, coupon } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty', cid: id });
    }

    // --- WP authoritative totals (your Group/Quantity logic) ---
    dlog(id, '→ WP /checkout/prepare');
    const prep = await fetchWithTimeout(
      `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/prepare`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items,
          shipping: selectedShipping || null,
          coupon: coupon || null,
        }),
      }
    );
    const draft = await prep.json().catch(() => ({}));
    dlog(id, 'WP prepare status', prep.status, 'body', draft);
    if (!prep.ok)
      return res
        .status(400)
        .json({ error: draft?.message || 'WP prepare failed', cid: id, details: draft });

    // --- Config & URL guards per Apiary spec (MUST be https) ---
    const KEY = (process.env.ZCREDIT_KEY || '').trim();
    if (!KEY)
      return res
        .status(400)
        .json({ error: 'Missing ZCREDIT_KEY (WebCheckout private key)', cid: id });

    const publicBase = (process.env.ZCREDIT_PUBLIC_BASE || '').replace(/\/$/, '');
    const notifyBase = (process.env.ZCREDIT_NOTIFY_BASE || publicBase).replace(/\/$/, '');
    // if (!/^https:\/\//i.test(publicBase)) {
    //   return res.status(400).json({ error: 'ZCREDIT_PUBLIC_BASE must be an HTTPS URL', cid: id });
    // }
    // if (!/^https:\/\//i.test(notifyBase)) {
    //   return res.status(400).json({ error: 'ZCREDIT_NOTIFY_BASE must be an HTTPS URL', cid: id });
    // }

    // --- Dev simulator (still supported) ---
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
              customer: form,
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

    // --- Build WebCheckout CreateSession body (Apiary spec) ---
    const LOCAL = process.env.ZCREDIT_LOCAL || 'He'; // He | En | Ru
    const THEME = (process.env.ZCREDIT_THEME_COLOR || '005ebb').replace('#', '');
    const FAILS = Number(process.env.ZCREDIT_NUMBER_OF_FAILURES || 3);
    const MAXINS = Number(process.env.ZCREDIT_MAX_INSTALLMENTS || 1);

    // HTTPS absolute URLs required by Z-Credit
    const SuccessUrl = `${publicBase}/payment/zcredit/iframe-success`;
    const CancelUrl = `${publicBase}/payment/zcredit/return?status=cancel`;
    const FailureRedirectUrl = `${publicBase}/payment/zcredit/return?status=error`;
    const CallbackUrl = `${notifyBase}/api/payments/zcredit/notify?t=${encodeURIComponent(process.env.ZCREDIT_WEBHOOK_SECRET || '')}&status=success`;
    const FailureCallBackUrl = `${notifyBase}/api/payments/zcredit/notify?t=${encodeURIComponent(process.env.ZCREDIT_WEBHOOK_SECRET || '')}&status=failure`;

    // CartItems: single-unit price (Amount), Quantity, Currency as string
    const CartItems = Array.isArray(draft?.lines)
      ? draft.lines.map((l, i) => ({
          Amount: Number(l?.unit_price ?? 0), // number (required)
          Currency: 'ILS', // string (required)
          Name: `Item ${i + 1} (#${l.product_id})`, // string (required)
          Description: l?.group_type ? `${l.group_type} pricing` : '',
          Quantity: Number(l?.quantity ?? 1), // number (required)
          Image: '', // HTTPS image if you have one
          IsTaxFree: false, // boolean
          AdjustAmount: false, // boolean
        }))
      : [];

    // Optional: push shipping as a line so the hosted cart shows it too
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
      Key: KEY, // required
      Local: LOCAL,
      UniqueId: String(draft.order_draft_id || ''),

      SuccessUrl, // required (HTTPS)
      CancelUrl, // HTTPS
      CallbackUrl, // required (HTTPS)
      FailureCallBackUrl, // HTTPS
      FailureRedirectUrl, // HTTPS
      NumberOfFailures: FAILS,

      PaymentType: 'regular',
      CreateInvoice: false, // boolean
      AdditionalText: draft?.order_ref || '', // optional note visible in backoffice
      ShowCart: true, // boolean
      ThemeColor: THEME,
      BitButtonEnabled: false,
      ApplePayButtonEnabled: false,
      GooglePayButtonEnabled: false,

      Installments: {
        Type: MAXINS > 1 ? 'regular' : 'none',
        MinQuantity: 1,
        MaxQuantity: MAXINS,
      },

      Customer,
      CartItems, // required

      FocusType: 'None',
      CardsIcons: {
        ShowVisaIcon: true,
        ShowMastercardIcon: true,
        ShowDinersIcon: true,
        ShowAmericanExpressIcon: true,
        ShowIsracardIcon: true,
      },

      IssuerWhiteList: [], // pass arrays if you need to restrict
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

    // --- Call CreateSession (canonical endpoint) ---
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

    // Expecting: { HasError:false, Data:{ SessionId, SessionUrl, ... }, ... }
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

    // --- Store draft for notify/complete ---
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
            customer: form,
            items,
            shipping: selectedShipping || null,
            coupon: coupon || null,
          },
        }),
      }
    ).catch(() => {});

    return res.status(200).json({
      ok: true,
      paymentUrl: sessionUrl, // put this in the iframe
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
