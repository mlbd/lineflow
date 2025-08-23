// /src/pages/payment/zcredit/return.jsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function sanitizeSlug(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 120);
}

export default function ZCreditReturnPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [slug, setSlug] = useState(''); // NEW: store page slug

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');

    // Accept ?TransactionUniqueId or ?transactionUniqueId
    const transactionUniqueId =
      url.searchParams.get('TransactionUniqueId') ||
      url.searchParams.get('transactionUniqueId') ||
      '';

    // NEW: Accept ?slug or ?pageSlug (from CreateSession Success/Cancel URLs)
    const rawSlug = url.searchParams.get('slug') || url.searchParams.get('pageSlug') || '';
    setSlug(sanitizeSlug(rawSlug));

    const check = async () => {
      try {
        if (transactionUniqueId) {
          const r = await fetch(
            `/api/payments/zcredit/get-status?transactionUniqueId=${encodeURIComponent(
              transactionUniqueId
            )}`
          );
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  const approved =
    result?.tx?.approved === true ||
    result?.tx?.StatusDescription === 'Approved' ||
    result?.status === 'success';

  // NEW: build back link using the captured slug
  const backHref = slug ? `/${encodeURIComponent(slug)}` : '/';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        {approved ? (
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        ) : (
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        )}

        <h1 className="text-2xl font-bold mb-2">{approved ? 'התשלום אושר' : 'התשלום לא הושלם'}</h1>

        {approved ? (
          <p className="mb-6 text-green-700">תודה! התשלום התקבל. שלחנו את פרטי ההזמנה למייל שלך.</p>
        ) : (
          <p className="mb-6 text-red-700">נראה שהתשלום בוטל או נכשל. אפשר לנסות שוב.</p>
        )}

        <div className="bg-gray-50 border rounded-lg p-4 text-sm text-left space-y-2">
          <div>
            <span className="font-semibold">סטטוס:</span> {result?.status || '-'}
          </div>
          <div>
            <span className="font-semibold">מזהה עסקה:</span>{' '}
            {result?.tx?.TransactionUniqueId || '-'}
          </div>
          <div>
            <span className="font-semibold">סכום:</span> {result?.tx?.TransactionSum || '-'}
          </div>
          <div>
            <span className="font-semibold">אסמכתא:</span> {result?.tx?.ApprovalNumber || '-'}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href={backHref}
            className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}
