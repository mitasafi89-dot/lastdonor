/**
 * Content Refresh — identifies stale blog posts that need updating
 * and orchestrates their refresh through the AI pipeline.
 */

import { db } from '@/db';
import { blogPosts, blogTopicQueue } from '@/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

export interface StalePost {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
  wordCount: number | null;
  seoScore: number | null;
  primaryKeyword: string | null;
  causeCategory: string | null;
  daysSincePublished: number;
  refreshReason: string;
}

/**
 * Find blog posts that are candidates for content refresh.
 * Criteria:
 * - Published more than 90 days ago
 * - SEO score below 60 OR word count below 1500
 * - Source is 'ai_generated'
 */
export async function findStalePosts(maxResults = 5): Promise<StalePost[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const stalePosts = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      publishedAt: blogPosts.publishedAt,
      wordCount: blogPosts.wordCount,
      seoScore: blogPosts.seoScore,
      primaryKeyword: blogPosts.primaryKeyword,
      causeCategory: blogPosts.causeCategory,
    })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.published, true),
        eq(blogPosts.source, 'ai_generated'),
        lt(blogPosts.publishedAt, ninetyDaysAgo),
      ),
    )
    .orderBy(blogPosts.seoScore)
    .limit(maxResults);

  return stalePosts.map((post) => {
    const daysSince = post.publishedAt
      ? Math.floor((Date.now() - post.publishedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let reason = 'Age > 90 days';
    if (post.seoScore !== null && post.seoScore < 60) {
      reason += `, low SEO score (${post.seoScore})`;
    }
    if (post.wordCount !== null && post.wordCount < 1500) {
      reason += `, short content (${post.wordCount} words)`;
    }

    return {
      ...post,
      daysSincePublished: daysSince,
      refreshReason: reason,
    };
  });
}

/**
 * Queue stale posts for content refresh by creating
 * refresh topics in the blog_topic_queue.
 */
export async function queueRefreshTopics(stalePosts: StalePost[]): Promise<number> {
  let queued = 0;

  for (const post of stalePosts) {
    // Check if a refresh topic already exists for this post
    const existing = await db
      .select({ id: blogTopicQueue.id })
      .from(blogTopicQueue)
      .where(
        and(
          eq(blogTopicQueue.slug, `refresh-${post.slug}`),
          sql`${blogTopicQueue.status} IN ('pending', 'generating')`,
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(blogTopicQueue).values({
      title: `[REFRESH] ${post.title}`,
      slug: `refresh-${post.slug}`,
      primaryKeyword: post.primaryKeyword ?? post.title.split(' ').slice(0, 3).join(' ').toLowerCase(),
      secondaryKeywords: [],
      searchIntent: 'informational',
      targetWordCount: Math.max(post.wordCount ?? 2000, 2500),
      causeCategory: post.causeCategory ?? 'community',
      priorityScore: 65, // Refreshes get moderate priority
      status: 'pending',
      newsHook: `Content refresh: ${post.refreshReason}`,
    });

    queued++;
  }

  return queued;
}
