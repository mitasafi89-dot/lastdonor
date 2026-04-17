import { z } from 'zod';

const DONOR_TYPES = ['individual', 'corporate', 'foundation'] as const;
const INTERACTION_TYPES = ['email', 'call', 'meeting', 'note'] as const;
const RELATIONSHIP_TYPES = [
  'referral',
  'corporate_sponsor',
  'family',
  'colleague',
  'organization_member',
] as const;

export const PREDEFINED_TAGS = [
  'vip',
  'major-donor',
  'recurring',
  'first-time',
  'inactive',
  'board-member',
  'volunteer',
  'matching-gift',
  'planned-giving',
  'event-attendee',
] as const;

export const addressSchema = z.object({
  street: z.string().max(200).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(100).optional().default(''),
  zip: z.string().max(20).optional().default(''),
  country: z.string().max(100).optional().default(''),
});

export const updateDonorProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(30, 'Phone must be under 30 characters')
    .refine(
      (val) => val === '' || /^\+?[0-9\s\-().]{7,}$/.test(val),
      'Enter a valid phone number',
    )
    .optional()
    .nullable(),
  donorType: z.enum(DONOR_TYPES).optional(),
  organizationName: z.string().trim().max(200, 'Organization name must be under 200 characters').optional().nullable(),
  address: addressSchema.optional().nullable(),
  tags: z.array(z.string().trim().min(1, 'Tag cannot be empty').max(50, 'Tag must be under 50 characters')).max(20, 'Maximum 20 tags').optional(),
});

export const createInteractionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be under 200 characters'),
  body: z.string().trim().max(5000, 'Body must be under 5,000 characters').optional(),
  contactedAt: z.string().datetime('Must be a valid ISO 8601 date'),
});

export const createRelationshipSchema = z.object({
  relatedDonorId: z.string().uuid('Must be a valid UUID').optional().nullable(),
  organizationName: z.string().trim().max(200, 'Organization name must be under 200 characters').optional().nullable(),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  notes: z.string().trim().max(1000, 'Notes must be under 1,000 characters').optional(),
});

export type UpdateDonorProfileInput = z.infer<typeof updateDonorProfileSchema>;
export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
