/**
 * Reddit Listener - discovers blog topic candidates from Reddit communities.
 *
 * Fetches posts from targeted subreddits, classifies them with AI,
 * and inserts qualifying topics into the blog pipeline.
 *
 * Design decisions:
 *  - Uses Reddit's public JSON API (no auth needed, ~10 req/min limit)
 *  - Captures BOTH complaints (pain points) and compliments (gratitude/success)
 *  - Minimum upvote threshold: 10 (configurable)
 *  - Posts are stored in newsItems for audit trail
 *  - Topics are inserted directly into blogTopicQueue for generation
 *  - AI classifies posts in batches (1 call per run, not per post)
 *
 * Psychology of content sourcing:
 *  - Complaints reveal what people desperately search for when in crisis.
 *    These map to high-intent informational/transactional keywords.
 *  - Compliments reveal what donors and recipients feel grateful for.
 *    These map to trust-building, social-proof, donor-psychology content.
 *  - Both types serve the full funnel: attract (SEO) -> trust (proof) -> convert (donate).
 */

import { db } from '@/db';
import { newsItems, blogTopicQueue, blogPosts } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { callAI } from '@/lib/ai/call-ai';
import {
  buildClassifyRedditPostsPrompt,
  type RedditPostInput,
  type ClassifyRedditOutput,
  type ClassifiedRedditPost,
} from '@/lib/ai/prompts/classify-reddit-posts';
import { generateSlug } from '@/lib/utils/slug';
import { getSeasonalBoost } from './seasonal-calendar';
import { checkTopicCandidate } from './publishing-guardrails';
import { pipelineLog, pipelineWarn } from '@/lib/server-logger';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Minimum upvotes for a post to be considered. */
export const MIN_UPVOTES = 10;

/** Maximum Reddit posts to send to AI in one batch (controls cost). */
const AI_BATCH_SIZE = 20;

/** Minimum AI relevance score for a post to become a topic. */
const MIN_RELEVANCE_SCORE = 60;

/** Reddit JSON API requires a descriptive User-Agent (per API rules). */
const USER_AGENT = 'LastDonor-BlogDiscovery/1.0 (blog topic research)';

/** Timeout for Reddit API calls (ms). */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Subreddit configuration.
 *
 * Each entry maps a subreddit to a default category and a relevance boost.
 * The boost is added to the AI's relevance score to favor high-signal subs.
 *
 * Selection rationale:
 *  - Core subs (GoFundMe, Assistance, Crowdfunding) have nearly every post
 *    about fundraising -- high signal, low noise.
 *  - Crisis subs (povertyfinance, cancer, transplant) surface authentic
 *    language from people in active need -- the exact phrases they Google.
 *  - Gratitude subs and flairs capture success stories and donor psychology.
 */
export const SUBREDDIT_CONFIG = [
  // Core fundraising (almost every post is relevant)
  { subreddit: 'gofundme', defaultCategory: null, relevanceBoost: 10, listing: 'hot' as const },
  { subreddit: 'Assistance', defaultCategory: 'community', relevanceBoost: 5, listing: 'hot' as const },
  { subreddit: 'Crowdfunding', defaultCategory: null, relevanceBoost: 8, listing: 'hot' as const },

  // Financial hardship (high volume of crisis language)
  { subreddit: 'povertyfinance', defaultCategory: 'essential-needs', relevanceBoost: 3, listing: 'top' as const },
  { subreddit: 'personalfinance', defaultCategory: 'emergency', relevanceBoost: 0, listing: 'top' as const },

  // Medical (deeply emotional, high search intent)
  { subreddit: 'cancer', defaultCategory: 'medical', relevanceBoost: 5, listing: 'top' as const },
  { subreddit: 'transplant', defaultCategory: 'medical', relevanceBoost: 5, listing: 'top' as const },
  { subreddit: 'ChronicIllness', defaultCategory: 'medical', relevanceBoost: 3, listing: 'top' as const },

  // Veterans/military
  { subreddit: 'Veterans', defaultCategory: 'veterans', relevanceBoost: 3, listing: 'top' as const },

  // Disaster recovery
  { subreddit: 'TropicalWeather', defaultCategory: 'disaster', relevanceBoost: 0, listing: 'top' as const },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface RedditApiPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    url: string;
    permalink: string;
    link_flair_text: string | null;
    subreddit: string;
    created_utc: number;
    is_self: boolean;
    over_18: boolean;
    stickied: boolean;
    removed_by_category: string | null;
  };
}

