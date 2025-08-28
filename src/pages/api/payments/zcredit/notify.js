// /src/pages/api/payments/zcredit/notify.js

import { wpApiFetch } from '@/lib/wpApi';
import { limon_file_log, limon_pretty } from '@/utils/limonLogger';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const token = (req.query?.t || '').trim();
    if (!token || token !== (process.env.ZCREDIT_WEBHOOK_SECRET || '')) {
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    const event = req.body || {};

    limon_file_log('notify', 'zCredit::notify::checkout/complete');

    // Forward to WP – WP will verify with SOAP and build the order from the stored draft
    const wp = await wpApiFetch(`checkout/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_provider: 'zcredit', zcredit: event }),
    });

    const wpJson = await wp.json().catch(() => ({}));

    limon_file_log('notify', 'zCredit::notify::checkout/complete::response', limon_pretty(wpJson));

    if (!wp.ok)
      return res.status(500).json({ ok: false, error: wpJson?.message || 'WP completion failed' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
