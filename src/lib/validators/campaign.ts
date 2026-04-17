import { z } from 'zod';

const CATEGORIES = [
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

export const createCampaignSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200, 'Title must be under 200 characters'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug must be under 100 characters'),
  category: z.enum(CATEGORIES),
  heroImageUrl: z.string().url('Enter a valid image URL'),
  photoCredit: z.string().trim().max(200, 'Photo credit must be under 200 characters').optional(),
  subjectName: z.string().trim().min(1, 'Subject name is required').max(200, 'Subject name must be under 200 characters'),
  subjectHometown: z.string().trim().max(200, 'Hometown must be under 200 characters').optional(),
  storyHtml: z.string().min(50, 'Story must be at least 50 characters'),
  goalAmount: z.number().int('Goal must be a whole number').min(100_000, 'Minimum goal is $1,000').max(10_000_000, 'Maximum goal is $100,000'),
  impactTiers: z
    .array(
      z.object({
        amount: z.number().int().min(500, 'Tier amount must be at least $5'),
        label: z.string().trim().min(3, 'Tier label must be at least 3 characters').max(200, 'Tier label must be under 200 characters'),
      }),
    )
    .max(10, 'Maximum 10 impact tiers')
    .default([]),
  status: z.enum(['draft', 'active']).default('draft'),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
