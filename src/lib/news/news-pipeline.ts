import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, lt, gt, gte, ne, inArray, sql, desc } from 'drizzle-orm';
import { fetchGNewsArticles } from './gnews-client';
import { fetchAllRssFeeds } from './rss-parser';
import { fetchFemaDeclarations } from './fema-client';
import { fetchWeatherAlerts } from './weather-alerts';
import {
  buildClassifyNewsPrompt,
  CLASSIFY_SCORE_THRESHOLD,
  type ClassifyNewsOutput,
} from '@/lib/ai/prompts/classify-news';
import {
  buildExtractEntitiesPrompt,
  type ExtractedEntity,
} from '@/lib/ai/prompts/extract-entities';
import {
  buildGenerateCampaignPrompt,
  getDefaultImpactTiers,
} from '@/lib/ai/prompts/generate-campaign';
import { buildGenerateHeadlinePrompt, validateHeadline, buildFallbackTitle } from '@/lib/ai/prompts/generate-headline';
import { buildGenerateMessagesPrompt } from '@/lib/ai/prompts/generate-messages';
import { callAI } from '@/lib/ai/call-ai';
import { generateSlug } from '@/lib/utils/slug';
import { getCampaignPhase } from '@/lib/utils/phase';
import { isValidEntityName, normalizeSubjectName, normalizeLocation } from '@/lib/utils/entity-validation';
import { fetchArticleBody } from './fetch-article-body';
import type { NormalizedNewsItem } from './gnews-client';
import { generateTrajectoryProfile } from '@/lib/seed/trajectory-profiles';
import { generateOrganizerIdentity } from '@/lib/seed/organizer-generator';
import { validateMessages } from '@/lib/seed/message-validation';
import { resolveHeroImage } from '@/lib/news/image-validation';
import { cleanStoryHtml, validateStory } from '@/lib/ai/prompts/story-validation';
import type { StoryPattern } from '@/lib/ai/prompts/story-structures';
import { getWordRange, scoreContextRichness } from '@/lib/ai/prompts/story-structures';
import type { CampaignCategory } from '@/types';
import { getSetting } from '@/lib/settings.server';

export type PipelineResult = {
  fetched: number;
  classified: number;
  extracted: number;
  published: number;
  retained: number;
  errors: string[];
};

/** Max age in days for articles to be eligible for ingestion. */
const FRESHNESS_CUTOFF_DAYS = 14;

/** Max concurrent AI classification calls per batch. */
const CLASSIFY_CONCURRENCY = 5;

/**
 * Full news ingestion pipeline:
 * 1. Fetch from GNews + RSS + FEMA + NWS
 * 1b. Balance sources (military ≤ 40%)
 * 1c. Freshness hard filter (articles must be ≤ 14 days old)
 * 2. Deduplicate against existing news_items (indexed IN query)
 * 3. Batch-insert new articles
 * 3b. Fetch full article body (before classification for accuracy)
 * 4. Classify in parallel (batches of 5) using full body text
 * 5. Extract entities from high-scoring articles
 * 5b. Cross-source duplicate detection (entity name + location)
 * 6. Generate story + headline concurrently
 * 7. Generate seed messages
 * 8. Publish as active campaigns
 * 9. Clean up stale low-score rows (>30 days)
 */
