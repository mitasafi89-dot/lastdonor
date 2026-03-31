'use client';

import Link from 'next/link';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { centsToDollars } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

interface SidebarDonationSummaryProps {
  raisedAmount: number;
  goalAmount: number;
  donorCount: number;
  donateHref: string;
  className?: string;
}

export function SidebarDonationSummary({
  raisedAmount,
  goalAmount,
  donorCount,
  donateHref,
  className,
}: SidebarDonationSummaryProps) {
  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border border-border bg-card p-6',
        className,
      )}
    >
      {/* Progress */}
      <ProgressBar raisedAmount={raisedAmount} goalAmount={goalAmount} />

      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-2xl font-bold text-card-foreground">
            {centsToDollars(raisedAmount)}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">raised</span>
        </div>
        <span className="text-sm text-muted-foreground">
          of {centsToDollars(goalAmount)}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {donorCount.toLocaleString()} {donorCount === 1 ? 'donor' : 'donors'}
      </p>

      {/* Primary CTA */}
      <Link
        href={donateHref}
        className="block w-full rounded-full bg-accent py-3.5 text-center text-base font-semibold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 hover:shadow-md active:scale-[0.98]"
      >
        Donate now
      </Link>

      {/* Trust line */}
      <p className="text-center text-xs text-muted-foreground">
        Secure donation via Stripe. 100% goes to the cause.
      </p>
    </div>
  );
}
