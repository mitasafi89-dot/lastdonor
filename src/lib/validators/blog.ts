import { z } from 'zod';

const BLOG_CATEGORIES = ['campaign_story', 'impact_report', 'news'] as const;

export const createBlogPostSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200, 'Title must be under 200 characters'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug must be under 100 characters'),
  bodyHtml: z.string().min(50, 'Body must be at least 50 characters'),
  excerpt: z.string().trim().max(500, 'Excerpt must be under 500 characters').optional(),
  coverImageUrl: z.string().url('Enter a valid image URL').optional().or(z.literal('')),
  authorName: z.string().trim().min(1, 'Author name is required').max(200, 'Author name must be under 200 characters'),
  authorBio: z.string().trim().max(500, 'Author bio must be under 500 characters').optional(),
  category: z.enum(BLOG_CATEGORIES),
  published: z.boolean(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
