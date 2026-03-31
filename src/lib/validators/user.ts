import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export const userPreferencesSchema = z.object({
  emailDonationReceipts: z.boolean().optional(),
  emailCampaignUpdates: z.boolean().optional(),
  emailNewCampaigns: z.boolean().optional(),
  emailNewsletter: z.boolean().optional(),
  showProfilePublicly: z.boolean().optional(),
  showDonationsPublicly: z.boolean().optional(),
  showBadgesPublicly: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
