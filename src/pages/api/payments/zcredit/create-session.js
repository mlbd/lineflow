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
    const snapshot = { customer: form, items, shipping: selectedShipping || null, coupon: coupon || null };

    // ============================================================
    // DEV SIMULATOR
    // ============================================================
    if (process.env.ZCREDIT_SIMULATE === '1') {
      const sessionId = `SIM-${Date.now()}`;

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
    const baseUrl = (process.env.ZCREDIT_BASE_URL || '').replace(/\/$/, '');
    const path = process.env.ZCREDIT_CREATE_SESSION_PATH || '/webcheckout/api/WebCheckout/CreateSession';
    const endpoint = `${baseUrl}${path}`.replace(/\/?$/, '/'); // ensure trailing slash

    // >>> PRE-FLIGHT CONFIG <<<
    const terminal   = process.env.ZCREDIT_TERMINAL || '';
    const userName   = process.env.ZCREDIT_USERNAME || '';       // <— ADDED
    const password   = process.env.ZCREDIT_PASSWORD || '';
    const token      = process.env.ZCREDIT_API_TOKEN || '';
    const privateKey = process.env.ZCREDIT_PRIVATE_KEY || '';
    const notifyToken = process.env.ZCREDIT_WEBHOOK_SECRET || '';

    const problems = [];
    if (!/^https?:\/\//i.test(baseUrl)) problems.push('ZCREDIT_BASE_URL must be an absolute URL (e.g. https://pci.zcredit.co.il).');
    if (!terminal) problems.push('ZCREDIT_TERMINAL is required.');
    if (!token) {
      // token-less accounts must use username + password
      if (!userName) problems.push('ZCREDIT_USERNAME is required when not using ZCREDIT_API_TOKEN.');
      if (!password) problems.push('ZCREDIT_PASSWORD is required when not using ZCREDIT_API_TOKEN.');
    }
    if (!notifyToken) problems.push('ZCREDIT_WEBHOOK_SECRET is required to protect NotifyUrl.');
    if (problems.length) return res.status(400).json({ error: 'Config error', details: problems });

    // >>> PAYLOAD (now includes UserName when provided) <<<
    const payload = {
      TerminalNumber: terminal,
      UserName: userName || undefined,          // <— ADDED
      Password: password || undefined,
      Token: token || undefined,
      PrivateKey: privateKey || undefined,

      SumToBill: amount,
      Currency: draft.currency || 'ILS',
      Description: `Order ${draft.order_ref || draft.order_draft_id}`,
      OrderId: String(draft.order_draft_id || ''),

      SuccessUrl: `${siteUrl}/payment/zcredit/iframe-success`,
      ErrorUrl:   `${siteUrl}/payment/zcredit/return?status=error`,
      CancelUrl:  `${siteUrl}/payment/zcredit/return?status=cancel`,
      BackUrl:    `${siteUrl}/payment/zcredit/return?status=back`,
      NotifyUrl:  `${siteUrl}/api/payments/zcredit/notify?t=${encodeURIComponent(notifyToken)}`,

      Language: 'he',
    };

    const zRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let zData, rawText = '';
    try { zData = await zRes.json(); } catch { try { rawText = await zRes.text(); } catch {} }

    if (!zRes.ok) {
      return res.status(400).json({
        error: 'Z-Credit CreateSession failed',
        status: zRes.status,
        details: zData || rawText || 'no body',
      });
    }

    const paymentUrl = (zData && (zData.PaymentPageUrl || zData.url || zData.SessionUrl)) || '';
    const sessionId  = (zData && (zData.SessionId || zData.sessionId)) || '';

    if (!paymentUrl) {
      return res.status(400).json({ error: 'Missing payment URL from Z-Credit', details: zData || rawText || null });
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

    return res.status(200).json({ ok: true, paymentUrl, sessionId: sessionId || null, orderDraftId: draft.order_draft_id || null });
  } catch (err) {
    console.error('Create-session error:', err);
    return res.status(500).json({ error: 'Server error creating session', details: String(err?.message || err) });
  }
}
