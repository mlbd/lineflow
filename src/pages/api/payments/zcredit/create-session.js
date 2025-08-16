// /src/pages/api/payments/zcredit/create-session.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { form, items, selectedShipping, coupon } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // 1) Ask WP to compute authoritative totals (server-side)
    const wpPrepare = await fetch(
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

    const draft = await wpPrepare.json().catch(() => ({}));
    if (!wpPrepare.ok) {
      return res.status(400).json({ error: draft?.message || 'WP prepare failed' });
    }

    const amount = Number(draft.total || 0);
    if (!(amount > 0)) return res.status(400).json({ error: 'Invalid amount' });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const snapshot = {
      customer: form,
      items,
      shipping: selectedShipping || null,
      coupon: coupon || null,
    };

    // ============================================================
    // DEV SIMULATOR: Short-circuit to local DevPay page in iframe
    // ============================================================
    if (process.env.ZCREDIT_SIMULATE === '1') {
      const sessionId = `SIM-${Date.now()}`;

      // Store the draft snapshot so WP can create the order on "simulate-notify"
      const wpDraft = await fetch(
        `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_draft_id: draft.order_draft_id,
            session_id: sessionId,
            totals: draft,
            snapshot,
          }),
        }
      );

      if (!wpDraft.ok) {
        const msg = await wpDraft.text().catch(() => '');
        return res.status(500).json({ error: `Draft store failed: ${msg || 'unknown error'}` });
      }

      return res.status(200).json({
        ok: true,
        paymentUrl: `${siteUrl}/payment/zcredit/devpay?draft=${encodeURIComponent(
          draft.order_draft_id
        )}&sid=${encodeURIComponent(sessionId)}`,
        sessionId,
        orderDraftId: draft.order_draft_id || null,
      });
    }

    // ==========================================
    // REAL Z-CREDIT: Create WebCheckout session
    // ==========================================

    // --- Preflight env validation (fail with helpful messages instead of throwing) ---
    const baseUrl = (process.env.ZCREDIT_BASE_URL || '').replace(/\/$/, '');
    const path = process.env.ZCREDIT_CREATE_SESSION_PATH || '/webcheckout/api/WebCheckout/CreateSession'; // <- Z-Credit WC plugin uses this path
    const terminal = process.env.ZCREDIT_TERMINAL || '';
    const password = process.env.ZCREDIT_PASSWORD || '';
    const privateKey = process.env.ZCREDIT_PRIVATE_KEY || ''; // some accounts require it
    const token = process.env.ZCREDIT_API_TOKEN || '';        // some accounts use token instead of user/pass
    const notifyToken = process.env.ZCREDIT_WEBHOOK_SECRET || '';

    const problems = [];
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) problems.push('ZCREDIT_BASE_URL must be an absolute URL (e.g. https://pci.zcredit.co.il).');
    if (!terminal) problems.push('ZCREDIT_TERMINAL is required.');
    if (!password && !token) problems.push('Provide either ZCREDIT_PASSWORD or ZCREDIT_API_TOKEN.');
    if (!notifyToken) problems.push('ZCREDIT_WEBHOOK_SECRET is required to protect NotifyUrl.');
    if (problems.length) return res.status(400).json({ error: 'Config error', details: problems });

    const endpoint = `${baseUrl}${path}`;

    const payload = {
      TerminalNumber: terminal,
      Password: password || undefined,
      Token: token || undefined,
      PrivateKey: privateKey || undefined, // harmless if not needed

      SumToBill: amount,
      Currency: draft.currency || 'ILS',
      Description: `Order ${draft.order_ref || draft.order_draft_id}`,
      OrderId: String(draft.order_draft_id || ''),

      // iframe flow: success page on same origin, others go to return page
      SuccessUrl: `${siteUrl}/payment/zcredit/iframe-success`,
      ErrorUrl: `${siteUrl}/payment/zcredit/return?status=error`,
      CancelUrl: `${siteUrl}/payment/zcredit/return?status=cancel`,
      BackUrl: `${siteUrl}/payment/zcredit/return?status=back`,
      NotifyUrl: `${siteUrl}/api/payments/zcredit/notify?t=${encodeURIComponent(notifyToken)}`,

      Language: 'he',
    };

    // Call Z-Credit
    const zRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Z-Credit sometimes returns text/html on errors — try JSON first, then raw text
    let zData, rawText = '';
    try {
      zData = await zRes.json();
    } catch {
      try { rawText = await zRes.text(); } catch {}
      zData = null;
    }

    if (!zRes.ok) {
      return res.status(400).json({
        error: 'Z-Credit CreateSession failed',
        status: zRes.status,
        details: zData || rawText || 'no body',
        // TIP: Make sure baseUrl is https://pci.zcredit.co.il and path is /webcheckout/api/WebCheckout/CreateSession
      });
    }

    // response fields seen in the wild: PaymentPageUrl | url | SessionUrl, plus SessionId
    const paymentUrl =
      (zData && (zData.PaymentPageUrl || zData.url || zData.SessionUrl)) || '';
    const sessionId = (zData && (zData.SessionId || zData.sessionId)) || '';

    if (!paymentUrl) {
      return res.status(400).json({
        error: 'Missing payment URL from Z-Credit',
        details: zData || rawText || null,
      });
    }

    // Store the draft snapshot so WP can create the order during notify
    await fetch(`${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_draft_id: draft.order_draft_id,
        session_id: sessionId || null,
        totals: draft,
        snapshot,
      }),
    }).catch(() => { /* non-fatal */ });

    return res.status(200).json({
      ok: true,
      paymentUrl,
      sessionId: sessionId || null,
      orderDraftId: draft.order_draft_id || null,
    });
  } catch (err) {
    // Make the error visible so we know exactly what's wrong
    console.error('Create-session error:', err);
    return res.status(500).json({ error: 'Server error creating session', details: String(err?.message || err) });
  }
}
