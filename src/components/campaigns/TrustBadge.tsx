/**
 * Trust badges for campaigns - shows verification status and payout indicators.
 *
 * Designed per spec Section 5.4:
 * - 🔵 "ID Verified" - identity_verified
 * - 🟢 "Fully Verified" - fully_verified
 * - Payout status - "100% Released" (lump-sum model)
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

// ─── Payout Indicator ────────────────────────────────────────────────────────

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
  totalReleased?: number;
  raisedAmount?: number;
  className?: string;
  compact?: boolean;
};

export function TrustBadgeRow({
  verificationStatus,
  totalReleased,
  raisedAmount,
  className,
  compact,
}: TrustBadgeRowProps) {
  const hasVerification = ['verified', 'identity_verified', 'fully_verified'].includes(verificationStatus);
  const hasFundRelease = totalReleased && totalReleased > 0 && raisedAmount && raisedAmount > 0;

  if (!hasVerification && !hasFundRelease) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {hasVerification && (
        <VerificationBadge status={verificationStatus} compact={compact} />
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
