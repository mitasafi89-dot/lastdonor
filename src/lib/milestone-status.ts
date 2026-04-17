/**
 * Milestone status computation logic
 *
 * Centralized functions used by both the admin verification dashboard and
 * fund release dashboard to ensure consistent status display and eligibility
 * calculations across the system.
 *
 * Sequential enforcement model (non-negotiable):
 *   M1 release -> requires identity verification only (Stripe Identity)
 *   M2 release → requires M1 released + M1 evidence approved
 *   M3 release → requires M2 released + M2 evidence approved
 *   Post-M3   → optional, not gating
 */

// ─── Display Status (7 states rendered in UI) ────────────────────────────────

export type MilestoneDisplayStatus =
  | 'not_started'
  | 'eligible'
  | 'awaiting_documents'
  | 'under_review'
  | 'approved'
  | 'released'
  | 'on_hold'
  | 'flagged'
  | 'rejected';

export type RiskFlag = {
  type: 'rejected_milestone' | 'flagged_release' | 'paused_release' | 'verification_issue' | 'overdue';
  milestonePhase?: number;
  message: string;
};

export interface MilestoneData {
  id: string;
  phase: number;
  title: string;
  status: string; // DB enum: pending | reached | evidence_submitted | approved | rejected | overdue
  fundPercentage: number | null;
  fundAmount: number | null;
  releasedAmount: number | null;
  releasedAt: string | null;
}

export interface FundReleaseData {
  id: string;
  milestoneId: string;
  amount: number;
  status: string; // DB enum: held | approved | paused | processing | released | refunded
  approvedBy: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  notes: string | null;
  flaggedForAudit: boolean;
  flagReason: string | null;
  pauseReason: string | null;
}

export interface CampaignVerificationData {
  verificationStatus: string; // unverified | pending | identity_verified | fully_verified | ...
}

// ─── Display Status Computation ──────────────────────────────────────────────

/**
 * Computes the display status for a milestone based on its DB state,
 * associated fund release (if any), and predecessor milestone.
 */
export function computeMilestoneDisplayStatus(
  milestone: MilestoneData,
  campaign: CampaignVerificationData,
  fundRelease: FundReleaseData | null,
  prevMilestone: MilestoneData | null,
): MilestoneDisplayStatus {
  // Fund release exists - check its state first
  if (fundRelease) {
    if (fundRelease.flaggedForAudit) return 'flagged';
    if (fundRelease.status === 'paused') return 'on_hold';
    if (fundRelease.status === 'released' || fundRelease.status === 'processing') return 'released';
    if (fundRelease.status === 'approved') return 'approved';
  }

  // Milestone DB status
  if (milestone.status === 'rejected') return 'rejected';
  if (milestone.status === 'approved' && !fundRelease) return 'approved';
  if (milestone.status === 'evidence_submitted') return 'under_review';

  // Phase 1: eligible if identity verified and milestone reached
  if (milestone.phase === 1 && milestone.status === 'reached') {
    const identityVerified = isIdentityVerified(campaign);
    return identityVerified ? 'eligible' : 'awaiting_documents';
  }

  // Phase 2/3: check predecessor
  if (milestone.status === 'reached' && milestone.phase > 1) {
    if (prevMilestone && prevMilestone.status === 'approved') {
      return 'eligible';
    }
    return 'awaiting_documents';
  }

  if (milestone.status === 'pending') return 'not_started';
  if (milestone.status === 'overdue') return 'not_started';

  return 'not_started';
}

// ─── Eligibility Computation ─────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  missing: string[];
}

/**
 * Determines whether a milestone is eligible for fund release.
 * Returns a boolean and a list of unmet prerequisites (for tooltip display).
 */
export function isEligibleForRelease(
  phase: number,
  milestone: MilestoneData,
  campaign: CampaignVerificationData,
  prevMilestone: MilestoneData | null,
  existingRelease: FundReleaseData | null,
): EligibilityResult {
  const missing: string[] = [];

  // Already released or has an active release record
  if (existingRelease && ['approved', 'processing', 'released'].includes(existingRelease.status)) {
    return { eligible: false, missing: ['Funds already released or approved for this milestone'] };
  }

  // Milestone must be in a reviewable state
  if (phase === 1) {
    // M1: reached is sufficient (no evidence required)
    if (!['reached', 'evidence_submitted'].includes(milestone.status)) {
      missing.push('Milestone 1 has not been reached yet');
    }
  } else {
    // M2/M3: evidence must be submitted
    if (milestone.status !== 'evidence_submitted') {
      // Allow reached + evidence if previous is approved (for display purposes)
      if (milestone.status !== 'reached') {
        missing.push(`Phase ${phase} milestone not ready for review`);
      }
    }
  }

  // Identity verification (required for all milestones)
  if (!isIdentityVerified(campaign)) {
    missing.push('Campaign creator identity has not been verified');
  }

  // Sequential: previous milestone must be approved and released
  if (phase > 1 && prevMilestone) {
    if (prevMilestone.status !== 'approved') {
      missing.push(`Phase ${phase - 1} has not been approved`);
    }
    if (!prevMilestone.releasedAt && prevMilestone.releasedAmount === null) {
      missing.push(`Phase ${phase - 1} funds have not been released`);
    }
  } else if (phase > 1 && !prevMilestone) {
    missing.push(`Phase ${phase - 1} milestone data not found`);
  }

  return { eligible: missing.length === 0, missing };
}

