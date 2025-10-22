// src/components/CompletionDialog.jsx
// Full update: Uses Next.js slug cache (/api/slugs/index + /api/slugs/shard) to
// load all slugs once into memory and give instant local availability checks.
// - While typing, we never hit WordPress.
// - Field border turns red immediately if the slug is taken/invalid.
// - Submit is disabled if the slug is taken/invalid; WP still does final validation.

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { wpApiFetch } from '@/lib/wpApi';

// [PATCH] Per-prefix in-memory cache for instant checks
// Map<prefix, Set<string>>
const __PREFIX_CACHE = new Map();
const __PENDING = new Map(); // Map<prefix, Promise<Set<string>>>

function prefixOf(s) {
  const v = (s || '').toLowerCase();
  if (!v) return '';
  return v.slice(0, Math.min(2, v.length));
}

async function loadPrefixSet(pfx) {
  const p = prefixOf(pfx);
  if (!p) return new Set();
  if (__PREFIX_CACHE.has(p)) return __PREFIX_CACHE.get(p);
  if (__PENDING.has(p)) return __PENDING.get(p);
  const prom = (async () => {
    const text = await fetch(`/api/slugs/by-prefix?p=${encodeURIComponent(p)}`, {
      cache: 'no-store',
    })
      .then(r => (r.ok ? r.text() : ''))
      .catch(() => '');
    const set = new Set();
    if (text) {
      for (const line of text.split('\n')) {
        const s = line.trim().toLowerCase();
        if (s) set.add(s);
      }
    }
    __PREFIX_CACHE.set(p, set);
    __PENDING.delete(p);
    return set;
  })();
  __PENDING.set(p, prom);
  return prom;
}

const RESERVED = new Set([
  'admin',
  'wp',
  'wp-admin',
  'wp-login',
  'login',
  'api',
  'graphql',
  'cart',
  'checkout',
  'account',
  'user',
  'static',
  'assets',
  '_next',
  'next',
  'vercel',
  'sso',
  'auth',
]);

const isValidSlug = s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s || '');

