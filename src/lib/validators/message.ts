import { z } from 'zod';

/**
 * Strip HTML tags from text input. Messages are plain text only.
 */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export const messageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(500, 'Message must be 500 characters or fewer')
    .transform(stripHtml)
    .refine((val) => val.length >= 1, 'Message cannot be empty after sanitization'),
  isAnonymous: z.boolean().default(false),
});

export type CreateMessageInput = z.infer<typeof messageSchema>;
