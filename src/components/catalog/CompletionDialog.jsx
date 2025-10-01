// src/components/catalog/CompletionDialog.jsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { wpApiFetch } from '@/lib/wpApi';

/**
 * Fullscreen, non-dismissible dialog that sits over the page.
 * - User can scroll the page to preview, but cannot interact with it.
 * - No close button. It only closes on successful submit.
 * - Pass withBackdrop={false} to remove the visible dark overlay while still blocking clicks.
 */
export default function CompletionDialog({
  slug,
  pageId,
  onSuccess, // callback when server confirms success
  catalogDomain = 'catalog.lineflow.ai',
  withBackdrop = true, // set false to remove overlay color
}) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [desiredSlug, setDesiredSlug] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const slugCandidate = (desiredSlug || '').trim().toLowerCase();
  const isSlugValid = !!slugCandidate && /^[a-z0-9-]+$/.test(slugCandidate);
  const isReady = !!email && !!phone && isSlugValid && agree && !submitting;

  const handleSubmit = async e => {
    e.preventDefault();
    setErr('');
    if (submitting || !isReady) return;

    setSubmitting(true);
    try {
      // Hit your WP REST endpoint to finalize catalog and update slug/status
      // Adjust endpoint path if yours differs
      const res = await wpApiFetch('company-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId || null,
          source_slug: slug,
          email,
          phone,
          desired_slug: slugCandidate,
        }),
      });

      if (!res.ok) {
        const msg = await safeReadText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }

      const json = await res.json();
      // Expecting { success: true, slug: 'my-website', url: 'https://catalog.lineflow.ai/my-website' }
      if (!json?.success || !json?.slug) {
        throw new Error('Unexpected response from server.');
      }

      if (typeof onSuccess === 'function') onSuccess(json);

      // Update the URL to the new pretty slug.
      // Use replace so back button doesn’t return to the temp link.
      await router.replace(`/${json.slug}`);
      // Component is intended to be unmounted by parent when status changes or local flag toggles.
    } catch (e2) {
      setErr(e2?.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[1000] ${withBackdrop ? 'bg-black/40' : 'bg-transparent'}`}
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8">
        <div className="pointer-events-auto w-full max-w-xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 text-center">Show Your Catalog</h2>

            {err ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-primary">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  placeholder="myemail@email.com"
                  className="mt-1 w-full rounded-[8px] border border-grey-300 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-primary">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="123-456-7890"
                  className="mt-1 w-full rounded-[8px] border border-grey-300 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {/* Desired URL */}
              <div>
                <label className="block text-sm font-medium text-primary">
                  Choose your catalog URL <span className="text-red-600">*</span>
                </label>

                <div className="mt-1 flex items-stretch rounded-[8px] border border-grey-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="inline-flex items-center whitespace-nowrap pl-3 text-base text-secondary">
                    {catalogDomain}/
                  </span>
                  <input
                    type="text"
                    inputMode="text"
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers, and hyphens"
                    placeholder="my-website"
                    className="flex-1 min-w-0 pl-1 pr-4 py-3 text-base outline-none disabled:opacity-60"
                    value={desiredSlug}
                    onChange={e => setDesiredSlug(e.target.value.toLowerCase())}
                    disabled={submitting}
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Final URL will be{' '}
                  <code>
                    https://{catalogDomain}/{slugCandidate || 'my-website'}
                  </code>
                </p>
              </div>

              {/* Terms */}
              <label className="mt-5 flex items-start gap-3 text-sm text-primary">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-grey-300 disabled:opacity-60"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  disabled={submitting}
                  required
                />
                <span className="text-base text-primary">
                  I agree to the{' '}
                  <a href="#" className="text-tertiary underline">
                    terms and conditions
                  </a>{' '}
                  as set out by the user agreement.
                  <span className="text-red-600"> *</span>
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isReady}
                aria-disabled={!isReady}
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-tertiary px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                title={!isReady ? 'Fill all fields and accept the terms to continue' : undefined}
              >
                {submitting ? 'Generating…' : 'Generate Catalog Now'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
