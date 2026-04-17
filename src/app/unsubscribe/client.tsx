'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BellSlashIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

type State = 'loading' | 'success' | 'error' | 'missing-params';

export function UnsubscribeClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const campaignSlug = searchParams.get('campaign');
  const [state, setState] = useState<State>('loading');

  const unsubscribe = useCallback(async () => {
    if (!email || !campaignSlug) {
      setState('missing-params');
      return;
    }

    try {
      const res = await fetch(`/api/v1/campaigns/${encodeURIComponent(campaignSlug)}/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      setState(json.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  }, [email, campaignSlug]);

  useEffect(() => {
    unsubscribe();
  }, [unsubscribe]);

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      {state === 'loading' && (
        <>
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Unsubscribing...</p>
        </>
      )}

      {state === 'success' && (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CheckCircleIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Unsubscribed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You will no longer receive updates for this campaign.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Home
          </Link>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <ExclamationCircleIcon className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not process your unsubscribe request. Please try again or contact support.
          </p>
          <button
            type="button"
            onClick={() => { setState('loading'); unsubscribe(); }}
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try Again
          </button>
        </>
      )}

      {state === 'missing-params' && (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <BellSlashIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Invalid Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This unsubscribe link appears to be incomplete. Please use the link from your email.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Home
          </Link>
        </>
      )}
    </div>
  );
}
