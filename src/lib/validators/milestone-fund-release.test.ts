/**
 * Milestone Fund Release System — Unit Tests
 *
 * Tests the milestone-based fund release pipeline:
 *  1. Milestone threshold detection (cumulative percentage logic)
 *  2. Identity verification gate (hard constraint)
 *  3. Evidence submission validation
 *  4. Status transition rules
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

const ROOT = resolve(__dirname, '../../..');

// ─── Milestone threshold calculation (mirrors webhook logic) ────────────────

/**
 * Given phase fund percentages [30, 40, 30] and a goal amount,
 * compute the cumulative threshold for each phase.
 */
function computeCumulativeThresholds(
  phases: { phase: number; fundPercentage: number }[],
  goalAmount: number,
): Map<number, number> {
  const sorted = [...phases].sort((a, b) => a.phase - b.phase);
  const map = new Map<number, number>();
  let cumulative = 0;
  for (const p of sorted) {
    cumulative += p.fundPercentage;
    map.set(p.phase, Math.round(goalAmount * cumulative / 100));
  }
  return map;
}

/**
 * Check which milestones are newly reached given a raised amount.
 */
function getNewlyReachedMilestones(
  milestones: { phase: number; fundPercentage: number; status: string }[],
  goalAmount: number,
  raisedAmount: number,
): number[] {
  const thresholds = computeCumulativeThresholds(milestones, goalAmount);
  return milestones
    .filter((m) => m.status === 'pending')
    .filter((m) => raisedAmount >= (thresholds.get(m.phase) ?? Infinity))
    .map((m) => m.phase);
}

describe('Milestone threshold calculation', () => {
  const milestones = [
    { phase: 1, fundPercentage: 30, status: 'pending' },
    { phase: 2, fundPercentage: 40, status: 'pending' },
    { phase: 3, fundPercentage: 30, status: 'pending' },
  ];
  const goalAmount = 200_000; // $2,000.00 in cents

  it('computes correct cumulative thresholds for [30, 40, 30]', () => {
    const thresholds = computeCumulativeThresholds(milestones, goalAmount);
    expect(thresholds.get(1)).toBe(60_000);  // 30% of $2,000
    expect(thresholds.get(2)).toBe(140_000); // 70% of $2,000
    expect(thresholds.get(3)).toBe(200_000); // 100% of $2,000
  });

  it('no milestones reached at 0% funded', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 0);
    expect(reached).toEqual([]);
  });

  it('no milestones reached at 29% funded (just under Phase 1)', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 58_000);
    expect(reached).toEqual([]);
  });

  it('Phase 1 reached at exactly 30% funded', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 60_000);
    expect(reached).toEqual([1]);
  });

  it('Phase 1 reached at 50% funded (past threshold)', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 100_000);
    expect(reached).toEqual([1]);
  });

  it('Phase 1 + 2 reached at exactly 70% funded', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 140_000);
    expect(reached).toEqual([1, 2]);
  });

  it('all phases reached at 100% funded', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 200_000);
    expect(reached).toEqual([1, 2, 3]);
  });

  it('all phases reached at overfunded (120%)', () => {
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 240_000);
    expect(reached).toEqual([1, 2, 3]);
  });

  it('skips already-reached milestones', () => {
    const withReached = [
      { phase: 1, fundPercentage: 30, status: 'reached' },
      { phase: 2, fundPercentage: 40, status: 'pending' },
      { phase: 3, fundPercentage: 30, status: 'pending' },
    ];
    const reached = getNewlyReachedMilestones(withReached, goalAmount, 200_000);
    expect(reached).toEqual([2, 3]);
  });

  it('skips approved milestones', () => {
    const withApproved = [
      { phase: 1, fundPercentage: 30, status: 'approved' },
      { phase: 2, fundPercentage: 40, status: 'evidence_submitted' },
      { phase: 3, fundPercentage: 30, status: 'pending' },
    ];
    const reached = getNewlyReachedMilestones(withApproved, goalAmount, 200_000);
    expect(reached).toEqual([3]);
  });

  it('handles large single donation that crosses all thresholds', () => {
    // $2,000 donation on a $2,000 campaign — all phases reached at once
    const reached = getNewlyReachedMilestones(milestones, goalAmount, 200_000);
    expect(reached).toEqual([1, 2, 3]);
  });

  it('handles custom split [10, 30, 60]', () => {
    const custom = [
      { phase: 1, fundPercentage: 10, status: 'pending' },
      { phase: 2, fundPercentage: 30, status: 'pending' },
      { phase: 3, fundPercentage: 60, status: 'pending' },
    ];
    const thresholds = computeCumulativeThresholds(custom, 100_000);
    expect(thresholds.get(1)).toBe(10_000);  // 10%
    expect(thresholds.get(2)).toBe(40_000);  // 40%
    expect(thresholds.get(3)).toBe(100_000); // 100%
  });

  it('handles Phase 1 at max 40%', () => {
    const maxPhase1 = [
      { phase: 1, fundPercentage: 40, status: 'pending' },
      { phase: 2, fundPercentage: 30, status: 'pending' },
      { phase: 3, fundPercentage: 30, status: 'pending' },
    ];
    const thresholds = computeCumulativeThresholds(maxPhase1, 100_000);
    expect(thresholds.get(1)).toBe(40_000);
    expect(thresholds.get(2)).toBe(70_000);
    expect(thresholds.get(3)).toBe(100_000);
  });
});

