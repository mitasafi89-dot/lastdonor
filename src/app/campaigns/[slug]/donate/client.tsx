'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DonationForm } from '@/components/campaign/DonationForm';

interface DonatePageClientProps {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  raisedAmount: number;
  goalAmount: number;
  donorCount: number;
  initialAmount?: number;
  isDonationSuccess: boolean;
  paymentIntentId?: string;
}

export function DonatePageClient({
  campaignId,
  campaignSlug,
  campaignTitle,
  raisedAmount,
  goalAmount,
  donorCount,
  initialAmount,
  isDonationSuccess,
  paymentIntentId,
}: DonatePageClientProps) {
  const router = useRouter();
  const confirmSent = useRef(false);

  // Handle Stripe redirect return — confirm payment server-side
  useEffect(() => {
    if (!isDonationSuccess || !paymentIntentId || confirmSent.current) return;
    confirmSent.current = true;
    fetch('/api/v1/donations/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    }).catch(() => {});
    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname);
  }, [isDonationSuccess, paymentIntentId]);

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      {/* Top bar */}
      <nav className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-3">
          <Link
            href={`/campaigns/${campaignSlug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to campaign
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-card shadow-md">
          {/* Campaign title + subtle social proof */}
          <div className="px-8 pt-8 sm:px-10 sm:pt-10">
            <h1 className="text-xl font-semibold text-card-foreground">
              {campaignTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {donorCount.toLocaleString()} {donorCount === 1 ? 'person has' : 'people have'} donated
            </p>
          </div>

          {/* Donation form */}
          <div className="px-8 pb-8 pt-6 sm:px-10 sm:pb-10">
            <DonationForm
              campaignId={campaignId}
              campaignTitle={campaignTitle}
              embedded
              initialAmount={initialAmount}
              initialStep={isDonationSuccess ? 'success' : undefined}
              onDonationComplete={() => router.refresh()}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
