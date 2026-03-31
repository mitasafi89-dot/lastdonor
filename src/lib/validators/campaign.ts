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
  title: z.string().min(5).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .min(3)
    .max(100),
  category: z.enum(CATEGORIES),
  heroImageUrl: z.string().url(),
  photoCredit: z.string().max(200).optional(),
  subjectName: z.string().min(1).max(200),
  subjectHometown: z.string().max(200).optional(),
  storyHtml: z.string().min(50),
  goalAmount: z.number().int().min(100_000).max(10_000_000),
  impactTiers: z
    .array(
      z.object({
        amount: z.number().int().min(500),
        label: z.string().min(3).max(200),
      }),
    )
    .max(10)
    .default([]),
  status: z.enum(['draft', 'active']).default('draft'),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
