'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const REGISTRATION_ENDPOINT = '/api/affiliatewp/registration-form';

function enhanceAffiliateWpForm(root) {
  if (!root) return;

  const form = root.querySelector('form');

  if (!form || form.dataset.lfEnhanced === 'true') {
    return;
  }

  form.dataset.lfEnhanced = 'true';
  form.classList.add('lf-affwp-card');

  form.querySelectorAll('p, div, fieldset').forEach(section => {
    section.classList.add('lf-affwp-field');
  });

  form.querySelectorAll('label').forEach(label => {
    label.classList.add('lf-affwp-label');
  });

  form.querySelectorAll('input, select, textarea').forEach(input => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.classList.add('lf-affwp-check');
      return;
    }

    if (input.type === 'submit') {
      input.classList.add('lf-affwp-submit');
    } else {
      input.classList.add('lf-affwp-input');
    }
  });

  form.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.lfEnhanced === 'true') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'lf-affwp-input-wrapper';

    const parent = input.parentNode;

    if (!parent) return;

    parent.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'lf-affwp-toggle';
    toggle.setAttribute('aria-label', 'Toggle password visibility');
    toggle.title = 'Toggle password visibility';

    const icon = document.createElement('span');
    icon.className = 'lf-affwp-toggle-icon';
    icon.setAttribute('aria-hidden', 'true');
    toggle.appendChild(icon);

    toggle.addEventListener('click', () => {
      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      toggle.classList.toggle('lf-affwp-toggle-active', !isVisible);
    });

    wrapper.appendChild(toggle);
    input.dataset.lfEnhanced = 'true';
  });

  const submit = form.querySelector('[type="submit"]');
  if (submit) {
    const submitRow = submit.closest('p, div, fieldset');
    if (submitRow) {
      submitRow.classList.add('lf-affwp-submit-row');
    }
  }
}

export default function AffiliateRegistrationForm() {
  const [status, setStatus] = useState('loading');
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [fallbackUrl, setFallbackUrl] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    async function loadForm() {
      try {
        const response = await fetch(REGISTRATION_ENDPOINT, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Request failed');
        }

        const payload = await response.json();

        if (!isActive) return;

        if (payload.pageUrl) {
          setFallbackUrl(payload.pageUrl);
        }

        if (payload.html) {
          setHtml(payload.html);
          setError(null);
          setStatus('loaded');
        } else {
          setHtml(null);
          setError(
            payload.error ??
              'We could not load the Affiliate sign-up form at the moment. Please try again later.'
          );
          setStatus('error');
        }
      } catch (err) {
        if (!isActive) return;
        setHtml(null);
        setError(
          'We could not load the Affiliate sign-up form at the moment. Please try again later.'
        );
        setStatus('error');
      }
    }

    loadForm();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'loaded') return;
    enhanceAffiliateWpForm(containerRef.current);
  }, [status, html]);

  if (status === 'loading') {
    return (
      <div className="lf-affwp-skeleton">
        <div className="lf-affwp-skeleton-line" />
        <div className="lf-affwp-skeleton-line" />
        <div className="lf-affwp-skeleton-line" />
        <div className="lf-affwp-skeleton-button" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-3xl border border-dashed border-primary-300 bg-primary-50/60 p-8 text-center text-sm text-primary-900">
        <p className="font-medium">{error}</p>
        {fallbackUrl ? (
          <p className="mt-3">
            You can continue by visiting our affiliate area directly.
            <br />
            <Link
              href={fallbackUrl}
              className="font-semibold text-primary underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Open the AffiliateWP sign-up page
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="lf-affwp-wrapper">
      {html ? (
        <div
          className="affwp-registration"
          dangerouslySetInnerHTML={{ __html: html }}
          suppressHydrationWarning
        />
      ) : null}
    </div>
  );
}
