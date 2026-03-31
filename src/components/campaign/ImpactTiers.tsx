'use client';

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
        Your Impact
      </h3>
      <div className="grid gap-2">
        {tiers.map((tier) => (
          <button
            key={`${tier.amount}-${tier.label}`}
            type="button"
            onClick={() => onSelectAmount?.(tier.amount)}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
          >
            <span className="text-sm text-card-foreground">{tier.label}</span>
            <span className="font-mono text-sm font-medium text-accent">
              {centsToDollars(tier.amount)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
