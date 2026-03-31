import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { buildGenerateMessagesPrompt } from '@/lib/ai/prompts/generate-messages';
import { callAI } from '@/lib/ai/call-ai';
import { getCampaignPhase } from '@/lib/utils/phase';
import { validateMessages } from './message-validation';
import type { DonationPhase, Campaign } from '@/types';

/** Trigger refill when unused messages drop below this threshold */
const REFILL_THRESHOLD = 10;
/** Number of messages to generate on refill */
const REFILL_COUNT = 15;
/** Number of messages to generate at campaign creation */
const INITIAL_COUNT = 30;
/** Number of messages to generate at each phase transition */
const PHASE_TRANSITION_COUNT = 25;
/** Number of existing messages to sample for tonal continuity */
const CONTINUITY_SAMPLE_SIZE = 5;

/**
 * Get an unused message from the campaign's seed pool for a given phase.
 * If the pool is low, triggers a background refill.
 */
export async function pickSeedMessage(
  campaignId: string,
  phase: DonationPhase,
): Promise<string | null> {
  // Pick one unused message, preferring messages generated for the current phase
  const [message] = await db
    .select()
    .from(schema.campaignSeedMessages)
    .where(
      and(
        eq(schema.campaignSeedMessages.campaignId, campaignId),
        eq(schema.campaignSeedMessages.used, false),
      ),
    )
    .orderBy(
      // Prefer messages matching the current phase
      sql`CASE WHEN ${schema.campaignSeedMessages.phase} = ${phase} THEN 0 ELSE 1 END`,
      sql`RANDOM()`,
    )
    .limit(1);

  if (!message) return null;

  // Mark as used
  await db
    .update(schema.campaignSeedMessages)
    .set({ used: true })
    .where(eq(schema.campaignSeedMessages.id, message.id));

  // Check remaining pool size and refill if needed
  const [{ value: remaining }] = await db
    .select({ value: count() })
    .from(schema.campaignSeedMessages)
    .where(
      and(
        eq(schema.campaignSeedMessages.campaignId, campaignId),
        eq(schema.campaignSeedMessages.used, false),
      ),
    );

  if (remaining < REFILL_THRESHOLD) {
    // Fire-and-forget refill (don't await to avoid slowing donation)
    refillMessagePool(campaignId).catch((err) =>
      console.error(`Message pool refill error for campaign ${campaignId}:`, err),
    );
  }

  return message.message;
}

/**
 * Fetch campaign context needed for context-aware message generation.
 */