// ─── Identity verification gate ─────────────────────────────────────────────

describe('Identity verification gate', () => {
  const IDENTITY_VERIFIED_STATUSES = ['identity_verified', 'fully_verified'];

  function canApproveFundRelease(verificationStatus: string): boolean {
    return IDENTITY_VERIFIED_STATUSES.includes(verificationStatus);
  }

  it('blocks fund release when unverified', () => {
    expect(canApproveFundRelease('unverified')).toBe(false);
  });

  it('blocks fund release when pending', () => {
    expect(canApproveFundRelease('pending')).toBe(false);
  });

  it('blocks fund release when verified (general, not identity-specific)', () => {
    expect(canApproveFundRelease('verified')).toBe(false);
  });

  it('blocks fund release when documents_uploaded but not reviewed', () => {
    expect(canApproveFundRelease('documents_uploaded')).toBe(false);
  });

  it('blocks fund release when submitted_for_review', () => {
    expect(canApproveFundRelease('submitted_for_review')).toBe(false);
  });

  it('blocks fund release when info_requested', () => {
    expect(canApproveFundRelease('info_requested')).toBe(false);
  });

  it('blocks fund release when rejected', () => {
    expect(canApproveFundRelease('rejected')).toBe(false);
  });

  it('blocks fund release when suspended', () => {
    expect(canApproveFundRelease('suspended')).toBe(false);
  });

  it('allows fund release when identity_verified', () => {
    expect(canApproveFundRelease('identity_verified')).toBe(true);
  });

  it('allows fund release when fully_verified', () => {
    expect(canApproveFundRelease('fully_verified')).toBe(true);
  });
});

// ─── Evidence submission validation ─────────────────────────────────────────

const submitEvidenceSchema = z.object({
  fileUrl: z.string().url().max(2048),
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  mimeType: z.string().regex(/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/, 'Only JPEG, PNG, WebP, HEIC images or PDF files are accepted'),
  description: z.string().max(2000).optional(),
});

