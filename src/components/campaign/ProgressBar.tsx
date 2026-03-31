'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getCampaignPhase } from '@/lib/utils/phase';
import type { DonationPhase } from '@/types';

const PHASE_COLORS: Record<DonationPhase, string> = {
  first_believers: 'bg-brand-teal',
  the_push: 'bg-brand-teal',
  closing_in: 'bg-brand-amber',
  last_donor_zone: 'bg-brand-red',
};

interface ProgressBarProps {
  raisedAmount: number;
  goalAmount: number;
  className?: string;
  /** Show as a compact bar (e.g. mobile sticky bar) */
  compact?: boolean;
}

export function ProgressBar({
  raisedAmount,
  goalAmount,
  className,
  compact = false,
}: ProgressBarProps) {
  const percent = goalAmount > 0
    ? Math.min(Math.round((raisedAmount / goalAmount) * 100), 100)
    : 0;
  const phase = getCampaignPhase(raisedAmount, goalAmount);
  const colorClass = PHASE_COLORS[phase];
  const isLastDonorZone = phase === 'last_donor_zone';

  return (
    <div
      role="progressbar"
      aria-valuenow={raisedAmount}
      aria-valuemin={0}
      aria-valuemax={goalAmount}
      aria-label={`Campaign progress: ${percent}% funded`}
      className={cn(
        'w-full overflow-hidden rounded-full bg-muted',
        compact ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <motion.div
        className={cn(
          'h-full rounded-full',
          colorClass,
          isLastDonorZone && 'animate-pulse',
        )}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}