async function getCampaignContext(campaign: Campaign) {
  const publishedAt = campaign.publishedAt ?? campaign.createdAt;
  const ageDays = Math.floor(
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const percentage = campaign.goalAmount > 0
    ? Math.floor((campaign.raisedAmount / campaign.goalAmount) * 100)
    : 0;

  // Sample existing messages for tonal continuity
  const existingSamples = await db
    .select({ message: schema.campaignSeedMessages.message })
    .from(schema.campaignSeedMessages)
    .where(
      and(
        eq(schema.campaignSeedMessages.campaignId, campaign.id),
        eq(schema.campaignSeedMessages.used, true),
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(CONTINUITY_SAMPLE_SIZE);

  // Get all existing messages (used + unused) for similarity dedup
  const allExisting = await db
    .select({ message: schema.campaignSeedMessages.message })
    .from(schema.campaignSeedMessages)
    .where(eq(schema.campaignSeedMessages.campaignId, campaign.id));

  return {
    ageDays,
    percentage,
    donorCount: campaign.donorCount,
    existingSamples: existingSamples.map((r) => r.message),
    allExistingMessages: allExisting.map((r) => r.message),
  };
}

/**
 * Generate more seed messages for a campaign and insert them (context-aware refill).
 */
export async function refillMessagePool(campaignId: string): Promise<number> {
  // Get campaign data to build context
  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return 0;

  const phase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);
  const ctx = await getCampaignContext(campaign);

  const prompt = buildGenerateMessagesPrompt({
    name: campaign.subjectName,
    event: campaign.title,
    hometown: campaign.subjectHometown ?? campaign.location ?? 'Unknown',
    family: [],
    goal: campaign.goalAmount / 100,
    category: campaign.category,
    phase,
    count: REFILL_COUNT,
    campaignAgeDays: ctx.ageDays,
    donorCount: ctx.donorCount,
    percentage: ctx.percentage,
    existingMessages: ctx.existingSamples,
  });

  const messages = await callAI<string[]>({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    maxTokens: 2048,
    promptType: 'generate-messages',
    campaignId,
  });

  if (!Array.isArray(messages) || messages.length === 0) return 0;

  // Validate messages
  const { valid } = validateMessages(messages, ctx.allExistingMessages);

  if (valid.length === 0) return 0;

  const values = valid.map((msg) => ({
    campaignId,
    message: msg,
    phase,
    used: false,
  }));

  await db.insert(schema.campaignSeedMessages).values(values);

  return values.length;
}

/**
 * Generate a batch of messages for a specific phase transition.
 * Called when a campaign enters a new phase to pre-fill messages
 * with the appropriate tone and context.
 */
export async function generatePhaseTransitionMessages(
  campaign: Campaign,
  newPhase: DonationPhase,
): Promise<number> {
  const ctx = await getCampaignContext(campaign);

  const prompt = buildGenerateMessagesPrompt({
    name: campaign.subjectName,
    event: campaign.title,
    hometown: campaign.subjectHometown ?? campaign.location ?? 'Unknown',
    family: [],
    goal: campaign.goalAmount / 100,
    category: campaign.category,
    phase: newPhase,
    count: PHASE_TRANSITION_COUNT,
    campaignAgeDays: ctx.ageDays,
    donorCount: ctx.donorCount,
    percentage: ctx.percentage,
    existingMessages: ctx.existingSamples,
  });

  const messages = await callAI<string[]>({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    maxTokens: 4096,
    promptType: 'generate-messages',
    campaignId: campaign.id,
  });

  if (!Array.isArray(messages) || messages.length === 0) return 0;

  // Validate messages
  const { valid } = validateMessages(messages, ctx.allExistingMessages);

  if (valid.length === 0) return 0;

  const values = valid.map((msg) => ({
    campaignId: campaign.id,
    message: msg,
    phase: newPhase,
    used: false,
  }));

  await db.insert(schema.campaignSeedMessages).values(values);

  return values.length;
}

/**
 * Generate the initial batch of seed messages for a newly published campaign.
 * Now generates only 30 messages for `first_believers` (not 100).
 */
export async function generateInitialMessages(
  campaign: Campaign,
  entityData?: {
    name: string;
    age?: number;
    event: string;
    unit?: string;
    department?: string;
    hometown: string;
    family: string[];
  },
): Promise<number> {
  const phase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);

  const prompt = buildGenerateMessagesPrompt({
    name: entityData?.name ?? campaign.subjectName,
    age: entityData?.age,
    event: entityData?.event ?? campaign.title,
    unit: entityData?.unit,
    department: entityData?.department,
    hometown: entityData?.hometown ?? campaign.subjectHometown ?? campaign.location ?? 'Unknown',
    family: entityData?.family ?? [],
    goal: campaign.goalAmount / 100,
    category: campaign.category,
    phase,
    count: INITIAL_COUNT,
    campaignAgeDays: 0,
    donorCount: 0,
    percentage: 0,
  });

  const messages = await callAI<string[]>({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    maxTokens: 4096,
    promptType: 'generate-messages',
    campaignId: campaign.id,
  });

  if (!Array.isArray(messages) || messages.length === 0) return 0;

  // Validate messages (no existing messages for a new campaign)
  const { valid } = validateMessages(messages, []);

  if (valid.length === 0) return 0;

  const values = valid.map((msg) => ({
    campaignId: campaign.id,
    message: msg,
    phase,
    used: false,
  }));

  await db.insert(schema.campaignSeedMessages).values(values);

  return values.length;
}
