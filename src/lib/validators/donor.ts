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
  phone: z.string().max(30).optional().nullable(),
  donorType: z.enum(DONOR_TYPES).optional(),
  organizationName: z.string().max(200).optional().nullable(),
  address: addressSchema.optional().nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const createInteractionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  subject: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  contactedAt: z.string().datetime(),
});

export const createRelationshipSchema = z.object({
  relatedDonorId: z.string().uuid().optional().nullable(),
  organizationName: z.string().max(200).optional().nullable(),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  notes: z.string().max(1000).optional(),
});

export type UpdateDonorProfileInput = z.infer<typeof updateDonorProfileSchema>;
export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