describe('Evidence submission validation', () => {
  const validEvidence = {
    fileUrl: 'https://storage.example.com/evidence/doc.pdf',
    fileName: 'government-id.pdf',
    fileSize: 1024 * 1024, // 1MB
    mimeType: 'application/pdf',
  };

  it('accepts valid PDF evidence', () => {
    const result = submitEvidenceSchema.safeParse(validEvidence);
    expect(result.success).toBe(true);
  });

  it('accepts valid JPEG image', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'image/jpeg', fileName: 'id.jpg' });
    expect(result.success).toBe(true);
  });

  it('accepts valid PNG image', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'image/png', fileName: 'id.png' });
    expect(result.success).toBe(true);
  });

  it('accepts valid WebP image', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'image/webp', fileName: 'id.webp' });
    expect(result.success).toBe(true);
  });

  it('accepts valid HEIC image', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'image/heic', fileName: 'id.heic' });
    expect(result.success).toBe(true);
  });

  it('accepts with optional description', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, description: 'Front side of passport' });
    expect(result.success).toBe(true);
  });

  it('rejects unsupported mime type (image/gif)', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'image/gif' });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported mime type (application/zip)', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'application/zip' });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported mime type (text/html)', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, mimeType: 'text/html' });
    expect(result.success).toBe(false);
  });

  it('rejects file size exceeding 50MB', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, fileSize: 51 * 1024 * 1024 });
    expect(result.success).toBe(false);
  });

  it('rejects zero file size', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, fileSize: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative file size', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, fileSize: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, fileUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects empty fileName', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, fileName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fileUrl', () => {
    const { fileUrl: _fileUrl, ...rest } = validEvidence;
    const result = submitEvidenceSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects description exceeding 2000 chars', () => {
    const result = submitEvidenceSchema.safeParse({ ...validEvidence, description: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

// ─── Milestone status transitions ───────────────────────────────────────────

describe('Milestone status transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['reached'],
    reached: ['evidence_submitted'],
    evidence_submitted: ['approved', 'rejected'],
    rejected: ['evidence_submitted'], // creator can resubmit
    approved: [], // terminal state
    overdue: [], // terminal state
  };

  function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('pending → reached (threshold crossed)', () => {
    expect(canTransition('pending', 'reached')).toBe(true);
  });

  it('reached → evidence_submitted (creator submits)', () => {
    expect(canTransition('reached', 'evidence_submitted')).toBe(true);
  });

  it('evidence_submitted → approved (admin approves)', () => {
    expect(canTransition('evidence_submitted', 'approved')).toBe(true);
  });

  it('evidence_submitted → rejected (admin rejects)', () => {
    expect(canTransition('evidence_submitted', 'rejected')).toBe(true);
  });

  it('rejected → evidence_submitted (creator resubmits)', () => {
    expect(canTransition('rejected', 'evidence_submitted')).toBe(true);
  });

  it('pending cannot go directly to evidence_submitted', () => {
    expect(canTransition('pending', 'evidence_submitted')).toBe(false);
  });

  it('pending cannot go directly to approved', () => {
    expect(canTransition('pending', 'approved')).toBe(false);
  });

  it('reached cannot go directly to approved (must submit evidence first)', () => {
    expect(canTransition('reached', 'approved')).toBe(false);
  });

  it('approved is terminal — cannot transition', () => {
    expect(canTransition('approved', 'pending')).toBe(false);
    expect(canTransition('approved', 'reached')).toBe(false);
    expect(canTransition('approved', 'evidence_submitted')).toBe(false);
  });

  it('overdue is terminal', () => {
    expect(canTransition('overdue', 'reached')).toBe(false);
    expect(canTransition('overdue', 'evidence_submitted')).toBe(false);
  });
});

// ─── Admin review action validation ─────────────────────────────────────────

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(5000).optional(),
});

describe('Admin review schema', () => {
  it('accepts approve action', () => {
    expect(reviewSchema.safeParse({ action: 'approve' }).success).toBe(true);
  });

  it('accepts reject action', () => {
    expect(reviewSchema.safeParse({ action: 'reject' }).success).toBe(true);
  });

  it('accepts with notes', () => {
    expect(reviewSchema.safeParse({ action: 'approve', notes: 'All checks passed.' }).success).toBe(true);
  });

  it('rejects invalid action', () => {
    expect(reviewSchema.safeParse({ action: 'release' }).success).toBe(false);
  });

  it('rejects missing action', () => {
    expect(reviewSchema.safeParse({}).success).toBe(false);
  });

  it('rejects notes exceeding 5000 chars', () => {
    expect(reviewSchema.safeParse({ action: 'reject', notes: 'x'.repeat(5001) }).success).toBe(false);
  });
});

