/**
 * Topic Discovery — discovers and queues new blog topics from keyword bank,
 * seasonal calendar, and news cross-pollination.
 */

import { db } from '@/db';
import { blogTopicQueue, blogPosts, newsItems } from '@/db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { selectKeywordForTopic, getKeywordCategories } from './keyword-bank';
import { getInSeasonCategories, getSeasonalBoost } from './seasonal-calendar';
import { generateSlug } from '@/lib/utils/slug';

/**
 * Discover new blog topics and add them to the queue.
 * Called by the daily cron job.
 */
export async function discoverTopics(maxTopics: number = 3): Promise<string[]> {
  const newTopicIds: string[] = [];

  // Get all existing topic keywords to avoid duplicates
  const existingTopics = await db
    .select({ primaryKeyword: blogTopicQueue.primaryKeyword })
    .from(blogTopicQueue);
  const usedKeywords = existingTopics.map((t) => t.primaryKeyword);

  // Also check published blog post keywords
  const existingPosts = await db
    .select({ primaryKeyword: blogPosts.primaryKeyword })
    .from(blogPosts)
    .where(eq(blogPosts.published, true));
  const publishedKeywords = existingPosts
    .map((p) => p.primaryKeyword)
    .filter(Boolean) as string[];

  const allUsed = [...usedKeywords, ...publishedKeywords];

  // Reserve at least 1 slot for news-inspired topics when available
  const newsReserved = Math.max(1, Math.floor(maxTopics / 3));
  const keywordSlots = maxTopics - newsReserved;

  // 1. Prioritize in-season categories
  const inSeasonCategories = getInSeasonCategories();
  const allCategories = getKeywordCategories();

  // Put in-season categories first, then others
  const orderedCategories = [
    ...inSeasonCategories.map((e) => e.category),
    ...allCategories.filter(
      (c) => !inSeasonCategories.some((e) => e.category === c),
    ),
  ];

  // Remove duplicate categories
  const uniqueCategories = [...new Set(orderedCategories)];

  // 2. Select keywords from each category, rotating through categories
  for (const category of uniqueCategories) {
    if (newTopicIds.length >= keywordSlots) break;

    const keyword = selectKeywordForTopic(category, allUsed);
    if (!keyword) continue;

    // Generate a blog-appropriate title from the keyword
    const title = keywordToTitle(keyword.keyword);
    const slug = generateSlug(title);

    // Check slug uniqueness
    const existing = await db
      .select({ id: blogTopicQueue.id })
      .from(blogTopicQueue)
      .where(eq(blogTopicQueue.slug, slug))
      .limit(1);
    if (existing.length > 0) continue;

    const seasonalBoost = getSeasonalBoost(category);

    const [inserted] = await db
      .insert(blogTopicQueue)
      .values({
        title,
        slug,
        primaryKeyword: keyword.keyword,
        secondaryKeywords: [],
        searchIntent: keyword.intent,
        targetWordCount: keyword.isLongTail ? 2500 : 3000,
        causeCategory: category,
        priorityScore: 50,
        seasonalBoost,
        status: 'pending',
      })
      .returning({ id: blogTopicQueue.id });

    newTopicIds.push(inserted.id);
    allUsed.push(keyword.keyword);
  }

  // 3. News cross-pollination — find recent high-scoring news items
  //    that could inspire blog content (always runs, has reserved slots)
  {
    const recentNews = await db
      .select()
      .from(newsItems)
      .where(
        and(
          gte(newsItems.relevanceScore, 60),
          gte(newsItems.fetchedAt, sql`now() - interval '7 days'`),
        ),
      )
      .orderBy(desc(newsItems.relevanceScore))
      .limit(5);

    for (const news of recentNews) {
      if (newTopicIds.length >= maxTopics) break;
      if (!news.category) continue;

      // Check if we already have a topic from this news item
      const existingFromNews = await db
        .select({ id: blogTopicQueue.id })
        .from(blogTopicQueue)
        .where(eq(blogTopicQueue.sourceNewsId, news.id))
        .limit(1);
      if (existingFromNews.length > 0) continue;

      const keyword = selectKeywordForTopic(news.category, allUsed);
      if (!keyword) continue;

      const title = `${keywordToTitle(keyword.keyword)}: What Recent Events Mean for Donors`;
      const slug = generateSlug(title);

      const existingSlug = await db
        .select({ id: blogTopicQueue.id })
        .from(blogTopicQueue)
        .where(eq(blogTopicQueue.slug, slug))
        .limit(1);
      if (existingSlug.length > 0) continue;

      const [inserted] = await db
        .insert(blogTopicQueue)
        .values({
          title,
          slug,
          primaryKeyword: keyword.keyword,
          secondaryKeywords: [],
          searchIntent: 'informational',
          targetWordCount: 2500,
          causeCategory: news.category,
          priorityScore: 50,
          seasonalBoost: getSeasonalBoost(news.category),
          newsHook: news.title,
          sourceNewsId: news.id,
          status: 'pending',
        })
        .returning({ id: blogTopicQueue.id });

      newTopicIds.push(inserted.id);
      allUsed.push(keyword.keyword);
    }
  }

  return newTopicIds;
}

/**
 * Convert a keyword phrase into a proper blog title.
 */
function keywordToTitle(keyword: string): string {
  // Capitalize first letter of each significant word
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  return keyword
    .split(' ')
    .map((word, i) => {
      if (i === 0 || !stopWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}
