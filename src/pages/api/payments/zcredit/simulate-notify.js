// pages/api/payments/zcredit/simulate-notify.js

import { wpApiFetch } from '@/lib/wpApi';
import { limon_file_log, limon_pretty } from '@/utils/limonLogger';

export default async function handler(req, res) {
  console.log('ZCREDIT_SIMULATE', process.env.ZCREDIT_SIMULATE);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { approved, draft } = req.body || {};
    if (!draft) return res.status(400).json({ error: 'Missing draft id' });

    limon_file_log(
      'notify',
      'zCredit::notify::simulate-notify',
      limon_pretty({ approved, draft })
    );

    const txId = `SIMTX-${Date.now()}`;
    const event = {
      Status: approved ? 'Approved' : 'Declined',
      OrderId: String(draft),
      TransactionUniqueId: txId,
      ApprovalNumber: approved ? 'DEV-OK' : 'DEV-FAIL',
      TransactionSum: 0, // WP will read the authoritative total from the draft snapshot
    };

    // Tell WP to complete the order using the stored draft.
    // We set dev_simulate=true and pass a dev secret header.
    const wp = await wpApiFetch(`checkout/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MS-Dev-Secret': process.env.ZCREDIT_SIMULATE_SECRET || '',
      },
      body: JSON.stringify({
        payment_provider: 'zcredit',
        dev_simulate: true,
        zcredit: event,
      }),
    });
    
    const j = await wp.json().catch(() => ({}));

    limon_file_log(
      'notify',
      'zCredit::notify::simulate-notify::response',
      limon_pretty(j)
    );
    
    if (!wp.ok) return res.status(400).json({ error: j?.message || 'WP complete failed' });

    return res.status(200).json({ ok: true, transactionUniqueId: txId, order_id: j?.order_id });
  } catch (e) {
    console.error('simulate-notify error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
