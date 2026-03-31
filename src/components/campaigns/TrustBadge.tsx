/**
 * Trust badges for campaigns — shows verification status, milestone progress,
 * and fund release indicators.
 *
 * Designed per spec Section 5.4 and Phase 3 trust badge integration:
 * - 🔵 "ID Verified" — identity_verified
 * - 🟢 "Fully Verified" — fully_verified
 * - Milestone progress — "M1 ✓ M2 ✓ M3 ⏳"
 * - Fund release — "30% Released"
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Verification Badge ──────────────────────────────────────────────────────

type VerificationBadgeProps = {
  status: string;
  className?: string;
  compact?: boolean;
};

const VERIFICATION_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  fully_verified: {
    label: 'Fully Verified',
    icon: '✅',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
  },
  identity_verified: {
    label: 'ID Verified',
    icon: '🔵',
    className: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800',
  },
  verified: {
    label: 'Verified',
    icon: '✅',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
  },
};

export function VerificationBadge({ status, className, compact }: VerificationBadgeProps) {
  const config = VERIFICATION_CONFIG[status];
  if (!config) return null;

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.icon} {compact ? '' : config.label}
    </Badge>
  );
}

// ─── Milestone Progress Badge ────────────────────────────────────────────────

type MilestoneProgressProps = {
  milestones: Array<{
    phase: number;
    status: string;
  }>;
  className?: string;
};

export function MilestoneProgress({ milestones, className }: MilestoneProgressProps) {
  if (!milestones || milestones.length === 0) return null;

  const sorted = [...milestones].sort((a, b) => a.phase - b.phase);
  const approvedCount = sorted.filter((m) => m.status === 'approved').length;

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      {sorted.map((m) => {
        const isApproved = m.status === 'approved';
        const isPending = m.status === 'pending';
        const isSubmitted = m.status === 'evidence_submitted';

        return (
          <span
            key={m.phase}
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
              isApproved && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
              isSubmitted && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
              isPending && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
              !isApproved && !isPending && !isSubmitted && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
            )}
            title={`Phase ${m.phase}: ${m.status}`}
          >
            {isApproved ? '✓' : m.phase}
          </span>
        );
      })}
      <span className="text-muted-foreground">
        {approvedCount}/{sorted.length}
      </span>
    </div>
  );
}

// ─── Fund Release Indicator ──────────────────────────────────────────────────

type FundReleaseIndicatorProps = {
  totalReleased: number;
  raisedAmount: number;
  className?: string;
};

export function FundReleaseIndicator({ totalReleased, raisedAmount, className }: FundReleaseIndicatorProps) {
  if (totalReleased <= 0 || raisedAmount <= 0) return null;

  const percent = Math.min(Math.round((totalReleased / raisedAmount) * 100), 100);

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800',
        className,
      )}
    >
      💰 {percent}% Released
    </Badge>
  );
}

// ─── Combined Trust Badge Row ────────────────────────────────────────────────

type TrustBadgeRowProps = {
  verificationStatus: string;
  milestones?: Array<{ phase: number; status: string }>;
  totalReleased?: number;
  raisedAmount?: number;
  className?: string;
  compact?: boolean;
};

export function TrustBadgeRow({
  verificationStatus,
  milestones,
  totalReleased,
  raisedAmount,
  className,
  compact,
}: TrustBadgeRowProps) {
  const hasVerification = ['verified', 'identity_verified', 'fully_verified'].includes(verificationStatus);
  const hasMilestones = milestones && milestones.length > 0;
  const hasFundRelease = totalReleased && totalReleased > 0 && raisedAmount && raisedAmount > 0;

  if (!hasVerification && !hasMilestones && !hasFundRelease) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {hasVerification && (
        <VerificationBadge status={verificationStatus} compact={compact} />
      )}
      {hasMilestones && (
        <MilestoneProgress milestones={milestones} />
      )}
      {hasFundRelease && (
        <FundReleaseIndicator
          totalReleased={totalReleased}
          raisedAmount={raisedAmount}
        />
      )}
    </div>
  );
}