// ─── Static analysis: milestone schema + enum integrity ─────────────────────

describe('Milestone schema enum integrity', () => {
  const schemaSource = readFileSync(resolve(ROOT, 'src/db/schema.ts'), 'utf-8');

  it('milestone_status enum includes "reached" value', () => {
    const match = schemaSource.match(/milestoneStatusEnum\s*=\s*pgEnum\([^)]+\)/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain("'reached'");
  });

  it('"reached" appears between "pending" and "evidence_submitted"', () => {
    const match = schemaSource.match(/milestoneStatusEnum\s*=\s*pgEnum\(\s*'milestone_status'\s*,\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const values = match![1].match(/'([^']+)'/g)!.map((v) => v.replace(/'/g, ''));
    const pendingIdx = values.indexOf('pending');
    const reachedIdx = values.indexOf('reached');
    const evidenceIdx = values.indexOf('evidence_submitted');
    expect(reachedIdx).toBeGreaterThan(pendingIdx);
    expect(reachedIdx).toBeLessThan(evidenceIdx);
  });

  it('fund_release_status enum has required values', () => {
    const match = schemaSource.match(/fundReleaseStatusEnum\s*=\s*pgEnum\([^)]+\)/);
    expect(match).not.toBeNull();
    for (const val of ['held', 'approved', 'processing', 'released', 'refunded']) {
      expect(match![0]).toContain(`'${val}'`);
    }
  });

  it('notification_type enum includes milestone types', () => {
    for (const type of ['milestone_approved', 'milestone_rejected', 'fund_released', 'campaign_milestone']) {
      expect(schemaSource).toContain(`'${type}'`);
    }
  });

  it('verification_status enum includes identity_verified and fully_verified', () => {
    expect(schemaSource).toContain("'identity_verified'");
    expect(schemaSource).toContain("'fully_verified'");
  });
});

// ─── Static analysis: webhook milestone detection code ──────────────────────