export async function runNewsPipeline(
  mode: 'ingest' | 'fetch-rss',
): Promise<PipelineResult> {
  const result: PipelineResult = {
    fetched: 0,
    classified: 0,
    extracted: 0,
    published: 0,
    retained: 0,
    errors: [],
  };

  // ── Step 1: Fetch articles ────────────────────────────────────────────
  let articles: NormalizedNewsItem[] = [];

  if (mode === 'ingest') {
    const [gnewsArticles, femaItems, nwsAlerts] = await Promise.allSettled([
      fetchGNewsArticles(),
      fetchFemaDeclarations(),
      fetchWeatherAlerts(),
    ]);

    const allFailed =
      gnewsArticles.status === 'rejected' &&
      femaItems.status === 'rejected' &&
      nwsAlerts.status === 'rejected';

    if (gnewsArticles.status === 'fulfilled') articles.push(...gnewsArticles.value);
    if (femaItems.status === 'fulfilled') articles.push(...femaItems.value);
    if (nwsAlerts.status === 'fulfilled') articles.push(...nwsAlerts.value);

    // Graceful degradation: alert admin if ALL news sources failed
    if (allFailed) {
      await db.insert(schema.auditLogs).values({
        eventType: 'pipeline.all_sources_failed',
        severity: 'critical',
        details: {
          gnews: gnewsArticles.status === 'rejected' ? String(gnewsArticles.reason) : null,
          fema: femaItems.status === 'rejected' ? String(femaItems.reason) : null,
          nws: nwsAlerts.status === 'rejected' ? String(nwsAlerts.reason) : null,
        },
      });
      result.errors.push('All news sources failed - admin alerted');
      return result;
    }

    // Log individual source failures at warning level
    const sourceFailures: string[] = [];
    if (gnewsArticles.status === 'rejected') sourceFailures.push(`GNews: ${String(gnewsArticles.reason)}`);
    if (femaItems.status === 'rejected') sourceFailures.push(`FEMA: ${String(femaItems.reason)}`);
    if (nwsAlerts.status === 'rejected') sourceFailures.push(`NWS: ${String(nwsAlerts.reason)}`);

    if (sourceFailures.length > 0) {
      await db.insert(schema.auditLogs).values({
        eventType: 'pipeline.source_failures',
        severity: 'warning',
        details: { failures: sourceFailures },
      });
      result.errors.push(...sourceFailures);
    }
  } else {
    articles = await fetchAllRssFeeds();
  }

  result.fetched = articles.length;
  if (articles.length === 0) return result;

  // ── Step 1b: Balance sources (military ≤ 40%) ────────────────────────
  articles = balanceSources(articles);

  // ── Step 1c: Freshness hard filter ───────────────────────────────────
  // Reject articles older than 14 days or without a publication date
  const freshnessCutoff = Date.now() - FRESHNESS_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  articles = articles.filter((a) => {
    if (!a.publishedAt) return false;
    return a.publishedAt.getTime() >= freshnessCutoff;
  });
  if (articles.length === 0) return result;

  // ── Step 2: Deduplicate via indexed IN query ─────────────────────────
  const newArticles = await deduplicateArticles(articles);
  if (newArticles.length === 0) return result;

  // ── Step 3: Batch-insert all new articles in one statement ───────────
  try {
    await db
      .insert(schema.newsItems)
      .values(
        newArticles.map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source,
          summary: a.summary,
          imageUrl: a.imageUrl ?? null,
          category: a.category ?? null,
          publishedAt: a.publishedAt,
        })),
      )
      .onConflictDoNothing();
  } catch (error) {
    result.errors.push(`Batch insert error: ${String(error)}`);
    return result;
  }

  // ── Step 3b: Fetch full article body before classification ───────────
  // Classification accuracy is dramatically better with full body text
  // vs. the 1-2 sentence summary from GNews.
  const bodyMap = new Map<string, string>();
  const bodyBatchSize = 5;

  for (let i = 0; i < newArticles.length; i += bodyBatchSize) {
    const batch = newArticles.slice(i, i + bodyBatchSize);
    const results = await Promise.allSettled(
      batch.map(async (article) => {
        const body = await fetchArticleBody(article.url, article.summary);
        bodyMap.set(article.url, body);

        // Persist fetched body to DB for future reference
        await db
          .update(schema.newsItems)
          .set({ articleBody: body })
          .where(eq(schema.newsItems.url, article.url));
      }),
    );
    for (const r of results) {
      if (r.status === 'rejected') {
        result.errors.push(`Body fetch error: ${String(r.reason)}`);
      }
    }
  }

  // ── Step 4: Classify in parallel batches (using full body) ──────────
  type ClassifiedArticle = {
    article: NormalizedNewsItem;
    classification: ClassifyNewsOutput;
    articleBody: string;
  };
  const qualified: ClassifiedArticle[] = [];

  for (let i = 0; i < newArticles.length; i += CLASSIFY_CONCURRENCY) {
    const batch = newArticles.slice(i, i + CLASSIFY_CONCURRENCY);

    const settlements = await Promise.allSettled(
      batch.map(async (article) => {
        const articleBody = bodyMap.get(article.url) ?? article.summary;

        const { systemPrompt, userPrompt } = buildClassifyNewsPrompt({
          title: article.title,
          body: articleBody,
        });

        const classification = await callAI<ClassifyNewsOutput>({
          systemPrompt,
          userPrompt,
          promptType: 'classify-news',
        });

        // Write score back to DB
        await db
          .update(schema.newsItems)
          .set({
            category: classification.category as CampaignCategory,
            relevanceScore: classification.score,
          })
          .where(eq(schema.newsItems.url, article.url));

        return { article, classification, articleBody };
      }),
    );

    for (const settlement of settlements) {
      if (settlement.status === 'fulfilled') {
        result.classified++;
        if (settlement.value.classification.score >= CLASSIFY_SCORE_THRESHOLD) {
          qualified.push(settlement.value);
        }
      } else {
        result.errors.push(`Classify error: ${String(settlement.reason)}`);
      }
    }
  }

  // ── Steps 5–8: Process each qualified article ────────────────────────

  // Rate limit: check how many automated campaigns were created today
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [dailyLimitSetting] = await db
    .select({ value: schema.siteSettings.value })
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, 'campaign_creation_daily_limit'));

  const dailyLimit = dailyLimitSetting ? Number(dailyLimitSetting.value) : 10;

  // Max concurrent simulated campaigns guard
  const [activeSim] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.campaigns)
    .where(
      and(
        eq(schema.campaigns.simulationFlag, true),
        inArray(schema.campaigns.status, ['active', 'last_donor_zone']),
      ),
    );
  const maxConcurrentSetting = await getSetting('simulation.max_concurrent');
  const maxConcurrent = maxConcurrentSetting ?? 10;

  // Phase-out guard: stop creating new simulated campaigns if volume is 0
  const { calculateAutoVolume } = await import('@/lib/seed/phase-out');
  const autoVolume = await calculateAutoVolume();
  if (autoVolume === 0) {
    result.errors.push('Phase-out threshold reached - no new simulated campaigns');
    return result;
  }

  const [todayCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.campaigns)
    .where(
      and(
        eq(schema.campaigns.source, 'automated'),
        gte(schema.campaigns.publishedAt, startOfDay),
      ),
    );

  let campaignsCreatedThisRun = 0;

  // Fetch recent campaign titles for dedup awareness in headline generation
  const recentCampaigns = await db
    .select({
      title: schema.campaigns.title,
      subjectName: schema.campaigns.subjectName,
    })
    .from(schema.campaigns)
    .orderBy(desc(schema.campaigns.createdAt))
    .limit(15);

  const recentTitles = recentCampaigns.map((c) => c.title);

  // Track recently used story patterns for anti-repetition within this batch
  const recentStoryPatterns: StoryPattern[] = [];
  // Track organizer names used in this batch to avoid repetition
  const recentOrganizerNames: string[] = [];
  // Track location+category pairs for same-event dedup within this batch
  const batchLocationCategories: { location: string; category: string }[] = [];

  for (const { article, classification, articleBody } of qualified) {
    try {
      // Step 5: Extract entities (use pre-fetched full article body)
      const entityPrompt = buildExtractEntitiesPrompt({
        title: article.title,
        body: articleBody,
        category: classification.category,
      });

      const entity = await callAI<ExtractedEntity>({
        systemPrompt: entityPrompt.systemPrompt,
        userPrompt: entityPrompt.userPrompt,
        promptType: 'extract-entities',
      });

      entity.sourceUrl = entity.sourceUrl || article.url;
      entity.sourceName = entity.sourceName || article.source;
      entity.name = entity.name || '';
      entity.hometown = entity.hometown || 'Unknown';
      entity.category = entity.category || (classification.category as CampaignCategory);
      entity.confidence = entity.confidence ?? 50;

      // Step 5b: Validate entity name - reject garbage before creating campaigns
      if (!isValidEntityName(entity.name, article.title)) {
        result.errors.push(`Skipped "${article.title}": invalid entity name "${entity.name}"`);
        continue;
      }

      // Reject low-confidence extractions
      if (entity.confidence < 30) {
        result.errors.push(`Skipped "${article.title}": low extraction confidence (${entity.confidence})`);
        continue;
      }

      result.extracted++;

      // Step 6: Fuzzy dedup against existing campaigns by normalized name
      const normalized = normalizeSubjectName(entity.name);
      const existingByNormalized = await db
        .select({ id: schema.campaigns.id, subjectName: schema.campaigns.subjectName })
        .from(schema.campaigns)
        .where(
          sql`LOWER(${schema.campaigns.subjectName}) LIKE ${'%' + normalized + '%'}`,
        )
        .limit(1);

      if (existingByNormalized.length > 0) continue;

      // Also check reverse: does any recent campaign's normalized name appear in this one?
      const isDuplicateOfRecent = recentCampaigns.some((c) => {
        const existingNorm = normalizeSubjectName(c.subjectName);
        return existingNorm.length > 2 && (
          normalized.includes(existingNorm) || existingNorm.includes(normalized)
        );
      });
      if (isDuplicateOfRecent) continue;

      // Step 5c: Cross-source duplicate detection
      // Check if a different source already covered the same entity
      // (e.g., same person from AP and Reuters)
      const _normalizedHometown = normalizeLocation(entity.hometown);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentNewsForEntity = await db
        .select({ id: schema.newsItems.id, title: schema.newsItems.title })
        .from(schema.newsItems)
        .where(
          and(
            eq(schema.newsItems.campaignCreated, true),
            gt(schema.newsItems.fetchedAt, sevenDaysAgo),
            ne(schema.newsItems.url, article.url),
          ),
        )
        .limit(50);

      // Check if any recently published news item covers the same person
      const isCrossSourceDup = recentNewsForEntity.some((n) => {
        const titleNorm = n.title.toLowerCase();
        // Check if the entity's normalized name appears in the title
        return normalized.length > 3 && titleNorm.includes(normalized);
      });
      if (isCrossSourceDup) {
        result.errors.push(`Skipped "${article.title}": cross-source duplicate for "${entity.name}"`);
        continue;
      }

      // Step 5d: Same-event dedup within this batch (location + category)
      // Prevents e.g. two articles about the same factory fire from creating two campaigns
      const entityLocationNorm = normalizeLocation(entity.hometown).toLowerCase();
      const isSameEventInBatch = batchLocationCategories.some(
        (lc) => lc.category === entity.category && lc.location === entityLocationNorm,
      );
      if (isSameEventInBatch) {
        result.errors.push(`Skipped "${article.title}": same location+category already in batch ("${entity.hometown}" / ${entity.category})`);
        continue;
      }

      // Also check against DB: same location + category in last 7 days
      const recentSameLocation = await db
        .select({ id: schema.campaigns.id })
        .from(schema.campaigns)
        .where(
          and(
            eq(schema.campaigns.category, entity.category as CampaignCategory),
            eq(schema.campaigns.source, 'automated'),
            gt(schema.campaigns.createdAt, sevenDaysAgo),
            sql`LOWER(${schema.campaigns.location}) = ${entityLocationNorm}`,
          ),
        )
        .limit(1);
      if (recentSameLocation.length > 0) {
        result.errors.push(`Skipped "${article.title}": campaign already exists for ${entity.hometown} / ${entity.category}`);
        continue;
      }

      // Rate limit: skip campaign creation if daily limit exceeded
      if (todayCount.count + campaignsCreatedThisRun >= dailyLimit) {
        result.errors.push(`Rate limited: daily campaign creation limit (${dailyLimit}) reached, skipping "${entity.name}"`);
        continue;
      }

      // Max concurrent simulated campaigns check
      if ((activeSim?.count ?? 0) + campaignsCreatedThisRun >= maxConcurrent) {
        result.errors.push(`Max concurrent simulated campaigns (${maxConcurrent}) reached, skipping "${entity.name}"`);
        continue;
      }

      // Step 7: Generate story with structural variation + headline concurrently
      const campaignPrompt = buildGenerateCampaignPrompt(entity, recentStoryPatterns);
      const { selectedPattern } = campaignPrompt;
      const headlineInput = {
        articleTitle: article.title,
        articleSummary: article.summary,
        subjectName: entity.name,
        event: entity.event,
        hometown: entity.hometown,
        category: entity.category,
        recentTitles,
      };

      const [storyResult, headlineResult] = await Promise.allSettled([
        generateStoryWithRetry(campaignPrompt, entity, selectedPattern),
        generateHeadlineWithRetry(headlineInput, article.title, recentTitles),
      ]);

      if (storyResult.status === 'rejected') {
        result.errors.push(`Story generation failed for "${entity.name}": ${String(storyResult.reason)}`);
        continue;
      }

      const storyHtml = storyResult.value;
      recentStoryPatterns.push(selectedPattern);
      if (recentStoryPatterns.length > 5) recentStoryPatterns.shift();
      const campaignTitle =
        headlineResult.status === 'fulfilled'
          ? headlineResult.value
          : buildFallbackTitle(entity.name, entity.hometown, entity.category);

      // Track newly generated title for intra-batch dedup
      recentTitles.push(campaignTitle);

      const goalAmountCents = entity.suggestedGoal * 100;
      const slug = generateSlug(entity.name);
      const impactTiers = getDefaultImpactTiers(entity.suggestedGoal);

      // Step 7b: Generate organizer identity
      const campaignOrganizer = await generateOrganizerIdentity({
        subjectName: entity.name,
        subjectHometown: entity.hometown,
        location: entity.hometown,
        category: entity.category,
      }, recentOrganizerNames);

      // Step 8: Insert campaign
      const heroImageUrl = await resolveHeroImage(article.imageUrl, entity.category);
      const [campaign] = await db
        .insert(schema.campaigns)
        .values({
          title: campaignTitle,
          slug,
          status: 'active',
          heroImageUrl,
          storyHtml,
          goalAmount: goalAmountCents,
          category: entity.category,
          location: entity.hometown,
          subjectName: entity.name,
          subjectHometown: entity.hometown,
          impactTiers,
          campaignProfile: generateTrajectoryProfile(entity.category as CampaignCategory, goalAmountCents),
          campaignOrganizer,
          source: 'automated',
          simulationFlag: true,
          simulationConfig: {
            paused: false,
            fundAllocation: (await getSetting('simulation.fund_allocation_default') as 'pool' | 'located_beneficiary') ?? 'pool',
          },
          publishedAt: new Date(),
        })
        .returning({ id: schema.campaigns.id });

      // Mark news_item as campaign_created
      await db
        .update(schema.newsItems)
        .set({ campaignCreated: true, campaignId: campaign.id })
        .where(eq(schema.newsItems.url, article.url));

      // Step 8b: Generate seed messages (30 for first_believers, with validation)
      const phase = getCampaignPhase(0, goalAmountCents);
      const familyStrings = (entity.family ?? []).map(
        (f) => `${f.relation} ${f.name}${f.age ? ` (${f.age})` : ''}`,
      );

      const messagesPrompt = buildGenerateMessagesPrompt({
        name: entity.name,
        age: entity.age,
        event: entity.event,
        unit: entity.unit,
        department: entity.department,
        hometown: entity.hometown,
        family: familyStrings,
        goal: entity.suggestedGoal,
        category: entity.category,
        phase,
        count: 30,
        campaignAgeDays: 0,
        donorCount: 0,
        percentage: 0,
      });

      const messages = await callAI<string[]>({
        systemPrompt: messagesPrompt.systemPrompt,
        userPrompt: messagesPrompt.userPrompt,
        maxTokens: 4096,
        promptType: 'generate-messages',
        campaignId: campaign.id,
      });

      if (Array.isArray(messages) && messages.length > 0) {
        const { valid } = validateMessages(messages, []);
        if (valid.length > 0) {
          await db.insert(schema.campaignSeedMessages).values(
            valid.map((msg) => ({
              campaignId: campaign.id,
              message: msg,
              phase,
              used: false,
            })),
          );
        }
      }

      result.published++;
      campaignsCreatedThisRun++;
      recentOrganizerNames.push(campaignOrganizer.name);
      batchLocationCategories.push({ location: entityLocationNorm, category: entity.category });

      // Audit log
      await db.insert(schema.auditLogs).values({
        eventType: 'campaign.auto_published',
        targetType: 'campaign',
        targetId: campaign.id,
        severity: 'info',
        details: {
          subjectName: entity.name,
          category: entity.category,
          sourceUrl: article.url,
          goalAmount: goalAmountCents,
          storyPattern: selectedPattern,
          messagesGenerated: Array.isArray(messages) ? validateMessages(messages, []).valid.length : 0,
        },
      });
    } catch (error) {
      result.errors.push(`Processing error for "${article.title}": ${String(error)}`);
    }
  }

  // ── Step 9: Retention cleanup ────────────────────────────────────────
  // Delete news_items older than 30 days that scored below threshold
  // and were never linked to a campaign. Preserves admin visibility of
  // recent items and all items that produced campaigns.
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(schema.newsItems)
      .where(
        and(
          eq(schema.newsItems.campaignCreated, false),
          lt(schema.newsItems.fetchedAt, thirtyDaysAgo),
          lt(schema.newsItems.relevanceScore, CLASSIFY_SCORE_THRESHOLD),
        ),
      )
      .returning({ id: schema.newsItems.id });

    result.retained = deleted.length;
  } catch (error) {
    result.errors.push(`Retention cleanup error: ${String(error)}`);
  }

  return result;
}

