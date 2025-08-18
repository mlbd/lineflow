'use client';
import { useEffect, useState } from 'react';

export default function DevPay() {
  const [draft, setDraft] = useState('');
  const [sid, setSid] = useState('');

  useEffect(() => {
    const u = new URL(window.location.href);
    setDraft(u.searchParams.get('draft') || '');
    setSid(u.searchParams.get('sid') || '');
  }, []);

  async function simulate(approved) {
    try {
      const r = await fetch('/api/payments/zcredit/simulate-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, draft }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'simulate failed');

      if (approved) {
        // Tell parent exactly like the real iframe-success page does
        window.parent?.postMessage(
          { type: 'ZCREDIT_SUCCESS', transactionUniqueId: j.transactionUniqueId || '' },
          window.location.origin
        );
      } else {
        window.parent?.postMessage({ type: 'ZCREDIT_ERROR' }, window.location.origin);
      }
    } catch (e) {
      alert(e.message || 'simulate error');
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="max-w-md w-full p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">DevPay (Simulator)</h1>
        <p className="text-sm text-gray-600">draft: {draft || '-'}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => simulate(true)}
            className="px-4 py-2 rounded bg-green-600 text-white"
          >
            Approve
          </button>
          <button
            onClick={() => simulate(false)}
            className="px-4 py-2 rounded bg-red-600 text-white"
          >
            Decline
          </button>
        </div>
        <p className="text-xs text-gray-500">Simulator is active because ZCREDIT_SIMULATE=1</p>
      </div>
    </div>
  );
}
