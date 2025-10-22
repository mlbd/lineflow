'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './AffiliateRegistrationForm.module.css';

const REGISTRATION_ENDPOINT = '/api/affiliatewp/registration-form';
const DEFAULT_FALLBACK_URL = 'https://min.lukpaluk.xyz/affiliate-area/';

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
  const [fallbackUrl, setFallbackUrl] = useState(DEFAULT_FALLBACK_URL);
  const [formAction, setFormAction] = useState(DEFAULT_FALLBACK_URL);
  const [submissionFeedback, setSubmissionFeedback] = useState({ status: 'idle', message: null });
  const containerRef = useRef(null);
  const submissionStateRef = useRef({ status: 'idle', message: null });

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadForm() {
      try {
        const response = await fetch(REGISTRATION_ENDPOINT, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Request failed');
        }

        const payload = await response.json();

        if (!isActive) return;

        setFallbackUrl(payload.pageUrl ?? DEFAULT_FALLBACK_URL);
        setFormAction(payload.formAction ?? payload.pageUrl ?? DEFAULT_FALLBACK_URL);

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
        if (!isActive || err?.name === 'AbortError') return;
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
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== 'loaded') return;
    const root = containerRef.current;
    enhanceAffiliateWpForm(root);

    if (!root) return;

    const form = root.querySelector('form');

    if (!form) return;

    form.dataset.lfAction = formAction ?? DEFAULT_FALLBACK_URL;

    const submitButton = form.querySelector('[type="submit"]');

    function setButtonDisabled(disabled) {
      if (!submitButton) return;
      submitButton.disabled = disabled;
      submitButton.classList.toggle('lf-affwp-submit--loading', disabled);
    }

    function handleSubmit(event) {
      event.preventDefault();

      if (submissionStateRef.current.status === 'submitting') {
        return;
      }

      const targetAction = form.dataset.lfAction || formAction || DEFAULT_FALLBACK_URL;
      const formData = new FormData(form);
      formData.append('__form_action', targetAction);

      const nextState = { status: 'submitting', message: null };
      submissionStateRef.current = nextState;
      setSubmissionFeedback(nextState);
      setButtonDisabled(true);

      fetch(REGISTRATION_ENDPOINT, {
        method: 'POST',
        body: formData,
      })
        .then(async res => {
          let payload = null;

          try {
            payload = await res.json();
          } catch (err) {
            payload = null;
          }

          if (payload?.success) {
            const successState = {
              status: 'success',
              message:
                payload.message ??
                'Thanks! Your affiliate application has been received. We will be in touch shortly.',
            };
            submissionStateRef.current = successState;
            setSubmissionFeedback(successState);
            form.reset();
            setButtonDisabled(false);
            return;
          }

          const errorState = {
            status: 'error',
            message:
              payload?.message ??
              'We could not submit your affiliate application. Please verify the details and try again.',
          };
          submissionStateRef.current = errorState;
          setSubmissionFeedback(errorState);
          setButtonDisabled(false);
        })
        .catch(() => {
          const errorState = {
            status: 'error',
            message:
              'Something went wrong while submitting your application. Please refresh the page and try again.',
          };
          submissionStateRef.current = errorState;
          setSubmissionFeedback(errorState);
          setButtonDisabled(false);
        });
    }

    form.addEventListener('submit', handleSubmit);

    return () => {
      form.removeEventListener('submit', handleSubmit);
      setButtonDisabled(false);
    };
  }, [status, html, formAction]);

  if (status === 'loading') {
    return (
      <div className={styles.skeleton}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} style={{ width: '92%' }} />
        <div className={styles.skeletonLine} style={{ width: '86%' }} />
        <div className={styles.skeletonButton} />
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
    <div ref={containerRef} className={styles.wrapper}>
      {html ? (
        <div
          className="affwp-registration"
          dangerouslySetInnerHTML={{ __html: html }}
          suppressHydrationWarning
        />
      ) : null}
      {submissionFeedback.status === 'success' || submissionFeedback.status === 'error' ? (
        <div
          className={`${styles.feedback} ${
            submissionFeedback.status === 'success' ? styles.feedbackSuccess : styles.feedbackError
          }`}
          role={submissionFeedback.status === 'error' ? 'alert' : 'status'}
        >
          {submissionFeedback.message}
        </div>
      ) : null}
    </div>
  );
}