/**
 * Deduplicate articles against existing news_items using an indexed IN query.
 * Only fetches URLs that match the incoming batch - not the entire table.
 */
async function deduplicateArticles(
  articles: NormalizedNewsItem[],
): Promise<NormalizedNewsItem[]> {
  if (articles.length === 0) return [];

  const urls = articles.map((a) => a.url);

  // Query only the URLs from this batch - hits the unique index on url
  const existing = await db
    .select({ url: schema.newsItems.url })
    .from(schema.newsItems)
    .where(inArray(schema.newsItems.url, urls));

  const existingUrls = new Set(existing.map((e) => e.url));

  const seen = new Set<string>();
  const unique: NormalizedNewsItem[] = [];

  for (const article of articles) {
    if (existingUrls.has(article.url) || seen.has(article.url)) continue;
    seen.add(article.url);
    unique.push(article);
  }

  return unique;
}

const MILITARY_SOURCES = new Set([
  'DVIDS',
  'Defense.gov',
  'Stars and Stripes',
  'Military Times',
]);

/**
 * Balance fetched articles so military sources don't exceed 40%.
 */
function balanceSources(articles: NormalizedNewsItem[]): NormalizedNewsItem[] {
  if (articles.length === 0) return articles;

  const military: NormalizedNewsItem[] = [];
  const other: NormalizedNewsItem[] = [];

  for (const article of articles) {
    if (MILITARY_SOURCES.has(article.source) || article.category === 'military') {
      military.push(article);
    } else {
      other.push(article);
    }
  }

  const maxMilitary = Math.floor(articles.length * 0.4);
  if (military.length <= maxMilitary) return articles;

  const byDate = (a: NormalizedNewsItem, b: NormalizedNewsItem) =>
    (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);

  military.sort(byDate);
  other.sort(byDate);

  return [...military.slice(0, maxMilitary), ...other];
}