interface RedditApiResponse {
  data: {
    children: RedditApiPost[];
    after: string | null;
  };
}

export interface RedditTopicResult {
  topicId: string;
  newsItemId: string;
  keyword: string;
  category: string;
  sentiment: string;
  relevanceScore: number;
  redditUrl: string;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch Reddit posts, classify them, and insert qualifying ones as blog topics.
 *
 * @param maxTopics - Maximum number of topics to create (default: 2)
 * @returns Array of created topic results
 */
export async function fetchRedditTopics(
  maxTopics: number = 2,
): Promise<RedditTopicResult[]> {
  // 1. Collect candidate posts from all configured subreddits
  const candidates = await collectCandidates();
  if (candidates.length === 0) {
    pipelineLog('reddit', 'No qualifying posts found across all subreddits');
    return [];
  }

  // 2. Deduplicate against existing newsItems by URL
  const deduped = await deduplicateAgainstExisting(candidates);
  if (deduped.length === 0) {
    pipelineLog('reddit', 'All candidates already processed');
    return [];
  }

  // 3. Sort by engagement (score * sqrt(num_comments)) and take top batch
  const sorted = deduped.sort((a, b) => engagementScore(b) - engagementScore(a));
  const batch = sorted.slice(0, AI_BATCH_SIZE);

  // 4. Classify with AI
  const classified = await classifyBatch(batch);
  if (classified.length === 0) {
    pipelineLog('reddit', 'No posts met relevance threshold after AI classification');
    return [];
  }

  // 5. Apply relevance boost from subreddit config
  const boosted = classified.map((c) => {
    const config = SUBREDDIT_CONFIG.find(
      (s) => s.subreddit.toLowerCase() === batch[c.index].subreddit.toLowerCase(),
    );
    return {
      ...c,
      relevanceScore: Math.min(100, c.relevanceScore + (config?.relevanceBoost ?? 0)),
    };
  });

  // 6. Filter by final relevance threshold
  const qualifying = boosted.filter((c) => c.relevanceScore >= MIN_RELEVANCE_SCORE);
  if (qualifying.length === 0) {
    pipelineLog('reddit', 'No posts above relevance threshold after boost');
    return [];
  }

  // 7. Sort by relevance (highest first) and insert up to maxTopics
  qualifying.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const results: RedditTopicResult[] = [];

  for (const classified of qualifying) {
    if (results.length >= maxTopics) break;

    const post = batch[classified.index];
    const result = await insertRedditTopic(post, classified);
    if (result) {
      results.push(result);
    }
  }

  pipelineLog('reddit', `Created ${results.length} topics from ${candidates.length} candidates (${deduped.length} new, ${classified.length} classified, ${qualifying.length} qualifying)`);

  return results;
}

// ─── Reddit API ─────────────────────────────────────────────────────────────

/**
 * Fetch posts from a single subreddit using the public JSON API.
 *
 * Uses the .json suffix on subreddit URLs, which requires no authentication.
 * Rate limit: ~10 requests per minute for unauthenticated access.
 * We set raw_json=1 to get unescaped HTML entities in titles/selftext.
 */
async function fetchSubreddit(
  subreddit: string,
  listing: 'hot' | 'top' = 'hot',
  limit: number = 25,
): Promise<RedditApiPost[]> {
  const timeParam = listing === 'top' ? '&t=week' : '';
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${listing}.json?limit=${limit}&raw_json=1${timeParam}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      // 403 = private/quarantined, 404 = doesn't exist, 429 = rate limited
      pipelineWarn('reddit', `r/${subreddit} returned ${response.status}, skipping`);
      return [];
    }

