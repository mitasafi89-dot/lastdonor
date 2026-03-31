import { z } from 'zod';

export const CATEGORIES = [
  'medical',
  'disaster',
  'military',
  'veterans',
  'memorial',
  'first-responders',
  'community',
  'essential-needs',
  'emergency',
  'charity',
  'education',
  'animal',
  'environment',
  'business',
  'competition',
  'creative',
  'event',
  'faith',
  'family',
  'sports',
  'travel',
  'volunteer',
  'wishes',
] as const;

export const BENEFICIARY_RELATIONS = [
  'self',
  'family',
  'friend',
  'colleague',
  'community_member',
  'organization',
  'other',
] as const;

// ─── Milestone Definition (inline with campaign creation) ────────────────────

const userMilestoneSchema = z.object({
  title: z.string()
    .min(3, 'Milestone title must be at least 3 characters')
    .max(200, 'Milestone title must be under 200 characters'),
  description: z.string()
    .min(10, 'Milestone description must be at least 10 characters')
    .max(1000, 'Milestone description must be under 1,000 characters'),
  fundPercentage: z.number()
    .int('Percentage must be a whole number')
    .min(10, 'Each milestone must receive at least 10%')
    .max(60, 'Each milestone cannot exceed 60%'),
});

/**
 * Campaign creation schema — strict requirements grounded in:
 *   - GoFundMe best practices: 100-word minimum story (~600 chars)
 *   - Platform brand promise: "Every campaign has a name, a face, and a number"
 *   - Content strategy: structured story with situation + impact + fund usage
 *   - Security STRIDE model TM-02: approval workflow for impersonation mitigation
 *   - Business ops: "Every disbursement documented"
 */
export const createUserCampaignSchema = z.object({
  // ── Step 1: Who Needs Help ─────────────────────────────────────────────
  subjectName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be under 200 characters'),
  subjectHometown: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must be under 200 characters'),
  beneficiaryRelation: z.enum(BENEFICIARY_RELATIONS),
  category: z.enum(CATEGORIES),
  // If not fundraising for self, the named person must be aware
  beneficiaryConsent: z.boolean(),

  // ── Step 2: Tell Their Story ───────────────────────────────────────────
  // Title: GoFundMe caps at 60, but we allow 120 for expressive titles.
  // 20-char minimum prevents low-effort titles like "Help!" (5 chars).
  title: z.string()
    .min(20, 'Title must be at least 20 characters')
    .max(120, 'Title must be under 120 characters'),
  // Story: 200-char floor is low-friction for initial submission.
  // Campaigns with longer stories raise significantly more, so the UI
  // encourages more detail without blocking submission.
  story: z.string()
    .min(200, 'Story must be at least 200 characters')
    .max(10000, 'Story must be under 10,000 characters'),

  // ── Step 3: Goal & Fund Usage ──────────────────────────────────────────
  goalAmount: z.number()
    .int('Goal must be a whole number of cents')
    .min(5000, 'Minimum goal is $50')
    .max(5_000_000, 'Maximum goal is $50,000'),
  // Fund usage plan is optional at creation time. Organizers are prompted
  // to add one once their campaign starts receiving funding.
  fundUsagePlan: z.string()
    .max(3000, 'Fund usage plan must be under 3,000 characters')
    .optional(),

  // ── Step 3b: Fund Release Plan ─────────────────────────────────────────
  // ALL campaigns require 3 milestones. Percentages must sum to 100.
  milestones: z.array(userMilestoneSchema).length(3, 'Exactly 3 milestones are required'),

  // ── Step 4: Campaign Photo ─────────────────────────────────────────────
  // Brand: "Every campaign has a name, a face, and a number."
  // Required — campaigns without photos have near-zero credibility.
  heroImageUrl: z.string().url('Please enter a valid image URL'),
  photoCredit: z.string().max(200).optional(),

  // ── Step 5: Review & Submit ────────────────────────────────────────────
  agreedToTerms: z.literal(true, { errorMap: () => ({ message: 'You must agree to the Terms of Service' }) }),
  confirmedTruthful: z.literal(true, { errorMap: () => ({ message: 'You must confirm the information is truthful' }) }),
}).refine(
  (data) => data.beneficiaryRelation === 'self' || data.beneficiaryConsent === true,
  {
    message: 'You must confirm the named person is aware of this campaign',
    path: ['beneficiaryConsent'],
  },
).refine(
  (data) => data.milestones[0].fundPercentage <= 40,
  {
    message: 'Phase 1 cannot exceed 40%',
    path: ['milestones', 0, 'fundPercentage'],
  },
).refine(
  (data) => {
    const total = data.milestones.reduce((sum, m) => sum + m.fundPercentage, 0);
    return total === 100;
  },
  {
    message: 'Fund percentages must sum to 100%',
    path: ['milestones'],
  },
);

export const updateUserCampaignSchema = z.object({
  title: z.string().min(20).max(120).optional(),
  story: z.string().min(200).max(10000).optional(),
  fundUsagePlan: z.string().min(100).max(3000).optional(),
  heroImageUrl: z.string().url().optional(),
  photoCredit: z.string().max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  subjectHometown: z.string().min(2).max(200).optional(),
});

export type CreateUserCampaignInput = z.infer<typeof createUserCampaignSchema>;
export type UpdateUserCampaignInput = z.infer<typeof updateUserCampaignSchema>;
