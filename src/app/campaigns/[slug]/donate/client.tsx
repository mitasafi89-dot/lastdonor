'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';
import { DonationForm } from '@/components/campaign/DonationForm';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { centsToDollarsWhole } from '@/lib/utils/currency';

interface DonatePageClientProps {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  raisedAmount: number;
  goalAmount: number;
  donorCount: number;
  initialAmount?: number;
  isDonationSuccess: boolean;
  confirmedAmount?: number;
  sessionId?: string;
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
  confirmedAmount: confirmedAmountFromUrl,
  sessionId,
  paymentIntentId,
}: DonatePageClientProps) {
  const router = useRouter();
  const confirmSent = useRef(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number>(confirmedAmountFromUrl ?? 0);

  useEffect(() => {
    if (!isDonationSuccess || confirmSent.current) return;
    // Handle both Checkout Session return and PaymentIntent return
    if (sessionId || paymentIntentId) {
      confirmSent.current = true;
      const body = sessionId
        ? { sessionId }
        : { paymentIntentId };
      fetch('/api/v1/donations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && json.amount) setConfirmedAmount(json.amount);
        })
        .catch(() => {});
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [isDonationSuccess, sessionId, paymentIntentId]);



  return (
    <div className="min-h-[100dvh] bg-muted/30">
      {/* Top bar */}
      <nav className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-3">
          <Link
            href={`/campaigns/${campaignSlug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to campaign
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-card shadow-[--shadow-elevation-2]">
          {/* Campaign context + Goal-Gradient progress strip.
              Shows users the campaign progress their donation will advance. */}
          <div className="border-b border-border px-8 pt-8 sm:px-10 sm:pt-10">
            <h1 className="font-display text-xl font-bold text-card-foreground sm:text-2xl">
              {campaignTitle}
            </h1>

            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="tabular-nums">
                  <span className="font-mono font-semibold text-foreground">
                    {centsToDollarsWhole(raisedAmount)}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}of {centsToDollarsWhole(goalAmount)}
                  </span>
                </span>
              </div>
              <ProgressBar
                raisedAmount={raisedAmount}
                goalAmount={goalAmount}
                compact
              />
              <p className="text-xs tabular-nums text-muted-foreground">
                {donorCount.toLocaleString()} {donorCount === 1 ? 'person has' : 'people have'} donated
              </p>
            </div>
          </div>

          {/* Donation form */}
          <div className="px-8 pb-8 pt-6 sm:px-10 sm:pb-10">
            <DonationForm
              campaignId={campaignId}
              campaignTitle={campaignTitle}
              campaignSlug={campaignSlug}
              embedded
              initialAmount={initialAmount}
              initialStep={isDonationSuccess ? 'success' : undefined}
              initialConfirmedAmount={confirmedAmount}
              onDonationComplete={() => router.refresh()}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
