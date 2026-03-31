import { db } from '@/db';
import { newsItems, campaigns, auditLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  buildExtractEntitiesPrompt,
  type ExtractedEntity,
} from '@/lib/ai/prompts/extract-entities';
import {
  buildGenerateCampaignPrompt,
  getDefaultImpactTiers,
} from '@/lib/ai/prompts/generate-campaign';
import { buildGenerateMessagesPrompt } from '@/lib/ai/prompts/generate-messages';
import { buildFallbackTitle } from '@/lib/ai/prompts/generate-headline';
import { callAI } from '@/lib/ai/call-ai';
import { generateSlug } from '@/lib/utils/slug';
import { getCampaignPhase } from '@/lib/utils/phase';
import { isValidEntityName, normalizeSubjectName } from '@/lib/utils/entity-validation';
import { generateHeadlineWithRetry } from '@/lib/news/news-pipeline';
import { fetchArticleBody } from '@/lib/news/fetch-article-body';
import { validateMessages } from '@/lib/seed/message-validation';
import * as schema from '@/db/schema';
import { generateTrajectoryProfile } from '@/lib/seed/trajectory-profiles';
import { generateOrganizerIdentity } from '@/lib/seed/organizer-generator';
import { cleanStoryHtml, validateStory } from '@/lib/ai/prompts/story-validation';
import { resolveHeroImage } from '@/lib/news/image-validation';
import { getWordRange, scoreContextRichness } from '@/lib/ai/prompts/story-structures';
import type { StoryPattern } from '@/lib/ai/prompts/story-structures';
import type { CampaignCategory } from '@/types';

export type PublishResult = {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
};

export type PublishError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'ALREADY_CREATED'; message: string; campaignId: string }
  | { code: 'NO_CATEGORY'; message: string }
  | { code: 'INVALID_ENTITY'; message: string }
  | { code: 'DUPLICATE_SUBJECT'; message: string; campaignId: string }
  | { code: 'STORY_FAILED'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string };

export type PublishOutcome =
  | { ok: true; data: PublishResult }
  | { ok: false; error: PublishError };

/**
 * Publish a single news item as a fully-formed campaign.
 *
 * This is the shared core used by both:
 * - The `publish-campaigns` cron (batch mode)
 * - The admin "Create" button (single-item on-demand)
 *
 * Steps:
 * 1. Validate news item exists and hasn't already created a campaign
 * 2. Resolve effective category (adminOverrideCategory takes precedence)
 * 3. Check slug-based dedup
 * 4. Fetch full article body (if not already cached)
 * 5. Extract entities via AI
 * 6. Validate entity name (reject garbage)
 * 7. Check subject-name dedup (exact + fuzzy)
 * 8. Generate story + headline concurrently
 * 9. Generate organizer identity
 * 10. Resolve hero image
 * 11. Insert campaign (source='automated', simulationFlag=true, active)
 * 12. Mark news item as processed
 * 13. Generate 30 seed messages (first_believers phase)
 * 14. Insert audit log
 */