// ─── Prerequisite Summary ────────────────────────────────────────────────────

export interface PrerequisiteStatus {
  met: boolean;
  items: Array<{ label: string; met: boolean }>;
}

/**
 * Returns a structured prerequisite checklist for use in confirmation modals.
 */
export function getPrerequisiteStatus(
  phase: number,
  milestone: MilestoneData,
  campaign: CampaignVerificationData,
  prevMilestone: MilestoneData | null,
): PrerequisiteStatus {
  const items: Array<{ label: string; met: boolean }> = [];

  // Identity verification (all phases)
  items.push({
    label: 'Identity verification completed',
    met: isIdentityVerified(campaign),
  });

  if (phase === 1) {
    items.push({
      label: 'Milestone 1 reached',
      met: ['reached', 'evidence_submitted', 'approved'].includes(milestone.status),
    });
  }

  if (phase >= 2) {
    items.push({
      label: `Phase ${phase - 1} approved`,
      met: prevMilestone?.status === 'approved',
    });
    items.push({
      label: `Phase ${phase - 1} funds released`,
      met: !!(prevMilestone?.releasedAt || (prevMilestone?.releasedAmount && prevMilestone.releasedAmount > 0)),
    });
    items.push({
      label: `Phase ${phase} evidence submitted`,
      met: ['evidence_submitted'].includes(milestone.status),
    });
  }

  return {
    met: items.every((i) => i.met),
    items,
  };
}

// ─── Risk Flag Computation ───────────────────────────────────────────────────

/**
 * Computes risk flags for a campaign based on its milestones and fund releases.
 * Used for warning indicators in collapsed table rows.
 */
export function computeRiskFlags(
  campaign: CampaignVerificationData,
  milestones: MilestoneData[],
  fundReleases: FundReleaseData[],
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Verification issues
  if (['rejected', 'suspended'].includes(campaign.verificationStatus)) {
    flags.push({
      type: 'verification_issue',
      message: `Campaign verification status: ${campaign.verificationStatus}`,
    });
  }

  for (const milestone of milestones) {
    // Rejected milestones
    if (milestone.status === 'rejected') {
      flags.push({
        type: 'rejected_milestone',
        milestonePhase: milestone.phase,
        message: `Phase ${milestone.phase} evidence was rejected`,
      });
    }

    // Overdue milestones
    if (milestone.status === 'overdue') {
      flags.push({
        type: 'overdue',
        milestonePhase: milestone.phase,
        message: `Phase ${milestone.phase} is overdue`,
      });
    }

    // Check fund release flags
    const release = fundReleases.find((r) => r.milestoneId === milestone.id);
    if (release) {
      if (release.flaggedForAudit) {
        flags.push({
          type: 'flagged_release',
          milestonePhase: milestone.phase,
          message: release.flagReason || `Phase ${milestone.phase} release flagged for audit`,
        });
      }
      if (release.status === 'paused') {
        flags.push({
          type: 'paused_release',
          milestonePhase: milestone.phase,
          message: release.pauseReason || `Phase ${milestone.phase} release paused`,
        });
      }
    }
  }

  return flags;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IDENTITY_VERIFIED_STATUSES = ['identity_verified', 'fully_verified'];

function isIdentityVerified(campaign: CampaignVerificationData): boolean {
  return IDENTITY_VERIFIED_STATUSES.includes(campaign.verificationStatus);
}

// ─── Status Label & Color Maps ───────────────────────────────────────────────

export const MILESTONE_DISPLAY_LABELS: Record<MilestoneDisplayStatus, string> = {
  not_started: 'Not Started',
  eligible: 'Eligible for Release',
  awaiting_documents: 'Awaiting Documents',
  under_review: 'Under Review',
  approved: 'Approved',
  released: 'Released',
  on_hold: 'On Hold',
  flagged: 'Flagged for Audit',
  rejected: 'Rejected',
};

/**
 * Tailwind color classes for milestone display status badges.
 * Uses brand colors: teal for positive, amber for warning, red for critical.
 */
export const MILESTONE_DISPLAY_COLORS: Record<MilestoneDisplayStatus, { bg: string; text: string; dot: string }> = {
  not_started: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  eligible: { bg: 'bg-teal-50 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500 animate-pulse' },
  awaiting_documents: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  under_review: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  approved: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  released: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', dot: 'bg-green-600' },
  on_hold: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  flagged: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', dot: 'bg-red-600' },
};

/**
 * Aggregates milestone display statuses to determine the highest-priority
 * status to show in the collapsed campaign row.
 * Priority: flagged > on_hold > rejected > under_review > eligible > awaiting_documents > approved > released > not_started
 */
export function getHighestPriorityStatus(statuses: MilestoneDisplayStatus[]): MilestoneDisplayStatus {
  const priority: MilestoneDisplayStatus[] = [
    'flagged',
    'on_hold',
    'rejected',
    'under_review',
    'eligible',
    'awaiting_documents',
    'approved',
    'released',
    'not_started',
  ];

  for (const status of priority) {
    if (statuses.includes(status)) return status;
  }
  return 'not_started';
}
