// pages/api/payments/zcredit/get-status.js

import { wpApiFetch } from '@/lib/wpApi';

export default async function handler(req, res) {
  const { transactionUniqueId } = req.query || {};
  if (!transactionUniqueId) return res.status(400).json({ error: 'Missing transactionUniqueId' });

  try {
    // Delegate to WP to fetch+parse SOAP result (keeps secrets in one place)
    const r = await wpApiFetch(`checkout/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionUniqueId }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(400).json({ error: data?.message || 'Status query failed' });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error('Get status error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
