import { cn } from '@/lib/utils';
import { getPhaseLabel, getPhasePercentRange } from '@/lib/utils/phase';
import type { DonationPhase } from '@/types';

const PHASE_STYLES: Record<DonationPhase, string> = {
  first_believers: 'bg-primary/10 text-primary border-primary/20',
  the_push: 'bg-primary/10 text-primary border-primary/20',
  closing_in: 'bg-accent/10 text-accent border-accent/20',
  last_donor_zone: 'bg-destructive/10 text-destructive border-destructive/20',
};

interface PhaseBadgeProps {
  phase: DonationPhase;
  className?: string;
}

export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  const label = getPhaseLabel(phase);
  const range = getPhasePercentRange(phase);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        PHASE_STYLES[phase],
        className,
      )}
      aria-label={`Campaign phase: ${label} - ${range.min} to ${range.max}% funded`}
    >
      {label}
    </span>
  );
}
