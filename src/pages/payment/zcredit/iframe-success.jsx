// /src/pages/payment/zcredit/iframe-success.jsx
'use client';
import { useEffect } from 'react';

function sanitizeSlug(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 120);
}

export default function IframeSuccess() {
  useEffect(() => {
    const url = new URL(window.location.href);

    const transactionUniqueId =
      url.searchParams.get('TransactionUniqueId') ||
      url.searchParams.get('transactionUniqueId') ||
      '';

    // accept ?slug= or ?pageSlug= (both sanitized)
    const rawSlug = url.searchParams.get('slug') || url.searchParams.get('pageSlug') || '';
    const slug = sanitizeSlug(rawSlug);

    // Notify parent (if embedded in an iframe)
    window.parent?.postMessage(
      { type: 'ZCREDIT_SUCCESS', transactionUniqueId, slug },
      window.location.origin
    );

    // If opened directly (not in iframe), redirect to the return page with slug
    if (window.top === window.self) {
      const q = new URLSearchParams({ status: 'success' });
      if (transactionUniqueId) q.set('transactionUniqueId', transactionUniqueId);
      if (slug) q.set('slug', slug);
      window.location.replace(`/payment/zcredit/return?${q.toString()}`);
    }
  }, []);

  return <div className="p-6 text-center">מעבד תשלום…</div>;
}
