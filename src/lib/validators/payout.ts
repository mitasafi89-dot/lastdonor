import { z } from 'zod';

/**
 * Validates the request to create a Stripe Connect Express account.
 * Country is optional; defaults to Stripe's inference from IP/locale.
 */
export const createConnectAccountSchema = z.object({
  country: z
    .string()
    .length(2, 'Country must be a 2-letter ISO code')
    .toUpperCase()
    .optional(),
});

/**
 * Validates a withdrawal request from a campaign creator.
 * Amount is in cents (smallest currency unit).
 */
export const withdrawalRequestSchema = z.object({
  amount: z
    .number()
    .int('Amount must be a whole number (cents)')
    .positive('Amount must be greater than zero'),
});
