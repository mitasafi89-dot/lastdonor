import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.enum(['homepage', 'campaign', 'blog', 'footer']).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