// Entity validation imported from @/lib/utils/entity-validation

// ── Story generation with validation retry ─────────────────────────────────

/**
 * Generate a campaign story with one retry on validation failure.
 * Cleans the output, validates structure and word count, retries if invalid.
 */
async function generateStoryWithRetry(
  prompt: { systemPrompt: string; userPrompt: string; selectedPattern: StoryPattern },
  entity: ExtractedEntity,
  pattern: StoryPattern,
): Promise<string> {
  const richness = scoreContextRichness(entity);
  const wordRange = getWordRange(richness);

  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = attempt === 0
      ? prompt.userPrompt
      : prompt.userPrompt + '\n\nIMPORTANT: Your previous story was rejected for structural issues. Follow the section structure EXACTLY. Use only HTML (no markdown). Stay within the word count range.';

    const raw = await callAI<string>({
      systemPrompt: prompt.systemPrompt,
      userPrompt,
      parseJson: false,
      promptType: 'generate-story',
    });

    const cleaned = cleanStoryHtml(raw);
    const result = validateStory(cleaned, pattern, wordRange);

    if (result.valid) return cleaned;
  }

  // Second attempt also had issues - accept the cleaned output anyway
  // (soft issues like word count are acceptable on retry)
  const fallbackRaw = await callAI<string>({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    parseJson: false,
    promptType: 'generate-story',
  });
  return cleanStoryHtml(fallbackRaw);
}

// ── Headline generation with retry ─────────────────────────────────────────

/**
 * Generate a headline with one retry on validation failure.
 * Returns the validated title or the deterministic fallback.
 */
export async function generateHeadlineWithRetry(
  input: Parameters<typeof buildGenerateHeadlinePrompt>[0],
  articleTitle: string,
  recentTitles: string[],
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildGenerateHeadlinePrompt(
      attempt === 0
        ? input
        : { ...input, articleSummary: input.articleSummary + '\n\nIMPORTANT: Your previous headline was rejected for violating rules. Write a COMPLETELY different headline using a different structural archetype.' },
    );

    const raw = await callAI<string>({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      parseJson: false,
      maxTokens: 128,
      promptType: 'generate-headline',
    });

    const result = validateHeadline(raw, articleTitle, recentTitles);
    if (!result.rejected) return result.title;
  }

  // Both attempts failed - use deterministic fallback
  return buildFallbackTitle(input.subjectName, input.hometown, input.category);
}
