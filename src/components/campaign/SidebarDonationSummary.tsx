'use client';

import Link from 'next/link';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { centsToDollarsWhole } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import {
  LockClosedIcon,
  HeartIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/solid';

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
        'space-y-5 rounded-2xl border border-border bg-card p-6',
        className,
      )}
    >
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums text-card-foreground">
            {centsToDollarsWhole(raisedAmount)}
          </span>
          <span className="text-sm text-muted-foreground">raised</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          of {centsToDollarsWhole(goalAmount)} goal
        </p>
      </div>

      <ProgressBar raisedAmount={raisedAmount} goalAmount={goalAmount} />

      <p className="text-sm text-muted-foreground">
        {donorCount.toLocaleString()} {donorCount === 1 ? 'donor' : 'donors'}
      </p>

      <Link
        href={donateHref}
        className="btn-press block w-full rounded-full bg-accent py-3.5 text-center text-base font-bold text-accent-foreground shadow-md transition-all hover:bg-accent/90"
      >
        Donate now
      </Link>

      <ul className="grid grid-cols-3 gap-2 text-[10.5px] font-medium text-muted-foreground">
        <li className="flex flex-col items-center gap-1 text-center">
          <LockClosedIcon className="h-4 w-4" aria-hidden="true" />
          <span>Stripe secured</span>
        </li>
        <li className="flex flex-col items-center gap-1 text-center">
          <HeartIcon className="h-4 w-4" aria-hidden="true" />
          <span>0% platform fees</span>
        </li>
        <li className="flex flex-col items-center gap-1 text-center">
          <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
          <span>Reviewed</span>
        </li>
      </ul>
    </div>
  );
}
