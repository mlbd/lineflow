// /src/pages/payment/zcredit/iframe-success.jsx
'use client';
import { useEffect } from 'react';
export default function IframeSuccess() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const transactionUniqueId =
      url.searchParams.get('TransactionUniqueId') ||
      url.searchParams.get('transactionUniqueId') ||
      '';
    window.parent?.postMessage(
      { type: 'ZCREDIT_SUCCESS', transactionUniqueId },
      window.location.origin
    );
    if (window.top === window.self) {
      const q = new URLSearchParams({ status: 'success', transactionUniqueId }).toString();
      window.location.replace(`/payment/zcredit/return?${q}`);
    }
  }, []);
  return <div className="p-6 text-center">מעבד תשלום…</div>;
}
