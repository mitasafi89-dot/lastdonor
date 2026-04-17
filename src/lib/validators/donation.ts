import { z } from 'zod';

/**
 * Strip HTML tags from text input.
 */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export const createIntentSchema = z.object({
  campaignId: z.string().uuid('Campaign ID must be a valid UUID'),
  amount: z
    .number()
    .int('Amount must be a whole number (cents)')
    .min(500, 'Minimum donation is $5.00')
    .max(10_000_000, 'Maximum donation is $100,000'),
  donorName: z.string().trim().max(100, 'Name must be under 100 characters').optional(),
  donorEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
  donorLocation: z.string().trim().max(100, 'Location must be under 100 characters').optional(),
  message: z
    .string()
    .max(500, 'Message must be 500 characters or fewer')
    .transform(stripHtml)
    .pipe(z.string().max(500, 'Message must be 500 characters or fewer'))
    .optional(),
  isAnonymous: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  subscribedToUpdates: z.boolean().default(false),
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID').optional(),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
