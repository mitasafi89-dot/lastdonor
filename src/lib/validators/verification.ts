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
  description: z.string().trim().max(500, 'Description must be under 500 characters').optional(),
});

// ─── Submit Verification for Review ──────────────────────────────────────────

export const submitVerificationSchema = z.object({
  message: z.string().trim().max(1000, 'Message must be under 1,000 characters').optional(),
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
  notes: z.string().trim().max(2000, 'Notes must be under 2,000 characters').optional(),
  deadline: z.string().datetime('Must be a valid ISO 8601 date').optional(),
}).refine(
  (data) => data.action !== 'request_info' || data.deadline,
  { message: 'Deadline is required when requesting info', path: ['deadline'] },
);

// ─── Verification Queue Filters ──────────────────────────────────────────────

/** Allowlist of columns that can be used for sorting the verification queue. */
export const SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'verificationReviewedAt',
] as const;

export const verificationQueueQuerySchema = z.object({
  status: z.enum([
    'documents_uploaded', 'submitted_for_review', 'identity_verified',
    'fully_verified', 'info_requested', 'rejected', 'suspended',
  ]).optional(),
  category: z.string().optional(),
  sortBy: z.enum(SORT_FIELDS).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500, 'Reason must be under 500 characters'),
  notifyDonors: z.boolean().default(true),
});

export const resumeCampaignSchema = z.object({
  notes: z.string().trim().max(500, 'Notes must be under 500 characters').optional(),
});

export const suspendCampaignSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500, 'Reason must be under 500 characters'),
  internalNotes: z.string().trim().max(2000, 'Internal notes must be under 2,000 characters').optional(),
});

export const cancelCampaignSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  notes: z.string().trim().max(2000, 'Notes must be under 2,000 characters').optional(),
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
  campaignId: z.string().uuid('Campaign ID must be a valid UUID'),
  requestType: z.enum(INFO_REQUEST_TYPES),
  details: z.string().trim().min(10, 'Details must be at least 10 characters').max(2000, 'Details must be under 2,000 characters'),
  deadlineDays: z.number().int().refine(
    (v) => ([3, 7, 14, 30] as readonly number[]).includes(v),
    { message: 'Deadline must be 3, 7, 14, or 30 days' },
  ),
  pauseCampaign: z.boolean().default(false),
});

export const respondInfoRequestSchema = z.object({
  responseText: z.string().trim().min(3, 'Response must be at least 3 characters').max(2000, 'Response must be under 2,000 characters'),
});

// ─── Admin Notes ─────────────────────────────────────────────────────────────

export const adminNoteSchema = z.object({
  text: z.string().trim().min(1, 'Note cannot be empty').max(2000, 'Note must be under 2,000 characters'),
});

// ─── Phase 2: Donor Subscriptions ────────────────────────────────────────────

export const subscribeCampaignSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
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
  campaignId: z.string().uuid('Campaign ID must be a valid UUID').optional(),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200, 'Subject must be under 200 characters'),
  bodyHtml: z.string().min(10, 'Body must be at least 10 characters').max(50000, 'Body must be under 50,000 characters'),
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
