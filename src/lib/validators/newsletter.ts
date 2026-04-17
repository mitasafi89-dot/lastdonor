import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  source: z.enum(['homepage', 'campaign', 'blog', 'footer', 'newsletter']).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
