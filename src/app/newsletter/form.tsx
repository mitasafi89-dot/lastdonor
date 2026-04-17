'use client';

import { useState } from 'react';

/*
 * Form states and transitions:
 *
 *   idle ──submit──▶ loading ──200──▶ success
 *                        │
 *                        └──4xx/5xx──▶ error ──type──▶ idle (auto-clear)
 *
 * The API returns granular statuses (subscribed, already_subscribed, resubscribed).
 * We surface "already_subscribed" distinctly because it's confusing to say "success!"
 * when the user thinks they just signed up. Honest feedback builds trust.
 *
 * Error messages from the API are surfaced directly when available, falling back to
 * a generic message. The error auto-clears on input change to reduce friction.
 *
 * The visible label ("Your email") replaces the previous sr-only label.
 * Rationale: Nielsen Norman Group research shows visible labels outperform
 * placeholder-only patterns on every metric (speed, errors, satisfaction).
 * The placeholder still exists as a format hint, not a label.
 */

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'newsletter' }),
      });

      const json = await res.json();

      if (json.ok) {
        if (json.data?.status === 'already_subscribed') {
          setStatus('already');
        } else {
          setStatus('success');
        }
        setEmail('');
      } else {
        setErrorMsg(json.error?.message || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Could not connect. Check your internet and try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div
        className="flex flex-col items-center py-2 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-teal/10">
          <CheckmarkIcon />
        </div>
        <p className="mt-3 font-semibold text-foreground">You&apos;re subscribed!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check your inbox for a welcome email.
        </p>
      </div>
    );
  }

  if (status === 'already') {
    return (
      <div
        className="flex flex-col items-center py-2 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-foreground">You&apos;re already on the list</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We send every Thursday. Nothing extra to do.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="newsletter-page-email"
        className="text-sm font-medium text-foreground"
      >
        Your email
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="newsletter-page-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') {
              setStatus('idle');
              setErrorMsg('');
            }
          }}
          aria-describedby={status === 'error' ? 'newsletter-error' : undefined}
          aria-invalid={status === 'error' || undefined}
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn-press rounded-xl bg-brand-amber px-8 py-3 text-sm font-bold text-white transition-all hover:bg-brand-amber/90 hover:shadow-md disabled:opacity-60"
        >
          {status === 'loading' ? 'Subscribing\u2026' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && (
        <p
          id="newsletter-error"
          role="alert"
          className="mt-3 text-sm text-destructive"
        >
          {errorMsg}
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        By subscribing, you agree to our{' '}
        <a href="/privacy" className="underline hover:text-foreground">
          privacy policy
        </a>
        . Unsubscribe anytime.
      </p>
    </form>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5 text-brand-teal"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}
