'use client';

import Link from 'next/link';
import { ProgressBar } from '@/components/campaign/ProgressBar';
import { cn } from '@/lib/utils';

interface StickyMobileDonateBarProps {
  raisedAmount: number;
  goalAmount: number;
  donateHref: string;
  className?: string;
}

export function StickyMobileDonateBar({
  raisedAmount,
  goalAmount,
  donateHref,
  className,
}: StickyMobileDonateBarProps) {
  const percent = goalAmount > 0
    ? Math.min(Math.round((raisedAmount / goalAmount) * 100), 100)
    : 0;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <ProgressBar
            raisedAmount={raisedAmount}
            goalAmount={goalAmount}
            compact
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {percent}% funded
          </p>
        </div>
        <Link
          href={donateHref}
          className="shrink-0 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Donate
        </Link>
      </div>
    </div>
  );
}