    const data = (await response.json()) as RedditApiResponse;
    return data?.data?.children ?? [];
  } catch (error) {
    // Network error, timeout, or parse failure -- skip this sub, don't crash the cron
    const message = error instanceof Error ? error.message : String(error);
    pipelineWarn('reddit', `Failed to fetch r/${subreddit}: ${message}`);
    return [];
  }
}

/**
 * Collect candidate posts from all configured subreddits.
 * Filters out: stickied, NSFW, removed, below upvote threshold.
 */
async function collectCandidates(): Promise<RedditPostInput[]> {
  const allCandidates: RedditPostInput[] = [];
  const seenIds = new Set<string>();

  for (const config of SUBREDDIT_CONFIG) {
    const posts = await fetchSubreddit(config.subreddit, config.listing);

    for (const post of posts) {
      const d = post.data;

      // Skip: stickied (mod announcements), NSFW, removed, low engagement, duplicates
      if (d.stickied) continue;
      if (d.over_18) continue;
      if (d.removed_by_category) continue;
      if (d.score < MIN_UPVOTES) continue;
      if (seenIds.has(d.id)) continue;
      seenIds.add(d.id);

      // Skip very short titles (likely spam or link-only posts)
      if (d.title.length < 15) continue;

      allCandidates.push({
        subreddit: d.subreddit,
        title: d.title,
        selftext: d.selftext?.slice(0, 500) ?? '',
        score: d.score,
        numComments: d.num_comments,
        flair: d.link_flair_text,
        // Store permalink for newsItems URL (not d.url which may point to external link)
        _permalink: `https://www.reddit.com${d.permalink}`,
        _createdUtc: d.created_utc,
      } as RedditPostInput & { _permalink: string; _createdUtc: number });
    }

    // Brief pause between subreddit fetches to respect rate limits (100ms)
    await new Promise((r) => setTimeout(r, 100));
  }

  return allCandidates;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

/**
 * Filter out posts whose URL already exists in newsItems.
 * This prevents reprocessing the same Reddit post on consecutive cron runs.
 */
async function deduplicateAgainstExisting(
  candidates: RedditPostInput[],
): Promise<RedditPostInput[]> {
  if (candidates.length === 0) return [];

  // Gather all candidate URLs
  const urls = candidates.map((c) => (c as RedditPostInput & { _permalink: string })._permalink);

  // Query existing newsItems for these URLs
  const existing = await db
    .select({ url: newsItems.url })
    .from(newsItems)
    .where(sql`${newsItems.url} = ANY(${sql`ARRAY[${sql.join(
      urls.map((u) => sql`${u}`),
      sql`, `,
    )}]`})`);

  const existingUrls = new Set(existing.map((e) => e.url));

  return candidates.filter(
    (c) => !existingUrls.has((c as RedditPostInput & { _permalink: string })._permalink),
  );
}

// ─── AI Classification ──────────────────────────────────────────────────────

/**
 * Send a batch of Reddit posts to AI for keyword extraction and classification.
 * Returns only posts that meet the relevance threshold.
 */
async function classifyBatch(
  posts: RedditPostInput[],
): Promise<ClassifiedRedditPost[]> {
  if (posts.length === 0) return [];

  const { systemPrompt, userPrompt } = buildClassifyRedditPostsPrompt(posts);

  try {
    const result = await callAI<ClassifyRedditOutput>({
      systemPrompt,
      userPrompt,
      parseJson: true,
      maxTokens: 4096,
      promptType: 'reddit_classify',
    });

    if (!result?.posts || !Array.isArray(result.posts)) {
      pipelineWarn('reddit', 'AI returned invalid classification structure');
      return [];
    }

    // Validate each classified post
    return result.posts.filter((p) => {
      if (typeof p.index !== 'number' || p.index < 0 || p.index >= posts.length) return false;
      if (!p.keyword || p.keyword.length < 5) return false;
      if (!p.category) return false;
      if (typeof p.relevanceScore !== 'number') return false;
      if (p.relevanceScore < 55) return false;
      return true;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[reddit-listener] AI classification failed: ${message}`);
    return [];
  }
}

// ─── Database Insert ────────────────────────────────────────────────────────

/**
 * Insert a qualifying Reddit post as a newsItem + blogTopicQueue entry.
 *
 * Returns null if the keyword is already used or the slug collides.
 */
async function insertRedditTopic(
  post: RedditPostInput,
  classified: ClassifiedRedditPost,
): Promise<RedditTopicResult | null> {
  const permalink = (post as RedditPostInput & { _permalink: string })._permalink;
  const createdUtc = (post as RedditPostInput & { _createdUtc: number })._createdUtc;

  // 1. Insert into newsItems (audit trail)
  let newsItemId: string;
  try {
    const [inserted] = await db
      .insert(newsItems)
      .values({
        title: post.title.slice(0, 500),
        url: permalink,
        source: `reddit/r/${post.subreddit}`,
        summary: post.selftext?.slice(0, 500) || null,
        category: classified.category as typeof newsItems.$inferInsert.category,
        relevanceScore: classified.relevanceScore,
        publishedAt: new Date(createdUtc * 1000),
      })
      .onConflictDoNothing({ target: newsItems.url })
      .returning({ id: newsItems.id });

    if (!inserted) {
      // URL conflict -- already exists (race condition with dedup check)
      return null;
    }
    newsItemId = inserted.id;
  } catch {
    pipelineWarn('reddit', `Failed to insert newsItem for ${permalink}`);
    return null;
  }

  // 2. Check keyword isn't already in the queue or published
  const keyword = classified.keyword.toLowerCase().trim();
  const existingKeyword = await db
    .select({ id: blogTopicQueue.id })
    .from(blogTopicQueue)
    .where(eq(blogTopicQueue.primaryKeyword, keyword))
    .limit(1);

  if (existingKeyword.length > 0) {
    pipelineLog('reddit', `Keyword already in queue: "${keyword}"`);
    return null;
  }

  const publishedWithKeyword = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(sql`${blogPosts.primaryKeyword} = ${keyword} AND ${blogPosts.published} = true`)
    .limit(1);

  if (publishedWithKeyword.length > 0) {
    pipelineLog('reddit', `Keyword already published: "${keyword}"`);
    return null;
  }

  // 3. Generate slug and check uniqueness
  const title = classified.suggestedTitle || keywordToTitle(keyword);
  const slug = generateSlug(title);

  const existingSlug = await db
    .select({ id: blogTopicQueue.id })
    .from(blogTopicQueue)
    .where(eq(blogTopicQueue.slug, slug))
    .limit(1);

  if (existingSlug.length > 0) {
    pipelineLog('reddit', `Slug collision in queue: "${slug}"`);
    return null;
  }

  const existingSlugPost = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (existingSlugPost.length > 0) {
    pipelineLog('reddit', `Slug collision with published post: "${slug}"`);
    return null;
  }

  // 3b. Publishing guardrails: keyword similarity, title similarity, category cadence
  const guardrails = await checkTopicCandidate(keyword, title, classified.category);
  if (!guardrails.allowed) {
    pipelineLog('reddit', `Guardrail blocked: ${guardrails.reasons.join('; ')}`);
    return null;
  }

  // 4. Calculate priority score
  //    Reddit-sourced topics get newsHook bonus (+15) from the scorer.
  //    We also factor in engagement: high-upvote posts indicate stronger demand.
  const engagementBonus = Math.min(10, Math.floor(Math.log10(Math.max(post.score, 1)) * 4));
  const seasonalBoost = getSeasonalBoost(classified.category);
  const basePriority = 50 + engagementBonus;

  // 5. Build the news hook that will contextualize AI generation.
  //    This is what the article assembler sees as the "inspiration" for the content.
  //    PII is scrubbed: names, ages, and dollar amounts are redacted because
  //    Reddit posters did not consent to appearing in permanent indexed blog content.
  const sentimentLabel =
    classified.sentiment === 'complaint'
      ? 'A real person shared their struggle'
      : classified.sentiment === 'compliment'
        ? 'A real person shared their gratitude'
        : classified.sentiment === 'question'
          ? 'A real person asked for guidance'
          : 'A community discussion emerged about';

  const scrubbed = scrubPII(post.title.slice(0, 200));
  const newsHook = `${sentimentLabel}: "${scrubbed}" (r/${post.subreddit}, ${post.score} upvotes). Blog angle: ${classified.blogAngle}`;

  // 6. Insert into blogTopicQueue
  try {
    const [inserted] = await db
      .insert(blogTopicQueue)
      .values({
        title,
        slug,
        primaryKeyword: keyword,
        secondaryKeywords: [],
        searchIntent: classified.searchIntent,
        targetWordCount: classified.sentiment === 'compliment' ? 2000 : 2500,
        causeCategory: classified.category,
        priorityScore: basePriority,
        seasonalBoost,
        newsHook,
        sourceNewsId: newsItemId,
        status: 'pending',
      })
      .returning({ id: blogTopicQueue.id });

    return {
      topicId: inserted.id,
      newsItemId,
      keyword,
      category: classified.category,
      sentiment: classified.sentiment,
      relevanceScore: classified.relevanceScore,
      redditUrl: permalink,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pipelineWarn('reddit', `Failed to insert topic: ${message}`);
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Engagement score: combines upvotes with comment activity.
 * Comments indicate discussion depth; sqrt dampens outlier threads.
 */
function engagementScore(post: RedditPostInput): number {
  return post.score * Math.sqrt(Math.max(post.numComments, 1));
}

/**
 * Remove personally identifiable information from Reddit post titles.
 *
 * Reddit fundraising posts often contain real names, ages, and dollar amounts:
 *   "My husband John Smith (42) needs $50k for cancer treatment"
 *
 * These must NOT appear in published blog content because:
 *   1. The person never consented to permanent indexed exposure
 *   2. Medical/financial details are sensitive (HIPAA-adjacent, GDPR)
 *   3. If the Reddit post is deleted, the blog post would preserve PII
 *
 * Scrubbing is intentionally aggressive: false positives (over-redacting)
 * are harmless to content quality because the AI uses the blog angle and
 * keyword, not the literal Reddit title, to generate the article.
 */
export function scrubPII(text: string): string {
  let s = text;
  // Likely proper names: two+ consecutive capitalized words (John Smith, Mary Jane Watson)
  s = s.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, '[someone]');
  // Age patterns: (42), 42-year-old, 42 year old, age 42, aged 42
  s = s.replace(/\(\d{1,3}\)/g, '');
  s = s.replace(/\b\d{1,3}[-\s]?year[-\s]?old\b/gi, '[person]');
  s = s.replace(/\bage[d]?\s+\d{1,3}\b/gi, '');
  // Dollar amounts: $50k, $50,000, $100K
  s = s.replace(/\$[\d,]+[kKmM]?\b/g, '[amount]');
  // Usernames: u/username, @username (require u/ with slash, or @ prefix)
  s = s.replace(/\bu\/\w{3,}/g, '[user]');
  s = s.replace(/@\w{3,}/g, '[user]');
  // Clean up artifacts: double spaces, orphaned parentheses, leading/trailing punctuation
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s{2,}/g, ' ');
  s = s.trim();
  return s;
}

/**
 * Fallback title generation from keyword if AI doesn't provide one.
 */
function keywordToTitle(keyword: string): string {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  ]);

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
