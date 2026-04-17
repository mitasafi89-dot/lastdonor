'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  raisedAmount: number;
  goalAmount: number;
  className?: string;
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

  const barHeight = compact ? 'h-1.5' : 'h-2.5';

  return (
    <div className={cn('relative', className)}>
      <div
        role="progressbar"
        aria-valuenow={raisedAmount}
        aria-valuemin={0}
        aria-valuemax={goalAmount}
        aria-label={`Campaign progress: ${percent}% funded`}
        className={cn('w-full overflow-hidden rounded-full bg-muted', barHeight)}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
