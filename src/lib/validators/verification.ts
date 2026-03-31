import { z } from 'zod';

// ─── Verification Document Upload ───────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'government_id',
  'selfie',
  'hospital_letter',
  'receipt',
  'utility_bill',
  'bank_statement',
  'official_letter',
  'other',
] as const;

export const uploadVerificationDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  description: z.string().max(500).optional(),
});

// ─── Submit Verification for Review ──────────────────────────────────────────

export const submitVerificationSchema = z.object({
  message: z.string().max(1000).optional(),
});

// ─── Admin Verification Review ───────────────────────────────────────────────

export const VERIFICATION_ACTIONS = [
  'approve_t1',      // Identity verified (Tier 1)
  'approve_t2',      // Fully verified (Tier 2)
  'reject',
  'request_info',
] as const;

export const adminVerificationReviewSchema = z.object({
  action: z.enum(VERIFICATION_ACTIONS),
  notes: z.string().max(2000).optional(),
  deadline: z.string().datetime().optional(), // ISO 8601, required when action = request_info
}).refine(
  (data) => data.action !== 'request_info' || data.deadline,
  { message: 'Deadline is required when requesting info', path: ['deadline'] },
);

// ─── Milestone Definition ────────────────────────────────────────────────────

export const EVIDENCE_TYPES = [
  'document',
  'photo',
  'receipt',
  'official_letter',
  'other',
] as const;

const milestoneItemSchema = z.object({
  phase: z.number().int().min(1).max(3),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(1000),
  evidenceType: z.enum(EVIDENCE_TYPES),
  fundPercentage: z.number().int().min(10).max(60),
  estimatedCompletion: z.string().datetime().optional(),
});

export const defineMilestonesSchema = z.object({
  milestones: z.array(milestoneItemSchema).length(3),
}).refine(
  (data) => {
    const phases = data.milestones.map((m) => m.phase).sort();
    return phases[0] === 1 && phases[1] === 2 && phases[2] === 3;
  },
  { message: 'Must define exactly phases 1, 2, and 3', path: ['milestones'] },
).refine(
  (data) => {
    const total = data.milestones.reduce((sum, m) => sum + m.fundPercentage, 0);
    return total === 100;
  },
  { message: 'Fund percentages must sum to 100', path: ['milestones'] },
);

// ─── Admin Milestone Review ──────────────────────────────────────────────────

export const MILESTONE_ACTIONS = ['approve', 'reject'] as const;

export const adminMilestoneReviewSchema = z.object({
  action: z.enum(MILESTONE_ACTIONS),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.notes && data.notes.trim().length > 0),
  { message: 'Notes are required when rejecting a milestone', path: ['notes'] },
);

// ─── Verification Queue Filters ──────────────────────────────────────────────

export const verificationQueueQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Fund Release Queue Filters ──────────────────────────────────────────────

export const fundReleaseQueueQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Phase 2: Campaign Governance ────────────────────────────────────────────

export const CANCELLATION_REASONS = [
  'identity_fraud',
  'fabricated_story',
  'document_forgery',
  'campaigner_non_responsive',
  'duplicate_campaign',
  'legal_compliance',
  'campaigner_requested',
  'terms_violation',
] as const;

export const pauseCampaignSchema = z.object({
  reason: z.string().min(3).max(500),
  notifyDonors: z.boolean().default(true),
});

export const resumeCampaignSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const suspendCampaignSchema = z.object({
  reason: z.string().min(3).max(500),
  internalNotes: z.string().max(2000).optional(),
});

export const cancelCampaignSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  notes: z.string().max(2000).optional(),
  notifyDonors: z.boolean().default(true),
  refundAll: z.boolean().default(true),
});

// ─── Phase 2: Info Requests ──────────────────────────────────────────────────

export const INFO_REQUEST_TYPES = [
  'additional_identity_documents',
  'updated_medical_reports',
  'clarification_fund_usage',
  'proof_of_relationship',
  'updated_cost_estimates',
  'progress_evidence',
  'other',
] as const;

export const INFO_REQUEST_DEADLINES = [3, 7, 14, 30] as const;

export const createInfoRequestSchema = z.object({
  campaignId: z.string().uuid(),
  requestType: z.enum(INFO_REQUEST_TYPES),
  details: z.string().min(10).max(2000),
  deadlineDays: z.number().int().refine(
    (v) => ([3, 7, 14, 30] as readonly number[]).includes(v),
    { message: 'Deadline must be 3, 7, 14, or 30 days' },
  ),
  pauseCampaign: z.boolean().default(false),
});

export const respondInfoRequestSchema = z.object({
  responseText: z.string().min(3).max(2000),
});

// ─── Fund Release Hold / Flag / Notes ────────────────────────────────────────

export const HOLD_ACTIONS = ['hold', 'resume'] as const;

export const holdFundReleaseSchema = z.object({
  action: z.enum(HOLD_ACTIONS),
  reason: z.string().min(3).max(2000).optional(),
}).refine(
  (data) => data.action !== 'hold' || (data.reason && data.reason.trim().length > 0),
  { message: 'Reason is required when placing a hold', path: ['reason'] },
);

export const FLAG_ACTIONS = ['flag', 'unflag'] as const;

export const flagFundReleaseSchema = z.object({
  action: z.enum(FLAG_ACTIONS),
  reason: z.string().min(3).max(2000).optional(),
}).refine(
  (data) => data.action !== 'flag' || (data.reason && data.reason.trim().length > 0),
  { message: 'Reason is required when flagging for audit', path: ['reason'] },
);

export const adminNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});

// ─── Phase 2: Donor Subscriptions ────────────────────────────────────────────

export const subscribeCampaignSchema = z.object({
  email: z.string().email(),
});

// ─── Phase 2: Info Requests Queue ────────────────────────────────────────────

export const infoRequestsQueueQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Phase 3: Bulk Email System ──────────────────────────────────────────────

export const BULK_EMAIL_TEMPLATES = [
  'campaign_cancelled_refund',
  'campaign_paused_update',
  'campaign_resumed_update',
  'milestone_achieved_update',
  'campaign_completed_thanks',
  'custom',
] as const;

export const RECIPIENT_FILTERS = [
  'all_donors',
  'registered_donors',
  'guest_donors',
  'subscribed_donors',
  'refunded_donors',
] as const;

export const createBulkEmailSchema = z.object({
  templateName: z.enum(BULK_EMAIL_TEMPLATES),
  campaignId: z.string().uuid().optional(),
  subject: z.string().min(3).max(200),
  bodyHtml: z.string().min(10).max(50000),
  recipientFilter: z.enum(RECIPIENT_FILTERS).default('all_donors'),
});

export const sendBulkEmailSchema = z.object({
  /** If omitted, sends to auto-selected recipients based on filter. */
  recipientEmails: z.array(z.string().email()).optional(),
});

export const bulkEmailQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Phase 3: Refund Batch Tracking ──────────────────────────────────────────

export const refundBatchQuerySchema = z.object({
  status: z.string().optional(),
  campaignId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