export default function CompletionDialog({
  slug,
  pageId,
  onSuccess,
  catalogDomain = 'catalog.lineflow.ai',
  withBackdrop = true,
}) {
  const router = useRouter();

  // form state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [desiredSlug, setDesiredSlug] = useState('');
  const [agree, setAgree] = useState(false);

  // ui state
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState({}); // { email, phone, mini_url, terms_check }

  // live slug status: idle | checking | available | taken | invalid
  const [slugStatus, setSlugStatus] = useState('idle');

  // [PATCH] Track mount to avoid hydration mismatch for client-only UI bits
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const slugCandidate = (desiredSlug || '').trim().toLowerCase();

  // Clear specific backend error as the user types
  const clearFieldError = key => {
    if (fieldErrors[key]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  // Instant local availability check using cached shards
  useEffect(() => {
    let cancelled = false;

    (async () => {
      clearFieldError('mini_url');

      if (!slugCandidate) {
        setSlugStatus('idle');
        return;
      }

      if (!isValidSlug(slugCandidate)) {
        setSlugStatus('invalid');
        return;
      }

      if (RESERVED.has(slugCandidate)) {
        setSlugStatus('taken');
        return;
      }

      // First run loads shards; subsequent runs are instant
      try {
        const pfx = prefixOf(slugCandidate);
        if (!__PREFIX_CACHE.has(pfx)) setSlugStatus('checking');
        const set = await loadPrefixSet(pfx);
        if (cancelled) return;

        setSlugStatus(set.has(slugCandidate) ? 'taken' : 'available');
      } catch {
        // If we failed to load shards (network etc.), stay neutral;
        // final server validation still protects on submit.
        if (!cancelled) setSlugStatus('idle');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugCandidate]);

  // Button readiness
  const isReady =
    !!email &&
    !!phone &&
    isValidSlug(slugCandidate) &&
    slugStatus !== 'taken' &&
    slugStatus !== 'invalid' &&
    agree &&
    !submitting;

  // Utility for error borders
  const inputBorder = hasError =>
    hasError || slugStatus === 'taken' || slugStatus === 'invalid'
      ? 'border-red-500 focus-within:ring-red-500'
      : slugStatus === 'available'
        ? 'border-emerald-500 focus-within:ring-emerald-500'
        : 'border-grey-300 focus-within:ring-grey-500';

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setFieldErrors({});

    if (submitting) return;

    // Early guard on known-taken/invalid
    if (!isValidSlug(slugCandidate)) {
      setFieldErrors(prev => ({
        ...prev,
        mini_url: 'Use lowercase letters, numbers and hyphens.',
      }));
      return;
    }
    if (slugStatus === 'taken') {
      setFieldErrors(prev => ({
        ...prev,
        mini_url: 'This slug is already taken. Please choose another.',
      }));
      return;
    }

    if (!isReady) return;

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

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        if (json?.errors && typeof json.errors === 'object') {
          setFieldErrors(json.errors);
          const firstMsg = Object.values(json.errors)[0];
          setErr(typeof firstMsg === 'string' ? firstMsg : 'Please check the highlighted fields.');
        } else {
          setErr(json?.message || `Request failed (${res.status})`);
        }
        setSubmitting(false);
        return;
      }

      // Success path (server remains authoritative)
      // Success path (server remains authoritative)
      const nextSlug = (
        json?.data?.slug ||
        json?.data?.mini_url ||
        slugCandidate ||
        ''
      ).toLowerCase();
      // Optimistically add to the current prefix set for instant "Taken"
      const pfx = prefixOf(nextSlug);
      if (pfx) {
        const set = __PREFIX_CACHE.get(pfx) || new Set();
        set.add(nextSlug);
        __PREFIX_CACHE.set(pfx, set);
      }

      // Hard redirect for instant navigation to the new resource/URL if absolute provided
      if (/^https?:\/\//i.test(nextSlug)) {
        window.location.assign(nextSlug);
      } else {
        router.push(`${nextSlug}`);
      }

      if (typeof onSuccess === 'function') onSuccess(json);
    } catch (e2) {
      setErr(e2?.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

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
                  className={`mt-1 w-full rounded-[8px] border px-4 py-3 text-base outline-none disabled:opacity-60 ${fieldErrors.email ? 'border-red-500 ring-1 ring-red-400 focus:ring-red-500' : 'border-grey-300 focus:ring-grey-500'}`}
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
                  className={`mt-1 w-full rounded-[8px] border px-4 py-3 text-base outline-none disabled:opacity-60 ${fieldErrors.phone ? 'border-red-500 ring-1 ring-red-400 focus:ring-red-500' : 'border-grey-300 focus:ring-grey-500'}`}
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

              {/* Desired mini URL */}
              <div>
                <label className="block text-sm font-medium text-primary">
                  Choose your catalog URL <span className="text-red-600">*</span>
                </label>

                <div
                  className={`mt-1 flex items-stretch rounded-[8px] border overflow-hidden focus-within:ring-2 ${inputBorder(!!fieldErrors.mini_url)}`}
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
                      clearFieldError('mini_url');
                    }}
                    disabled={submitting}
                    required
                    aria-invalid={
                      !!fieldErrors.mini_url || slugStatus === 'taken' || slugStatus === 'invalid'
                    }
                    aria-describedby={fieldErrors.mini_url ? 'mini-url-error' : undefined}
                  />

                  {/* Status pill */}
                  {/* [PATCH] Status pill: render contents only after mount to prevent SSR/CSR mismatch */}
                  <span className="inline-flex items-center px-3 text-sm" suppressHydrationWarning>
                    {mounted && slugStatus === 'checking' && (
                      <span className="animate-pulse">Checking…</span>
                    )}
                    {mounted && slugStatus === 'available' && (
                      <span className="font-medium">✅ Available</span>
                    )}
                    {mounted && slugStatus === 'taken' && (
                      <span className="text-red-600 font-medium">Taken</span>
                    )}
                    {mounted && slugStatus === 'invalid' && (
                      <span className="text-red-600">Invalid</span>
                    )}
                  </span>
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
              <label className="mt-5 flex items-start gap-3 text-sm text-primary cursor-pointer">
                <div className="relative inline-block w-5 h-5">
                  <input
                    type="checkbox"
                    className={`mt-1 h-4 w-4 rounded disabled:opacity-60 ${
                      fieldErrors.terms_check
                        ? 'ring-1 ring-red-400 border-red-500'
                        : 'border-grey-300'
                    }`}
                    checked={agree}
                    onChange={e => {
                      setAgree(e.target.checked);
                      clearFieldError('terms_check');
                    }}
                    disabled={submitting}
                    required
                    aria-invalid={!!fieldErrors.terms_check}
                    aria-describedby={fieldErrors.terms_check ? 'terms-error' : undefined}
                  />
                  <svg
                    viewBox="0 0 20 20"
                    class="pointer-events-none absolute inset-0 m-auto w-3.5 h-3.5
             opacity-0 transition-opacity duration-150
             peer-checked:opacity-100 z-[2]"
                  >
                    <path
                      d="M5 10.5l3 3 7-7"
                      fill="none"
                      stroke="white"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <span className="text-base text-primary">
                  I agree to the{' '}
                  <a href="#" className="text-tertiary underline" target="_blank">
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
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-tertiary px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-grey-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                title={
                  !isReady
                    ? 'Fill all fields, choose an available slug, and accept the terms to continue'
                    : undefined
                }
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
