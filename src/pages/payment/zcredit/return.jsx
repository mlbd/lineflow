// /src/pages/payment/zcredit/return.jsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ZCreditReturnPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const transactionUniqueId =
      url.searchParams.get('TransactionUniqueId') || url.searchParams.get('transactionUniqueId') || '';
    const check = async () => {
      try {
        if (transactionUniqueId) {
          const r = await fetch(`/api/payments/zcredit/get-status?transactionUniqueId=${encodeURIComponent(transactionUniqueId)}`);
          const j = await r.json();
          setResult({ status, tx: j?.data || null });
        } else {
          setResult({ status, tx: null });
        }
      } catch {
        setResult({ status, tx: null });
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  if (loading) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
    </div>
  );

  const approved =
    result?.tx?.approved === true ||
    result?.tx?.StatusDescription === 'Approved' ||
    result?.status === 'success';

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">{approved ? 'התשלום אושר' : 'התשלום לא הושלם'}</h1>

      {approved ? (
        <p className="mb-6 text-green-700">תודה! התשלום התקבל. שלחנו את פרטי ההזמנה למייל שלך.</p>
      ) : (
        <p className="mb-6 text-red-700">נראה שהתשלום בוטל או נכשל. אפשר לנסות שוב.</p>
      )}

      <div className="bg-white border rounded p-4 text-sm space-y-2">
        <div><strong>סטטוס:</strong> {result?.status || '-'}</div>
        <div><strong>מזהה עסקה:</strong> {result?.tx?.TransactionUniqueId || '-'}</div>
        <div><strong>סכום:</strong> {result?.tx?.TransactionSum || '-'}</div>
        <div><strong>אסמכתא:</strong> {result?.tx?.ApprovalNumber || '-'}</div>
      </div>

      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:underline">חזרה לדף הבית</Link>
      </div>
    </div>
  );
}
