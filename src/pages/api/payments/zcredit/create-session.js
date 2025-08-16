// /src/pages/api/payments/zcredit/create-session.js
async function postJson(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = null; let text = null;
  try { data = await r.json(); } catch { try { text = await r.text(); } catch {} }
  return { ok: r.ok, status: r.status, data, text };
}

async function postForm(url, payload) {
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  });
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  });
  let data = null; let text = null;
  try { data = await r.json(); } catch { try { text = await r.text(); } catch {} }
  return { ok: r.ok, status: r.status, data, text };
}

function fmtAmount(n) {
  // Z-Credit expects a number with dot separator; keep 2 decimals.
  const x = Number(n || 0);
  return Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { form, items, selectedShipping, coupon } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // 1) Authoritative totals from WP
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

    const amount = fmtAmount(draft.total);
    if (!(amount > 0)) return res.status(400).json({ error: 'Invalid amount' });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const snapshot = { customer: form, items, shipping: selectedShipping || null, coupon: coupon || null };

    // --- Dev simulator ---
    if (process.env.ZCREDIT_SIMULATE === '1') {
      const sessionId = `SIM-${Date.now()}`;
      const wpDraft = await fetch(
        `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/draft`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_draft_id: draft.order_draft_id, session_id: sessionId, totals: draft, snapshot }) }
      );
      if (!wpDraft.ok) {
        const msg = await wpDraft.text().catch(() => '');
        return res.status(500).json({ error: `Draft store failed: ${msg || 'unknown error'}` });
      }
      return res.status(200).json({
        ok: true,
        paymentUrl: `${siteUrl}/payment/zcredit/devpay?draft=${encodeURIComponent(draft.order_draft_id)}&sid=${encodeURIComponent(sessionId)}`,
        sessionId,
        orderDraftId: draft.order_draft_id || null,
      });
    }

    // 2) REAL Z-CREDIT: build payload
    const base = (process.env.ZCREDIT_BASE_URL || '').replace(/\/$/, '');
    const notifyToken = process.env.ZCREDIT_WEBHOOK_SECRET || '';
    const terminal   = process.env.ZCREDIT_TERMINAL || '';
    const userName   = process.env.ZCREDIT_USERNAME || '';
    const password   = process.env.ZCREDIT_PASSWORD || '';
    const token      = process.env.ZCREDIT_API_TOKEN || '';
    const privateKey = process.env.ZCREDIT_PRIVATE_KEY || '';

    const problems = [];
    if (!/^https?:\/\//i.test(base)) problems.push('ZCREDIT_BASE_URL must be absolute (e.g., https://pci.zcredit.co.il).');
    if (!terminal) problems.push('ZCREDIT_TERMINAL is required.');
    if (!token) { if (!userName) problems.push('ZCREDIT_USERNAME required when not using ZCREDIT_API_TOKEN.'); if (!password) problems.push('ZCREDIT_PASSWORD required when not using ZCREDIT_API_TOKEN.'); }
    if (!notifyToken) problems.push('ZCREDIT_WEBHOOK_SECRET is required.');
    if (problems.length) return res.status(400).json({ error: 'Config error', details: problems });

    const payload = {
      TerminalNumber: Number.isFinite(Number(terminal)) ? Number(terminal) : terminal,
      UserName: userName || undefined,
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

    // 3) Try a shortlist of known endpoints (case/casing varies between tenants)
    const candidates = [
      `${base}/webcheckout/api/WebCheckout/CreateSession/`,
      `${base}/webcheckout/api/WebCheckout/CreateSession`,
      `${base}/WebCheckout/api/WebCheckout/CreateSession/`,
      `${base}/WebCheckout/api/WebCheckout/CreateSession`,
      `https://secure.zcredit.co.il/webcheckout/api/WebCheckout/CreateSession/`, // alt host
    ];

    const attempts = [];
    let success = null;

    for (const url of candidates) {
      // JSON first
      const a1 = await postJson(url, payload);
      attempts.push({ url, mode: 'json', status: a1.status, data: a1.data, text: a1.text });
      if (a1.ok && (a1.data?.PaymentPageUrl || a1.data?.url || a1.data?.SessionUrl)) {
        success = { url, response: a1.data };
        break;
      }
      // then form-encoded fallback
      const a2 = await postForm(url, payload);
      attempts.push({ url, mode: 'form', status: a2.status, data: a2.data, text: a2.text });
      if (a2.ok && (a2.data?.PaymentPageUrl || a2.data?.url || a2.data?.SessionUrl)) {
        success = { url, response: a2.data };
        break;
      }
    }

    if (!success) {
      // Bubble up all attempts so you can see what the gateway says
      return res.status(400).json({
        error: 'Z-Credit CreateSession failed',
        attempts: attempts.map(a => ({
          url: a.url,
          mode: a.mode,
          status: a.status || null,
          body: a.data || a.text || null,
        })),
        hint: 'Verify terminal/username/password; ensure your account is enabled for WebCheckout and that your server IP is whitelisted with Z-Credit.',
      });
    }

    const zData = success.response;
    const paymentUrl = zData.PaymentPageUrl || zData.url || zData.SessionUrl || '';
    const sessionId  = zData.SessionId || zData.sessionId || '';

    // 4) Store draft on WP for notify step
    await fetch(`${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/checkout/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_draft_id: draft.order_draft_id,
        session_id: sessionId || null,
        totals: draft,
        snapshot,
      }),
    }).catch(() => {});

    return res.status(200).json({ ok: true, paymentUrl, sessionId: sessionId || null, orderDraftId: draft.order_draft_id || null });
  } catch (err) {
    console.error('Create-session error:', err);
    return res.status(500).json({ error: 'Server error creating session', details: String(err?.message || err) });
  }
}
