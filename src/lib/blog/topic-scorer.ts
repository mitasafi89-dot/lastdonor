/**
 * Topic Scorer - scores and prioritizes blog topics from the queue.
 * Combines keyword metrics, seasonal relevance, news hook freshness,
 * content gap analysis, and category diversity.
 */

import { db } from '@/db';
import { blogPosts, blogTopicQueue } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getSeasonalBoost, getSeasonalReason } from './seasonal-calendar';
import type { KeywordEntry } from './keyword-bank';

export interface TopicScore {
  topicId: string;
  baseScore: number;
  keywordScore: number;
  seasonalBoost: number;
  newsHookBonus: number;
  contentGapBonus: number;
  diversityBonus: number;
  totalScore: number;
  breakdown: string;
}

/**
 * Score a single topic based on multiple factors.
 */
export async function scoreTopic(topic: {
  id: string;
  primaryKeyword: string;
  causeCategory: string | null;
  newsHook: string | null;
  seasonalBoost: number;
}, keywordData?: KeywordEntry): Promise<TopicScore> {
  const baseScore = 50;
  let keywordScore = 0;
  let seasonalBoost = 0;
  let newsHookBonus = 0;
  let contentGapBonus = 0;
  let diversityBonus = 0;

  // 1. Keyword quality score (volume/difficulty ratio)
  if (keywordData) {
    const ratio = keywordData.volume / (keywordData.kd + 1);
    keywordScore = Math.min(Math.round(ratio / 10), 30);
    // Long-tail bonus
    if (keywordData.isLongTail) keywordScore += 5;
    // Informational intent bonus (easier to rank, more valuable for top-of-funnel)
    if (keywordData.intent === 'informational') keywordScore += 3;
  }

  // 2. Seasonal boost
  let seasonalReason = '';
  if (topic.causeCategory) {
    seasonalBoost = getSeasonalBoost(topic.causeCategory);
    seasonalReason = getSeasonalReason(topic.causeCategory);
  }

  // 3. News hook bonus (topics tied to current events score higher)
  if (topic.newsHook) {
    newsHookBonus = 15;
  }

  // 4. Content gap bonus - check if we already have content for this keyword
  const existingPosts = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.published, true),
        sql`${blogPosts.primaryKeyword} = ${topic.primaryKeyword}`,
      ),
    )
    .limit(1);

  if (existingPosts.length === 0) {
    contentGapBonus = 10; // No existing content for this keyword
  }

  // 5. Category diversity - check recent posts to avoid over-publishing in one category
  if (topic.causeCategory) {
    const recentInCategory = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.published, true),
          eq(blogPosts.causeCategory, topic.causeCategory),
        ),
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(5);

    // Fewer recent posts in this category = higher diversity bonus
    diversityBonus = Math.max(0, 10 - recentInCategory.length * 2);
  }

  const totalScore = baseScore + keywordScore + seasonalBoost + newsHookBonus + contentGapBonus + diversityBonus;

  return {
    topicId: topic.id,
    baseScore,
    keywordScore,
    seasonalBoost,
    newsHookBonus,
    contentGapBonus,
    diversityBonus,
    totalScore: Math.min(totalScore, 100),
    breakdown: [
      `base=${baseScore}`,
      `keyword=${keywordScore}`,
      `seasonal=${seasonalBoost}${seasonalReason ? ` (${seasonalReason})` : ''}`,
      `newsHook=${newsHookBonus}`,
      `contentGap=${contentGapBonus}`,
      `diversity=${diversityBonus}`,
    ].join(', '),
  };
}

/**
 * Re-score all pending topics and update their priority scores.
 */
export async function rescoreAllTopics(): Promise<TopicScore[]> {
  const pendingTopics = await db
    .select()
    .from(blogTopicQueue)
    .where(eq(blogTopicQueue.status, 'pending'))
    .orderBy(desc(blogTopicQueue.priorityScore));

  const scores: TopicScore[] = [];

  for (const topic of pendingTopics) {
    const score = await scoreTopic({
      id: topic.id,
      primaryKeyword: topic.primaryKeyword,
      causeCategory: topic.causeCategory,
      newsHook: topic.newsHook,
      seasonalBoost: topic.seasonalBoost,
    });

    scores.push(score);

    // Update the topic's priority score
    await db
      .update(blogTopicQueue)
      .set({
        priorityScore: score.totalScore,
        seasonalBoost: score.seasonalBoost,
        updatedAt: new Date(),
      })
      .where(eq(blogTopicQueue.id, topic.id));
  }

  return scores.sort((a, b) => b.totalScore - a.totalScore);
}
