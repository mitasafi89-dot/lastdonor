import { z } from 'zod';

export const createIntentSchema = z.object({
  campaignId: z.string().uuid(),
  amount: z
    .number()
    .int()
    .min(500, 'Minimum donation is $5.00')
    .max(10_000_000, 'Maximum donation is $100,000'),
  donorName: z.string().max(100).optional(),
  donorEmail: z.string().email(),
  donorLocation: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  subscribedToUpdates: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
