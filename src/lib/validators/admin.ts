import { z } from 'zod';

// ── Blog Topics ──────────────────────────────────────────────────────────────

export const createBlogTopicSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  primaryKeyword: z.string().trim().min(2, 'Primary keyword is required').max(200),
  causeCategory: z.string().trim().max(100).nullish(),
  targetWordCount: z.number().int().min(500).max(10000).optional(),
});

const BLOG_TOPIC_ACTIONS = ['generate', 'reject', 'boost'] as const;

export const patchBlogTopicSchema = z.object({
  action: z.enum(BLOG_TOPIC_ACTIONS).optional(),
  reason: z.string().trim().max(500).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  primaryKeyword: z.string().trim().min(2).max(200).optional(),
  causeCategory: z.string().trim().max(100).nullish(),
  status: z.string().trim().max(50).optional(),
  priorityScore: z.number().int().min(0).max(100).optional(),
});

// ── Campaign Updates (admin) ─────────────────────────────────────────────────

export const adminCampaignUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  bodyHtml: z.string().min(1, 'Body is required'),
  imageUrl: z.string().url().nullish(),
});

// ── Verification Document Review ─────────────────────────────────────────────

export const verificationDocReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().trim().max(2000).nullish(),
}).refine(
  (data) => data.action !== 'reject' || (data.notes && data.notes.length > 0),
  { message: 'Notes are required when rejecting a document', path: ['notes'] },
);

// ── Message Moderation ───────────────────────────────────────────────────────

export const messageModerationSchema = z.object({
  action: z.enum(['flag', 'hide', 'unhide']),
});

// ── Info Requests ────────────────────────────────────────────────────────────

export const infoRequestActionSchema = z.object({
  action: z.enum(['close', 'extend_deadline', 'send_reminder']),
});

// ── Identity Verification Session ────────────────────────────────────────────

export const identitySessionSchema = z.object({
  campaignId: z.string().uuid('campaignId must be a valid UUID'),
  force: z.boolean().optional(),
});
