import { Suspense } from 'react';
import type { Metadata } from 'next';
import { UnsubscribeClient } from './client';

export const metadata: Metadata = {
  title: 'Unsubscribe from Campaign Updates - LastDonor.org',
  robots: { index: false },
};

export default function UnsubscribePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Suspense fallback={<div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-muted" />}>
        <UnsubscribeClient />
      </Suspense>
    </div>
  );
}
