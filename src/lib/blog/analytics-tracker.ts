/**
 * Blog Analytics Tracker — lightweight internal analytics
 * for tracking blog post performance metrics.
 */

import { db } from '@/db';
import { blogPosts, blogGenerationLogs } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

export interface BlogPerformanceMetrics {
  totalPosts: number;
  totalAiGenerated: number;
  totalPublished: number;
  avgSeoScore: number;
  avgWordCount: number;
  postsByCategory: Record<string, number>;
  recentPosts: Array<{
    title: string;
    slug: string;
    seoScore: number | null;
    wordCount: number | null;
    publishedAt: Date | null;
  }>;
}

/**
 * Get aggregate blog performance metrics for the admin dashboard.
 */
export async function getBlogPerformanceMetrics(): Promise<BlogPerformanceMetrics> {
  const [totals] = await db
    .select({
      totalPosts: sql<number>`count(*)::int`,
      totalAiGenerated: sql<number>`count(*) filter (where ${blogPosts.source} = 'ai_generated')::int`,
      totalPublished: sql<number>`count(*) filter (where ${blogPosts.published} = true)::int`,
      avgSeoScore: sql<number>`coalesce(avg(${blogPosts.seoScore}), 0)::int`,
      avgWordCount: sql<number>`coalesce(avg(${blogPosts.wordCount}), 0)::int`,
    })
    .from(blogPosts);

  const categoryBreakdown = await db
    .select({
      category: blogPosts.category,
      count: sql<number>`count(*)::int`,
    })
    .from(blogPosts)
    .where(eq(blogPosts.published, true))
    .groupBy(blogPosts.category);

  const recentPosts = await db
    .select({
      title: blogPosts.title,
      slug: blogPosts.slug,
      seoScore: blogPosts.seoScore,
      wordCount: blogPosts.wordCount,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(eq(blogPosts.published, true))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(10);

  const postsByCategory: Record<string, number> = {};
  for (const row of categoryBreakdown) {
    postsByCategory[row.category] = row.count;
  }

  return {
    totalPosts: totals.totalPosts,
    totalAiGenerated: totals.totalAiGenerated,
    totalPublished: totals.totalPublished,
    avgSeoScore: totals.avgSeoScore,
    avgWordCount: totals.avgWordCount,
    postsByCategory,
    recentPosts,
  };
}

export interface PipelineHealthMetrics {
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
  errorsByStep: Record<string, number>;
}

/**
 * Get pipeline health metrics from generation logs.
 */
export async function getPipelineHealthMetrics(
  daysBack = 30,
): Promise<PipelineHealthMetrics> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [totals] = await db
    .select({
      totalRuns: sql<number>`count(*)::int`,
      successCount: sql<number>`count(*) filter (where ${blogGenerationLogs.success} = true)::int`,
      avgLatency: sql<number>`coalesce(avg(${blogGenerationLogs.latencyMs}), 0)::int`,
    })
    .from(blogGenerationLogs)
    .where(sql`${blogGenerationLogs.createdAt} >= ${since}`);

  const errors = await db
    .select({
      step: blogGenerationLogs.step,
      count: sql<number>`count(*)::int`,
    })
    .from(blogGenerationLogs)
    .where(
      and(
        eq(blogGenerationLogs.success, false),
        sql`${blogGenerationLogs.createdAt} >= ${since}`,
      ),
    )
    .groupBy(blogGenerationLogs.step);

  const errorsByStep: Record<string, number> = {};
  for (const row of errors) {
    errorsByStep[row.step] = row.count;
  }

  return {
    totalRuns: totals.totalRuns,
    successRate: totals.totalRuns > 0 ? totals.successCount / totals.totalRuns : 0,
    avgLatencyMs: totals.avgLatency,
    errorsByStep,
  };
}
