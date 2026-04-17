'use client';

import { ArrowRightIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { centsToDollars } from '@/lib/utils/currency';
import type { ImpactTier } from '@/types';

interface ImpactTiersProps {
  tiers: ImpactTier[];
  onSelectAmount?: (amountCents: number) => void;
  className?: string;
}

export function ImpactTiers({ tiers, onSelectAmount, className }: ImpactTiersProps) {
  if (tiers.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-display text-lg font-semibold text-card-foreground">
        Choose your impact
      </h3>

      <div className="grid gap-2">
        {tiers.map((tier) => (
          <button
            key={`${tier.amount}-${tier.label}`}
            type="button"
            onClick={() => onSelectAmount?.(tier.amount)}
            aria-label={`Donate ${centsToDollars(tier.amount)}: ${tier.label}`}
            className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                {centsToDollars(tier.amount)}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {tier.label}
              </span>
            </div>
            <ArrowRightIcon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
