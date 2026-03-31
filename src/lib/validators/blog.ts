import { z } from 'zod';

const BLOG_CATEGORIES = ['campaign_story', 'impact_report', 'news'] as const;

export const createBlogPostSchema = z.object({
  title: z.string().min(5).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .min(3)
    .max(100),
  bodyHtml: z.string().min(50),
  excerpt: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  authorName: z.string().min(1).max(200),
  authorBio: z.string().max(500).optional(),
  category: z.enum(BLOG_CATEGORIES),
  published: z.boolean(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