export async function publishCampaignFromNewsItem(
  newsItemId: string,
  options: {
    /** Story patterns used recently — for anti-repetition in batch mode */
    recentStoryPatterns?: StoryPattern[];
    /** Recent campaign titles — for headline dedup */
    recentTitles?: string[];
    /** Audit event type override (to distinguish cron vs. admin trigger) */
    auditEventType?: string;
  } = {},
): Promise<PublishOutcome> {
  const recentStoryPatterns = options.recentStoryPatterns ?? [];
  const auditEventType = options.auditEventType ?? 'campaign.auto_published';

  // ── Step 1: Fetch & validate news item ────────────────────────────────

  const [item] = await db
    .select()
    .from(newsItems)
    .where(eq(newsItems.id, newsItemId))
    .limit(1);

  if (!item) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'News item not found' } };
  }

  if (item.campaignCreated) {
    return {
      ok: false,
      error: {
        code: 'ALREADY_CREATED',
        message: 'Campaign already created from this news item',
        campaignId: item.campaignId ?? '',
      },
    };
  }

  // ── Step 2: Resolve effective category ────────────────────────────────

  const effectiveCategory = (item.adminOverrideCategory ?? item.category) as CampaignCategory | null;

  if (!effectiveCategory) {
    return {
      ok: false,
      error: {
        code: 'NO_CATEGORY',
        message: 'News item has no category. Classify it first or set an admin override category.',
      },
    };
  }

  // ── Step 3: Slug-based dedup ──────────────────────────────────────────

  const slug = generateSlug(item.title);
  const existingBySlug = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, slug))
    .limit(1);

  if (existingBySlug.length > 0) {
    await db
      .update(newsItems)
      .set({ campaignCreated: true, campaignId: existingBySlug[0].id })
      .where(eq(newsItems.id, item.id));
    return {
      ok: false,
      error: {
        code: 'DUPLICATE_SUBJECT',
        message: 'A campaign with a matching slug already exists',
        campaignId: existingBySlug[0].id,
      },
    };
  }

  // ── Step 4: Fetch article body ────────────────────────────────────────

  const articleBody = item.articleBody
    ?? await fetchArticleBody(item.url, item.summary ?? item.title);

  // ── Step 5: Extract entities ──────────────────────────────────────────

  const entityPrompt = buildExtractEntitiesPrompt({
    title: item.title,
    body: articleBody,
    category: effectiveCategory,
  });

  const entity = await callAI<ExtractedEntity>({
    systemPrompt: entityPrompt.systemPrompt,
    userPrompt: entityPrompt.userPrompt,
    promptType: 'extract-entities',
  });

  entity.sourceUrl = entity.sourceUrl || item.url;
  entity.sourceName = entity.sourceName || item.source;
  entity.name = entity.name || '';
  entity.hometown = entity.hometown || 'Unknown';
  entity.category = entity.category || effectiveCategory;

  // ── Step 6: Validate entity name ──────────────────────────────────────

  if (!isValidEntityName(entity.name, item.title)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENTITY',
        message: `Extracted entity name "${entity.name}" is invalid (headline fragment, too long, or garbage)`,
      },
    };
  }

  // ── Step 7: Subject-name dedup ────────────────────────────────────────

  const normalized = normalizeSubjectName(entity.name);

  const existingSubject = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.subjectName, entity.name))
    .limit(1);

  if (existingSubject.length > 0) {
    await db
      .update(newsItems)
      .set({ campaignCreated: true, campaignId: existingSubject[0].id })
      .where(eq(newsItems.id, item.id));
    return {
      ok: false,
      error: {
        code: 'DUPLICATE_SUBJECT',
        message: `A campaign for "${entity.name}" already exists`,
        campaignId: existingSubject[0].id,
      },
    };
  }

  // Fuzzy dedup against recent campaigns
  const recentCampaigns = await db
    .select({ title: campaigns.title, subjectName: campaigns.subjectName })
    .from(campaigns)
    .orderBy(desc(campaigns.publishedAt))
    .limit(15);

  const isDuplicateOfRecent = recentCampaigns.some((c) => {
    const existingNorm = normalizeSubjectName(c.subjectName ?? '');
    return (
      existingNorm.length > 2 &&
      (normalized.includes(existingNorm) || existingNorm.includes(normalized))
    );
  });

  if (isDuplicateOfRecent) {
    return {
      ok: false,
      error: {
        code: 'DUPLICATE_SUBJECT',
        message: `A campaign with a similar subject name already exists (fuzzy match for "${entity.name}")`,
        campaignId: '',
      },
    };
  }

  // ── Step 8: Generate story + headline concurrently ────────────────────

  // Build recent titles list for headline dedup
  const recentTitles = options.recentTitles ?? recentCampaigns.map((c) => c.title);

  const campaignPrompt = buildGenerateCampaignPrompt(entity, recentStoryPatterns);
  const { selectedPattern } = campaignPrompt;

  const headlineInput = {
    articleTitle: item.title,
    articleSummary: item.summary ?? item.title,
    subjectName: entity.name,
    event: entity.event,
    hometown: entity.hometown,
    category: entity.category,
    recentTitles,
  };

  const richness = scoreContextRichness(entity);
  const wordRange = getWordRange(richness);

  const [storyResult, headlineResult] = await Promise.allSettled([
    generateStoryWithValidation(campaignPrompt, selectedPattern, wordRange),
    generateHeadlineWithRetry(headlineInput, item.title, recentTitles),
  ]);

  if (storyResult.status === 'rejected') {
    return {
      ok: false,
      error: {
        code: 'STORY_FAILED',
        message: `Story generation failed: ${String(storyResult.reason)}`,
      },
    };
  }

  const storyHtml = storyResult.value;

  // Mutate the caller's array so batch mode can track across items
  recentStoryPatterns.push(selectedPattern);
  if (recentStoryPatterns.length > 5) recentStoryPatterns.shift();

  const campaignTitle =
    headlineResult.status === 'fulfilled'
      ? headlineResult.value
      : buildFallbackTitle(entity.name, entity.hometown, entity.category);

  // Track title for intra-batch dedup
  if (options.recentTitles) options.recentTitles.push(campaignTitle);

  const goalAmountCents = entity.suggestedGoal * 100;
  const campaignSlug = generateSlug(entity.name);

  // ── Step 9: Generate organizer identity ───────────────────────────────

  const campaignOrganizer = await generateOrganizerIdentity({
    subjectName: entity.name,
    subjectHometown: entity.hometown,
    location: entity.hometown,
    category: entity.category,
  });

  // ── Step 10: Resolve hero image ───────────────────────────────────────

  const heroImageUrl = await resolveHeroImage(item.imageUrl ?? undefined, entity.category);

  // ── Step 11: Insert campaign ──────────────────────────────────────────

  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: campaignTitle,
      slug: campaignSlug,
      status: 'active',
      heroImageUrl,
      storyHtml,
      goalAmount: goalAmountCents,
      category: entity.category,
      location: entity.hometown,
      subjectName: entity.name,
      subjectHometown: entity.hometown,
      impactTiers: getDefaultImpactTiers(entity.suggestedGoal),
      campaignProfile: generateTrajectoryProfile(
        entity.category as CampaignCategory,
        goalAmountCents,
      ),
      campaignOrganizer,
      source: 'automated',
      simulationFlag: true,
      simulationConfig: { paused: false, fundAllocation: 'pool' },
      publishedAt: new Date(),
    })
    .returning({ id: campaigns.id });

  // ── Step 12: Mark news item as processed ──────────────────────────────

  await db
    .update(newsItems)
    .set({ campaignCreated: true, campaignId: campaign.id })
    .where(eq(newsItems.id, item.id));

  // ── Step 13: Generate seed messages ───────────────────────────────────

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

  let messagesGenerated = 0;
  try {
    const messages = await callAI<string[]>({
      systemPrompt: messagesPrompt.systemPrompt,
      userPrompt: messagesPrompt.userPrompt,
      maxTokens: 4096,
      promptType: 'generate-messages',
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
        messagesGenerated = valid.length;
      }
    }
  } catch {
    // Seed message generation is non-critical — the campaign is already created.
    // The simulation-engine will still function; it just won't have pre-generated messages.
  }

  // ── Step 14: Audit log ────────────────────────────────────────────────

  await db.insert(auditLogs).values({
    eventType: auditEventType,
    targetType: 'campaign',
    targetId: campaign.id,
    severity: 'info',
    details: {
      subjectName: entity.name,
      category: entity.category,
      sourceUrl: item.url,
      goalAmount: goalAmountCents,
      storyPattern: selectedPattern,
      messagesGenerated,
    },
  });

  return {
    ok: true,
    data: {
      campaignId: campaign.id,
      campaignSlug: campaignSlug,
      campaignTitle,
    },
  };
}

// ── Story generation with validation ────────────────────────────────────────

async function generateStoryWithValidation(
  prompt: { systemPrompt: string; userPrompt: string; selectedPattern: StoryPattern },
  pattern: StoryPattern,
  wordRange: { min: number; max: number },
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt =
      attempt === 0
        ? prompt.userPrompt
        : prompt.userPrompt +
          '\n\nIMPORTANT: Your previous story was rejected for structural issues. Follow the section structure EXACTLY. Use only HTML (no markdown). Stay within the word count range.';

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

  // Accept cleaned output on final fallback
  const fallbackRaw = await callAI<string>({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    parseJson: false,
    promptType: 'generate-story',
  });
  return cleanStoryHtml(fallbackRaw);
}
