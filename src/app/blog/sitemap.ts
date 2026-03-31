import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const BASE_URL = 'https://lastdonor.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await db
    .select({
      slug: blogPosts.slug,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      coverImageUrl: blogPosts.coverImageUrl,
    })
    .from(blogPosts)
    .where(eq(blogPosts.published, true))
    .orderBy(desc(blogPosts.publishedAt));

  return posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt ?? post.publishedAt ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    ...(post.coverImageUrl
      ? {
          images: [post.coverImageUrl],
        }
      : {}),
  }));
}