describe('Webhook milestone detection', () => {
  const webhookSource = readFileSync(
    resolve(ROOT, 'src/app/api/v1/donations/webhook/route.ts'),
    'utf-8',
  );

  it('imports campaignMilestones from schema', () => {
    expect(webhookSource).toContain('campaignMilestones');
  });

  it('checks milestoneFundRelease flag before milestone detection', () => {
    expect(webhookSource).toContain('campaign.milestoneFundRelease');
  });

  it('queries only pending milestones for threshold checking', () => {
    expect(webhookSource).toMatch(/eq\(campaignMilestones\.status,\s*'pending'\)/);
  });

  it('computes cumulative percentage for threshold', () => {
    expect(webhookSource).toContain('cumulative += m.fundPercentage');
  });

  it('updates milestone status to "reached" (not "approved")', () => {
    expect(webhookSource).toMatch(/set\(\{\s*status:\s*'reached'/);
  });

  it('does NOT auto-release funds (no stripe.transfers.create)', () => {
    expect(webhookSource).not.toContain('stripe.transfers.create');
  });

  it('does NOT set milestone status to "approved" in webhook', () => {
    expect(webhookSource).not.toMatch(/set\(\{\s*status:\s*'approved'/);
  });

  it('calls notifyCreatorMilestoneReached', () => {
    expect(webhookSource).toContain('notifyCreatorMilestoneReached');
  });

  it('calls notifyAdminMilestoneReached', () => {
    expect(webhookSource).toContain('notifyAdminMilestoneReached');
  });

  it('logs milestone.reached audit event', () => {
    expect(webhookSource).toContain("'milestone.reached'");
  });
});

// ─── Static analysis: evidence submission route ─────────────────────────────

describe('Evidence submission API', () => {
  const evidenceSource = readFileSync(
    resolve(ROOT, 'src/app/api/v1/campaigns/[slug]/milestones/[milestoneId]/evidence/route.ts'),
    'utf-8',
  );

  it('exists and exports POST handler', () => {
    expect(evidenceSource).toContain('export async function POST');
  });

  it('requires authentication', () => {
    expect(evidenceSource).toContain('await auth()');
  });

  it('verifies campaign creator owns the milestone', () => {
    expect(evidenceSource).toContain('campaign.creatorId !== session.user.id');
  });

  it('only allows evidence for reached or rejected milestones', () => {
    expect(evidenceSource).toContain("milestone.status !== 'reached'");
    expect(evidenceSource).toContain("milestone.status !== 'rejected'");
  });

  it('validates UUID parameters', () => {
    expect(evidenceSource).toContain('uuidRegex');
  });

  it('enforces max evidence attempts', () => {
    expect(evidenceSource).toContain('MAX_EVIDENCE_ATTEMPTS');
  });

  it('transitions milestone to evidence_submitted', () => {
    expect(evidenceSource).toContain("status: 'evidence_submitted'");
  });

  it('notifies admins when evidence is submitted', () => {
    expect(evidenceSource).toContain('notifyAdminEvidenceSubmitted');
  });

  it('uses transaction for evidence insert + status update', () => {
    expect(evidenceSource).toContain('db.transaction');
  });
});

// ─── Static analysis: admin review route ────────────────────────────────────

describe('Admin milestone review API', () => {
  const reviewSource = readFileSync(
    resolve(ROOT, 'src/app/api/v1/admin/fund-release-queue/[milestoneId]/review/route.ts'),
    'utf-8',
  );

  it('exists and exports POST handler', () => {
    expect(reviewSource).toContain('export async function POST');
  });

  it('requires admin role', () => {
    expect(reviewSource).toContain("requireRole(['admin'])");
  });

  it('enforces identity verification before approval', () => {
    expect(reviewSource).toContain('IDENTITY_VERIFIED_STATUSES');
    expect(reviewSource).toContain('identity_verified');
    expect(reviewSource).toContain('fully_verified');
  });

  it('returns 403 when identity is not verified', () => {
    expect(reviewSource).toContain('Cannot approve fund release: campaign creator identity is not verified');
  });

  it('only reviews milestones in evidence_submitted status', () => {
    expect(reviewSource).toContain("milestone.status !== 'evidence_submitted'");
  });

  it('creates fund release record on approval', () => {
    expect(reviewSource).toContain('fundReleases');
    expect(reviewSource).toContain("status: 'approved'");
  });

  it('updates totalReleasedAmount atomically', () => {
    expect(reviewSource).toContain('campaigns.totalReleasedAmount');
  });

  it('notifies donors via notifyMilestoneAchieved on approval', () => {
    expect(reviewSource).toContain('notifyMilestoneAchieved');
  });

  it('notifies creator via notifyFundReleased on approval', () => {
    expect(reviewSource).toContain('notifyFundReleased');
  });

  it('rejects milestone and transitions to rejected status', () => {
    expect(reviewSource).toContain("status: 'rejected'");
  });

  it('notifies creator of rejection', () => {
    expect(reviewSource).toContain("type: 'milestone_rejected'");
  });

  it('logs audit events for both approve and reject', () => {
    expect(reviewSource).toContain("'milestone.approved'");
    expect(reviewSource).toContain("'milestone.rejected'");
  });

  it('uses transactions for data integrity', () => {
    expect(reviewSource).toContain('db.transaction');
  });
});

// ─── Static analysis: email templates ───────────────────────────────────────

describe('Milestone email templates', () => {
  const templateSource = readFileSync(resolve(ROOT, 'src/lib/email-templates.ts'), 'utf-8');

  it('milestoneReachedCreatorEmail exists', () => {
    expect(templateSource).toContain('function milestoneReachedCreatorEmail');
  });

  it('milestoneReachedAdminEmail exists', () => {
    expect(templateSource).toContain('function milestoneReachedAdminEmail');
  });

  it('evidenceSubmittedAdminEmail exists', () => {
    expect(templateSource).toContain('function evidenceSubmittedAdminEmail');
  });

  it('creator email celebrates milestone achievement', () => {
    expect(templateSource).toContain('milestoneReachedCreatorEmail');
    expect(templateSource).toContain('Phase');
    expect(templateSource).toContain('Funded');
  });

  it('creator email links to campaign page for sharing', () => {
    expect(templateSource).toContain('campaignSlug');
  });

  it('admin email includes fund amount', () => {
    expect(templateSource).toContain('formatCents(p.fundAmount)');
  });
});

// ─── Static analysis: notification functions ────────────────────────────────

describe('Milestone notification functions', () => {
  const notifSource = readFileSync(resolve(ROOT, 'src/lib/notifications.ts'), 'utf-8');

  it('notifyCreatorMilestoneReached is exported', () => {
    expect(notifSource).toContain('export async function notifyCreatorMilestoneReached');
  });

  it('notifyAdminMilestoneReached is exported', () => {
    expect(notifSource).toContain('export async function notifyAdminMilestoneReached');
  });

  it('notifyAdminEvidenceSubmitted is exported', () => {
    expect(notifSource).toContain('export async function notifyAdminEvidenceSubmitted');
  });

  it('creator notification uses campaign_milestone type', () => {
    // Find the notifyCreatorMilestoneReached function and check its type
    const creatorFn = notifSource.match(/notifyCreatorMilestoneReached[\s\S]*?type:\s*'([^']+)'/);
    expect(creatorFn).not.toBeNull();
    expect(creatorFn![1]).toBe('campaign_milestone');
  });

  it('creator notification directs to campaign page', () => {
    const creatorFn = notifSource.match(/notifyCreatorMilestoneReached[\s\S]*?link:\s*`([^`]+)`/);
    expect(creatorFn).not.toBeNull();
    expect(creatorFn![1]).toContain('/campaigns/');
  });

  it('imports milestone email templates', () => {
    expect(notifSource).toContain('milestoneReachedCreatorEmail');
    expect(notifSource).toContain('milestoneReachedAdminEmail');
    expect(notifSource).toContain('evidenceSubmittedAdminEmail');
  });
});

// ─── Migration file ─────────────────────────────────────────────────────────

describe('Migration 0020', () => {
  const migrationSource = readFileSync(
    resolve(ROOT, 'src/db/migrations/0020_milestone_reached_status.sql'),
    'utf-8',
  );

  it('adds reached value to milestone_status enum', () => {
    expect(migrationSource).toContain("ADD VALUE IF NOT EXISTS 'reached'");
  });

  it('places reached after pending', () => {
    expect(migrationSource).toContain("AFTER 'pending'");
  });
});

// ─── Fund release status flow ───────────────────────────────────────────────

describe('Fund release status flow', () => {
  it('new fund release starts in approved status (not held)', () => {
    // After admin approves, the fund release is created with 'approved' status
    // It will transition to 'processing' → 'released' when Stripe Connect transfer executes
    const reviewSource = readFileSync(
      resolve(ROOT, 'src/app/api/v1/admin/fund-release-queue/[milestoneId]/review/route.ts'),
      'utf-8',
    );
    // The insert sets status: 'approved' directly since admin just approved it
    const insertMatch = reviewSource.match(/insert\(fundReleases\)\.values\(\{[\s\S]*?status:\s*'(\w+)'/);
    expect(insertMatch).not.toBeNull();
    expect(insertMatch![1]).toBe('approved');
  });
});
