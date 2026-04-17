'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-5xl font-bold text-brand-teal">500</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        We encountered an unexpected error. Our team has been notified.
        Please try again or return to the homepage.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
