// [PATCH] Added field-level error state and helpers
import { useState } from 'react';
import { useRouter } from 'next/router';
import { wpApiFetch } from '@/lib/wpApi';

export default function CompletionDialog({
  slug,
  pageId,
  onSuccess,
  catalogDomain = 'catalog.lineflow.ai',
  withBackdrop = true,
}) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [desiredSlug, setDesiredSlug] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  // [PATCH] Track per-field errors from backend: keys like email, phone, mini_url, terms_check
  const [fieldErrors, setFieldErrors] = useState({}); // { mini_url: "message", email: "message", ... }

  const slugCandidate = (desiredSlug || '').trim().toLowerCase();
  const isSlugValid = !!slugCandidate && /^[a-z0-9-]+$/.test(slugCandidate);
  const isReady = !!email && !!phone && isSlugValid && agree && !submitting;

  // [PATCH] Utility to add error classes when a field has an error
  const errCls = hasErr =>
    hasErr ? 'border-red-500 ring-1 ring-red-400 focus:ring-red-500' : 'border-grey-300 focus:ring-indigo-500';

  // [PATCH] Clear a specific field error on change
  const clearFieldError = key => {
    if (fieldErrors[key]) {
      setFieldErrors(prev => {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErr('');
    setFieldErrors({}); // [PATCH] reset per submit
    if (submitting || !isReady) return;

    setSubmitting(true);
    try {
      const res = await wpApiFetch('update-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId || null,
          source_slug: slug,
          email,
          phone,
          mini_url: slugCandidate,
          terms_check: agree ? 'yes' : 'no',
        }),
      });

      if (!res.ok) {
        const msg = await safeReadText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }

      const json = await res.json();
      // // Expecting { success: true, slug: 'my-website', url: 'https://catalog.lineflow.ai/my-website' }
      // if (!json?.success || !json?.data?.slug) {
      //   throw new Error('Unexpected response from server.');
      // }

      console.log('update-catalog res', json);

      if (!res.ok) {
        if (json?.errors) {
          setFieldErrors(json.errors);
          // surface the first message to the banner too
          const firstMsg = Object.values(json.errors)[0];
          setErr(typeof firstMsg === 'string' ? firstMsg : 'Please check the highlighted fields.');
        } else {
          const msg = await safeReadText(res);
          setErr(msg || `Request failed (${res.status})`);
        }
        setSubmitting(false);
        return;
      }

      // Expecting success flag from server; also handle success:false with errors
      if (!json?.success) {
        if (json?.errors && typeof json.errors === 'object') {
          setFieldErrors(json.errors);
          const firstMsg = Object.values(json.errors)[0];
          setErr(typeof firstMsg === 'string' ? firstMsg : 'Please check the highlighted fields.');
        } else {
          setErr(json?.message || 'Unexpected response from server.');
        }
        setSubmitting(false);
        return;
      }

      // Success path
      const nextSlug = json?.data?.slug;
      if (!nextSlug) {
        throw new Error('Unexpected response from server.');
      }

      if (typeof onSuccess === 'function') onSuccess(json);

      // [PATCH] Instant navigation: use hard replace for zero-lag redirect
      // This avoids Router prefetch/ISR timing and goes immediately.
      router.push(`${nextSlug}`);

      // If you prefer Next Router but want it snappier, you could keep:
      // await router.replace(`/${nextSlug}`);
    } catch (e2) {
      setErr(e2?.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  console.log('fieldErrors', fieldErrors);
  console.log('fieldErrors', fieldErrors);

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
                  // [PATCH] Add dynamic error + aria-invalid
                  className={`mt-1 w-full rounded-[8px] border px-4 py-3 text-base outline-none disabled:opacity-60 ${errCls(
                    !!fieldErrors.email
                  )}`}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  disabled={submitting}
                  required
                />
                {/* [PATCH] Inline error */}
                {fieldErrors.email ? (
                  <p id="email-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-primary">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="123-456-7890"
                  className={`mt-1 w-full rounded-[8px] border px-4 py-3 text-base outline-none disabled:opacity-60 ${errCls(
                    !!fieldErrors.phone
                  )}`}
                  aria-invalid={!!fieldErrors.phone}
                  aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    clearFieldError('phone');
                  }}
                  disabled={submitting}
                  required
                />
                {fieldErrors.phone ? (
                  <p id="phone-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>

              {/* Desired URL */}
              <div>
                <label className="block text-sm font-medium text-primary">
                  Choose your catalog URL <span className="text-red-600">*</span>
                </label>

                <div
                  className={`mt-1 flex items-stretch rounded-[8px] border overflow-hidden focus-within:ring-2 ${
                    fieldErrors.mini_url ? 'border-red-500 focus-within:ring-red-500' : 'border-grey-300 focus-within:ring-indigo-500'
                  }`}
                >
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
                    onChange={e => {
                      setDesiredSlug(e.target.value.toLowerCase());
                      clearFieldError('mini_url'); // [PATCH]
                    }}
                    disabled={submitting}
                    required
                    aria-invalid={!!fieldErrors.mini_url}
                    aria-describedby={fieldErrors.mini_url ? 'mini-url-error' : undefined}
                  />
                </div>
                {fieldErrors.mini_url ? (
                  <p id="mini-url-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.mini_url}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Final URL will be{' '}
                    <code>
                      https://{catalogDomain}/{slugCandidate || 'my-website'}
                    </code>
                  </p>
                )}
              </div>

              {/* Terms */}
              <label className="mt-5 flex items-start gap-3 text-sm text-primary">
                <input
                  type="checkbox"
                  className={`mt-1 h-4 w-4 rounded disabled:opacity-60 ${
                    fieldErrors.terms_check ? 'ring-1 ring-red-400 border-red-500' : 'border-grey-300'
                  }`}
                  checked={agree}
                  onChange={e => {
                    setAgree(e.target.checked);
                    clearFieldError('terms_check'); // [PATCH]
                  }}
                  disabled={submitting}
                  required
                  aria-invalid={!!fieldErrors.terms_check}
                  aria-describedby={fieldErrors.terms_check ? 'terms-error' : undefined}
                />
                <span className="text-base text-primary">
                  I agree to the{' '}
                  <a href="#" className="text-tertiary underline">
                    terms and conditions
                  </a>{' '}
                  as set out by the user agreement.
                  <span className="text-red-600"> *</span>
                  {fieldErrors.terms_check ? (
                    <span id="terms-error" className="ml-2 text-sm text-red-600">
                      {fieldErrors.terms_check}
                    </span>
                  ) : null}
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
