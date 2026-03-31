import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { seedAmountCents } from './amount-generator';
import { selectSimulatedDonor, maybeBuildCohort, type SelectedDonor } from './donor-selector';
import { pickSeedMessage, generatePhaseTransitionMessages } from './message-generator';
import { getCampaignPhase } from '@/lib/utils/phase';
import { buildGenerateUpdatePrompt, buildPhaseTransitionTitle } from '@/lib/ai/prompts/generate-update';
import { buildGenerateImpactPrompt } from '@/lib/ai/prompts/generate-impact';
import { callAI } from '@/lib/ai/call-ai';
import { getActiveSurgeMultiplier } from './trajectory-profiles';
import type { Campaign, DonationPhase, TrajectoryProfile, CampaignOrganizer, CampaignCategory, SimulationConfig } from '@/types';
import crypto from 'crypto';

export type SimulationResult = {
  campaignsProcessed: number;
  donationsCreated: number;
  phaseTransitions: number;
  completions: number;
  errors: string[];
};

/** 15-minute cron window in milliseconds. */
const CYCLE_WINDOW_MS = 15 * 60 * 1000;

/** Maximum overfunding: 150% of the goal amount. */
export const OVERFUND_CAP_PERCENT = 1.50;

/** Overfunding window after goal is met: 48 hours in milliseconds. */
export const OVERFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

// Time-of-day activity multipliers (ET, hour index 0-23)
const HOURLY_ACTIVITY: number[] = [
  0.10, 0.10, 0.10, 0.10, 0.10, 0.10, // 12am-5am
  0.40, 0.40, 0.40,                     // 6am-8am
  0.70, 0.70, 0.70,                     // 9am-11am
  0.60, 0.60,                           // 12pm-1pm
  0.80, 0.80, 0.80,                     // 2pm-4pm
  1.00, 1.00, 1.00,                     // 5pm-7pm
  0.90, 0.90,                           // 8pm-9pm
  0.30, 0.30,                           // 10pm-11pm
];

function getHourlyMultiplier(): number {
  const now = new Date();
  const etOffset = -5;
  const utcHour = now.getUTCHours();
  const etHour = (utcHour + etOffset + 24) % 24;
  const hourlyMultiplier = HOURLY_ACTIVITY[etHour] ?? 0.5;

  // Weekend bonus (120% of weekday)
  const day = now.getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const weekendMultiplier = isWeekend ? 1.2 : 1.0;

  return hourlyMultiplier * weekendMultiplier;
}

/**
 * Determine whether this campaign should receive donations this cycle.
 *
 * Profile-driven: `profile.baseDonateChance × phaseMultiplier × hourlyMultiplier × surgeMultiplier`.
 * Falls back to legacy flat-probability if no profile exists (pre-Milestone-1 campaigns).
 */
function shouldDonateThisCycle(
  campaign: Campaign,
  profile: TrajectoryProfile | null,
  currentPhase: DonationPhase,
  surgeMultiplier: number,
  volumeMultiplier: number,
): boolean {
  const hourly = getHourlyMultiplier();

  if (!profile) {
    // Legacy path for campaigns created before profile assignment
    const percent = campaign.goalAmount > 0
      ? (campaign.raisedAmount / campaign.goalAmount) * 100
      : 0;
    const ageMs = Date.now() - new Date(campaign.publishedAt ?? campaign.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    let baseChance: number;
    if (ageDays <= 3) baseChance = 0.60;
    else if (percent > 75) baseChance = 0.80;
    else baseChance = 0.40;
    return Math.random() < baseChance * hourly * volumeMultiplier;
  }

  const phaseMultiplier = profile.phaseMultipliers[currentPhase] ?? 1.0;
  const effectiveChance = profile.baseDonateChance * phaseMultiplier * hourly * surgeMultiplier * volumeMultiplier;

  return Math.random() < Math.min(effectiveChance, 1.0);
}

/**
 * How many donations to create this cycle.
 *
 * Profile-driven: uniform random in [min, max] from profile.donationsPerCycle.
 * Falls back to legacy 1-3 distribution if no profile exists.
 */
function donationCountThisCycle(profile: TrajectoryProfile | null, surgeMultiplier: number): number {
  if (!profile) {
    const rand = Math.random();
    if (rand < 0.6) return 1;
    if (rand < 0.9) return 2;
    return 3;
  }

  const { min, max } = profile.donationsPerCycle;
  const base = min + Math.floor(Math.random() * (max - min + 1));

  // During surges, multiply the count (rounded up, minimum 1 extra)
  if (surgeMultiplier > 1) {
    return Math.max(base, Math.ceil(base * surgeMultiplier));
  }

  return base;
}

/**
 * Generate a jittered timestamp spread across the 15-minute cron window.
 * Prevents all donations from a cycle sharing the exact same createdAt.
 */
function jitteredTimestamp(cycleStart: Date): Date {
  const offsetMs = Math.floor(Math.random() * CYCLE_WINDOW_MS);
  return new Date(cycleStart.getTime() + offsetMs);
}

/**
 * Calculate campaign age in 15-min cycles since publish.
 */
function campaignAgeCycles(campaign: Campaign): number {
  const publishedAt = campaign.publishedAt ?? campaign.createdAt;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  return Math.floor(ageMs / CYCLE_WINDOW_MS);
}

/**
 * Check whether a campaign can still accept donations.
 *
 * - Pre-goal: always yes (status is 'active' or 'last_donor_zone')
 * - Post-goal: yes if within the 48-hour overfunding window AND under 150% cap
 */
/** @internal Exported for testing. */
export function canAcceptDonation(campaign: Campaign): boolean {
  if (campaign.raisedAmount < campaign.goalAmount) return true;

  // Post-goal overfunding checks
  const completedAt = campaign.completedAt ? new Date(campaign.completedAt) : null;
  if (!completedAt) {
    // Goal just crossed this cycle but handleCompletion hasn't run yet — allow
    return campaign.raisedAmount < campaign.goalAmount * OVERFUND_CAP_PERCENT;
  }

  const elapsed = Date.now() - completedAt.getTime();
  if (elapsed > OVERFUND_WINDOW_MS) return false;

  return campaign.raisedAmount < campaign.goalAmount * OVERFUND_CAP_PERCENT;
}

// ── Realistic seed-data generators ──────────────────────────────

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** @internal Exported for testing. Generate a Stripe-like payment intent ID (pi_ + 24 alphanumeric chars). */
export function generateRealisticPaymentId(): string {
  const bytes = crypto.randomBytes(24);
  let id = 'pi_';
  for (let i = 0; i < 24; i++) {
    id += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
  }
  return id;
}

export const EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
];

/** @internal Exported for testing. Generate a realistic-looking email from a donor display name. */
export function generateRealisticEmail(donorName: string): string {
  const slug = donorName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12) || 'donor';
  const suffix = crypto.randomBytes(3).toString('hex');
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
  return `${slug}${suffix}@${domain}`;
}

/**
 * Run simulation for active simulated campaigns.
 *
 * @param volumeMultiplier Global volume multiplier from settings (0.0–1.0).
 */
export async function runSimulation(volumeMultiplier = 1.0): Promise<SimulationResult> {
  const cycleStart = new Date();

  const result: SimulationResult = {
    campaignsProcessed: 0,
    donationsCreated: 0,
    phaseTransitions: 0,
    completions: 0,
    errors: [],
  };

  // Query only simulated active/LDZ campaigns
  const activeCampaigns = await db
    .select()
    .from(schema.campaigns)
    .where(
      and(
        inArray(schema.campaigns.status, ['active', 'last_donor_zone']),
        eq(schema.campaigns.simulationFlag, true),
      ),
    );

  // Track which surges have already been triggered (per-campaign, per-run)
  const triggeredSurges = new Map<string, Set<number>>();

  for (const campaign of activeCampaigns) {
    try {
      // Per-campaign pause check
      const simConfig = campaign.simulationConfig as SimulationConfig | null;
      if (simConfig?.paused) continue;

      result.campaignsProcessed++;

      // Per-campaign volume override takes precedence over global multiplier
      const effectiveVolume = simConfig?.volumeOverride ?? volumeMultiplier;

      const profile = (campaign.campaignProfile as TrajectoryProfile) ?? null;
      const currentPercent = campaign.goalAmount > 0
        ? (campaign.raisedAmount / campaign.goalAmount) * 100
        : 0;
      const ageCycles = campaignAgeCycles(campaign);

      // Initialize triggered surges for this campaign
      if (!triggeredSurges.has(campaign.id)) {
        triggeredSurges.set(campaign.id, new Set());
      }
      const triggered = triggeredSurges.get(campaign.id)!;

      // Compute surge multiplier
      const surgeMultiplier = profile
        ? getActiveSurgeMultiplier(profile, currentPercent, ageCycles, triggered)
        : 1.0;

      const currentPhase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);

      if (!shouldDonateThisCycle(campaign, profile, currentPhase, surgeMultiplier, effectiveVolume)) continue;

      const count = donationCountThisCycle(profile, surgeMultiplier);
      const previousPhase = currentPhase;
      const amountTier = profile?.amountTier ?? 'mid';

      // Track whether this campaign just crossed its goal during this cycle
      const wasAlreadyFunded = campaign.raisedAmount >= campaign.goalAmount;
      let goalCrossingDonorName: string | null = null;
      let goalCrossingDonorAmount: number | null = null;

      for (let i = 0; i < count; i++) {
        // Stop if overfunding cap reached or overfunding window expired
        if (!canAcceptDonation(campaign)) break;

        const amountCents = seedAmountCents(amountTier);
        let donor = await selectSimulatedDonor(campaign);

        // If this donation will cross the goal, ensure the last donor is NOT anonymous
        const willCrossGoal = !wasAlreadyFunded
          && campaign.raisedAmount < campaign.goalAmount
          && campaign.raisedAmount + amountCents >= campaign.goalAmount;

        if (willCrossGoal && donor.isAnonymous) {
          // Re-roll up to 5 times to get a named donor for the last-donor moment
          for (let attempt = 0; attempt < 5; attempt++) {
            donor = await selectSimulatedDonor(campaign);
            if (!donor.isAnonymous) break;
          }
          // If still anonymous after 5 attempts, force non-anonymous
          if (donor.isAnonymous) {
            donor = { ...donor, isAnonymous: false };
          }
        }

        const phase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);
        const message = await pickSeedMessage(campaign.id, phase);
        const donationTime = jitteredTimestamp(cycleStart);

        // Insert donation with jittered timestamp
        const [donationRecord] = await db.insert(schema.donations).values({
          campaignId: campaign.id,
          stripePaymentId: generateRealisticPaymentId(),
          amount: amountCents,
          donorName: donor.displayName,
          donorEmail: generateRealisticEmail(donor.displayName),
          donorLocation: donor.displayLocation || null,
          message: message ?? undefined,
          isAnonymous: donor.isAnonymous,
          phaseAtTime: phase,
          source: 'seed',
          createdAt: donationTime,
        }).returning({ id: schema.donations.id });

        // Mirror message to campaign_messages wall
        if (message) {
          await db.insert(schema.campaignMessages).values({
            campaignId: campaign.id,
            donorName: donor.isAnonymous ? 'Anonymous' : donor.displayName,
            donorLocation: donor.isAnonymous ? null : (donor.displayLocation || null),
            message,
            isAnonymous: donor.isAnonymous,
            donationId: donationRecord.id,
            createdAt: donationTime,
          });
        }

        // Atomically update campaign totals
        await db
          .update(schema.campaigns)
          .set({
            raisedAmount: sql`${schema.campaigns.raisedAmount} + ${amountCents}`,
            donorCount: sql`${schema.campaigns.donorCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.campaigns.id, campaign.id));

        // Update local reference for subsequent iterations
        campaign.raisedAmount += amountCents;
        campaign.donorCount += 1;

        result.donationsCreated++;

        // Record the goal-crossing donor
        if (willCrossGoal) {
          goalCrossingDonorName = donor.displayName;
          goalCrossingDonorAmount = amountCents;
        }
      }

      // ── Cohort injection ──
      // Occasionally inject a group of donors that form a visible pattern
      const cohort = maybeBuildCohort(campaign);
      if (cohort && canAcceptDonation(campaign)) {
        // For workplace_match, all donors donate the same amount
        const sharedWorkplaceAmount = cohort.type === 'workplace_match'
          ? seedAmountCents(amountTier)
          : 0;

        for (let ci = 0; ci < cohort.donors.length; ci++) {
          if (!canAcceptDonation(campaign)) break;

          const cohortAmount = cohort.type === 'workplace_match'
            ? sharedWorkplaceAmount
            : seedAmountCents(amountTier);

          let cohortDonor = cohort.donors[ci];

          // Check if this cohort donation crosses the goal
          const willCrossGoal = !wasAlreadyFunded
            && goalCrossingDonorName === null
            && campaign.raisedAmount < campaign.goalAmount
            && campaign.raisedAmount + cohortAmount >= campaign.goalAmount;

          // Ensure last donor is not anonymous
          if (willCrossGoal && cohortDonor.isAnonymous) {
            cohortDonor = { ...cohortDonor, isAnonymous: false };
          }

          const cohortPhase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);
          const cohortMessage = await pickSeedMessage(campaign.id, cohortPhase);

          // For family chains, stagger timestamps; otherwise cluster within 2hrs
          let cohortTime: Date;
          if (cohort.type === 'family_chain' && cohort.staggerMs) {
            cohortTime = new Date(cycleStart.getTime() + ci * cohort.staggerMs);
          } else {
            // Community/workplace: cluster within 2 hours
            const clusterOffsetMs = Math.floor(Math.random() * 2 * 60 * 60 * 1000);
            cohortTime = new Date(cycleStart.getTime() + clusterOffsetMs);
          }

          const [cohortDonationRecord] = await db.insert(schema.donations).values({
            campaignId: campaign.id,
            stripePaymentId: generateRealisticPaymentId(),
            amount: cohortAmount,
            donorName: cohortDonor.displayName,
            donorEmail: generateRealisticEmail(cohortDonor.displayName),
            donorLocation: cohortDonor.displayLocation || null,
            message: cohortMessage ?? undefined,
            isAnonymous: cohortDonor.isAnonymous,
            phaseAtTime: cohortPhase,
            source: 'seed',
            createdAt: cohortTime,
          }).returning({ id: schema.donations.id });

          // Mirror cohort message to campaign_messages wall
          if (cohortMessage) {
            await db.insert(schema.campaignMessages).values({
              campaignId: campaign.id,
              donorName: cohortDonor.isAnonymous ? 'Anonymous' : cohortDonor.displayName,
              donorLocation: cohortDonor.isAnonymous ? null : (cohortDonor.displayLocation || null),
              message: cohortMessage,
              isAnonymous: cohortDonor.isAnonymous,
              donationId: cohortDonationRecord.id,
              createdAt: cohortTime,
            });
          }

          await db
            .update(schema.campaigns)
            .set({
              raisedAmount: sql`${schema.campaigns.raisedAmount} + ${cohortAmount}`,
              donorCount: sql`${schema.campaigns.donorCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(schema.campaigns.id, campaign.id));

          campaign.raisedAmount += cohortAmount;
          campaign.donorCount += 1;
          result.donationsCreated++;

          // Record the goal-crossing donor
          if (willCrossGoal) {
            goalCrossingDonorName = cohortDonor.displayName;
            goalCrossingDonorAmount = cohortAmount;
          }
        }
      }

      // Check phase transition
      const newPhase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);
      if (newPhase !== previousPhase) {
        result.phaseTransitions++;
        await handlePhaseTransition(campaign, newPhase);
      }

      // Check completion — only trigger once when we first cross the goal this cycle
      if (!wasAlreadyFunded && campaign.raisedAmount >= campaign.goalAmount) {
        await handleCompletion(campaign, goalCrossingDonorName, goalCrossingDonorAmount);
        result.completions++;
      }

    } catch (error) {
      result.errors.push(`Simulation error for campaign ${campaign.id}: ${String(error)}`);
    }
  }

  return result;
}

/**
 * Handle phase transition: update campaign status, generate update post,
 * and pre-fill messages for the new phase.
 */
async function handlePhaseTransition(campaign: Campaign, newPhase: DonationPhase): Promise<void> {
  // Update status if entering last_donor_zone
  if (newPhase === 'last_donor_zone') {
    await db
      .update(schema.campaigns)
      .set({ status: 'last_donor_zone' })
      .where(eq(schema.campaigns.id, campaign.id));
  }

  // Generate phase-transition seed messages for the new phase (fire-and-forget)
  generatePhaseTransitionMessages(campaign, newPhase).catch((err) =>
    console.error(`Phase transition message generation failed for ${campaign.id}:`, err),
  );

  // Gather context for enriched update prompt
  const percentage = Math.floor((campaign.raisedAmount / campaign.goalAmount) * 100);
  const publishedAt = campaign.publishedAt ?? campaign.createdAt;
  const campaignAgeDays = Math.floor(
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const organizer = campaign.campaignOrganizer as CampaignOrganizer | null;

  // Fetch previous updates for context continuity
  const previousUpdates = await db
    .select({ title: schema.campaignUpdates.title })
    .from(schema.campaignUpdates)
    .where(eq(schema.campaignUpdates.campaignId, campaign.id))
    .orderBy(desc(schema.campaignUpdates.createdAt))
    .limit(3);

  // Get story summary (strip HTML, first 200 chars)
  const storySummary = campaign.storyHtml
    .replace(/<[^>]+>/g, '')
    .slice(0, 200)
    .trim();

  const prompt = buildGenerateUpdatePrompt({
    subjectName: campaign.subjectName,
    phase: newPhase,
    percentage,
    raisedAmount: campaign.raisedAmount,
    goalAmount: campaign.goalAmount,
    campaignAgeDays,
    donorCount: campaign.donorCount,
    storySummary,
    previousUpdates: previousUpdates.map((u) => u.title),
    organizer: organizer ?? undefined,
  });

  try {
    const updateText = await callAI<string>({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      parseJson: false,
      promptType: 'generate-update',
      campaignId: campaign.id,
    });

    const title = buildPhaseTransitionTitle(
      campaign.subjectName,
      newPhase,
      previousUpdates.map((u) => u.title),
    );

    await db.insert(schema.campaignUpdates).values({
      campaignId: campaign.id,
      title,
      bodyHtml: `<p>${updateText}</p>`,
      updateType: 'phase_transition',
    });
  } catch (error) {
    console.error(`Phase transition update generation failed for ${campaign.id}:`, error);
  }

  // Log audit
  await db.insert(schema.auditLogs).values({
    eventType: 'campaign.phase_transition',
    targetType: 'campaign',
    targetId: campaign.id,
    severity: 'info',
    details: {
      newPhase,
      percentage: Math.floor((campaign.raisedAmount / campaign.goalAmount) * 100),
      raisedAmount: campaign.raisedAmount,
    },
  });
}

/**
 * Handle campaign completion: record last donor, generate celebration update,
 * organizer thank-you, and schedule impact report.
 */
async function handleCompletion(
  campaign: Campaign,
  lastDonorName: string | null,
  lastDonorAmount: number | null,
): Promise<void> {
  const completedAt = new Date();

  // Persist completion status and last donor details
  await db
    .update(schema.campaigns)
    .set({
      status: 'completed',
      completedAt,
      lastDonorName: lastDonorName ?? undefined,
      lastDonorAmount: lastDonorAmount ?? undefined,
      updatedAt: completedAt,
    })
    .where(eq(schema.campaigns.id, campaign.id));

  // Update local reference so subsequent code sees the new state
  campaign.completedAt = completedAt;

  // ── 1. AI-generated celebration update ──
  try {
    const donorMention = lastDonorName
      ? ` Thanks to ${lastDonorName}'s generous donation of $${((lastDonorAmount ?? 0) / 100).toLocaleString()}, the campaign crossed the finish line!`
      : '';

    const celebrationPrompt = {
      systemPrompt: `You write celebration updates for a nonprofit fundraising platform. Write a short, warm, celebratory post (2-3 paragraphs). Mention the subject by name, the total raised, donor count, and the last donor if provided. Return ONLY plain text paragraphs separated by blank lines, no formatting.`,
      userPrompt: `Campaign "${campaign.subjectName}" has been fully funded!
Goal: $${(campaign.goalAmount / 100).toLocaleString()}
Raised: $${(campaign.raisedAmount / 100).toLocaleString()}
Total Donors: ${campaign.donorCount}
${lastDonorName ? `Last Donor: ${lastDonorName} ($${((lastDonorAmount ?? 0) / 100).toLocaleString()})` : ''}

Write a celebration post announcing the campaign has reached its goal.`,
    };

    const celebrationText = await callAI<string>({
      systemPrompt: celebrationPrompt.systemPrompt,
      userPrompt: celebrationPrompt.userPrompt,
      parseJson: false,
      promptType: 'generate-celebration',
      campaignId: campaign.id,
    });

    const celebrationHtml = celebrationText
      .split('\n\n')
      .filter(Boolean)
      .map((p) => `<p>${p.trim()}</p>`)
      .join('\n');

    await db.insert(schema.campaignUpdates).values({
      campaignId: campaign.id,
      title: `${campaign.subjectName}'s campaign is fully funded!${donorMention ? ' 🎉' : ''}`,
      bodyHtml: celebrationHtml,
      updateType: 'celebration',
    });
  } catch (error) {
    console.error(`Celebration update failed for ${campaign.id}:`, error);
    // Fallback: insert a simple completion update so the campaign always has one
    await db.insert(schema.campaignUpdates).values({
      campaignId: campaign.id,
      title: `${campaign.subjectName}'s campaign is fully funded!`,
      bodyHtml: `<p>${campaign.subjectName}'s campaign has reached its goal of $${(campaign.goalAmount / 100).toLocaleString()}! Thank you to every single donor who made this possible.</p>`,
      updateType: 'completion',
    });
  }

  // ── 2. Organizer thank-you update ──
  const organizer = campaign.campaignOrganizer as CampaignOrganizer | null;
  if (organizer) {
    generateOrganizerThankYou(campaign, organizer, lastDonorName).catch((err) =>
      console.error(`Organizer thank-you failed for ${campaign.id}:`, err),
    );
  }

  // ── 3. Impact report (fire-and-forget, conceptually delayed) ──
  generateImpactReport(campaign, lastDonorName).catch((err) =>
    console.error(`Impact report generation failed for ${campaign.id}:`, err),
  );

  // ── 4. Audit log ──
  await db.insert(schema.auditLogs).values({
    eventType: 'campaign.completed',
    targetType: 'campaign',
    targetId: campaign.id,
    severity: 'info',
    details: {
      raisedAmount: campaign.raisedAmount,
      goalAmount: campaign.goalAmount,
      donorCount: campaign.donorCount,
      lastDonorName,
      lastDonorAmount,
    },
  });
}

/**
 * Generate an organizer thank-you update for a completed campaign.
 */
async function generateOrganizerThankYou(
  campaign: Campaign,
  organizer: CampaignOrganizer,
  lastDonorName: string | null,
): Promise<void> {
  const thankYouText = await callAI<string>({
    systemPrompt: `You write thank-you messages from a campaign organizer on a nonprofit fundraising platform. Write in first person as ${organizer.name} (${organizer.relation} of ${campaign.subjectName}, from ${organizer.city}). Be heartfelt, personal, and grateful. 1-2 short paragraphs. Return ONLY plain text, no formatting.`,
    userPrompt: `Write a thank-you message from ${organizer.name} now that ${campaign.subjectName}'s campaign has been fully funded.
Goal: $${(campaign.goalAmount / 100).toLocaleString()}
Raised: $${(campaign.raisedAmount / 100).toLocaleString()}
Donors: ${campaign.donorCount}
${lastDonorName ? `Last Donor (the one who completed the campaign): ${lastDonorName}` : ''}

Thank all donors warmly. If a last donor name is provided, give them a special mention.`,
    parseJson: false,
    promptType: 'generate-thank-you',
    campaignId: campaign.id,
  });

  const bodyHtml = thankYouText
    .split('\n\n')
    .filter(Boolean)
    .map((p) => `<p>${p.trim()}</p>`)
    .join('\n');

  await db.insert(schema.campaignUpdates).values({
    campaignId: campaign.id,
    title: `A message from ${organizer.name}: Thank you`,
    bodyHtml,
    updateType: 'thank_you',
  });
}

/**
 * Generate an impact report for a completed campaign.
 * Uses the generate-impact prompt to create a 3-paragraph report
 * covering recap, disbursement plan, and thank-you.
 */
async function generateImpactReport(
  campaign: Campaign,
  lastDonorName: string | null,
): Promise<void> {
  const category = (campaign.category as CampaignCategory) ?? 'community';

  // Derive the event from the story (first sentence, cleaned of HTML)
  const storyText = campaign.storyHtml.replace(/<[^>]+>/g, '').trim();
  const event = storyText.slice(0, 120) || `${campaign.subjectName}'s campaign`;

  const prompt = buildGenerateImpactPrompt({
    subjectName: campaign.subjectName,
    event,
    category,
    goalAmount: campaign.goalAmount,
    raisedAmount: campaign.raisedAmount,
    donorCount: campaign.donorCount,
    lastDonorName: lastDonorName ?? undefined,
  });

  const impactText = await callAI<string>({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    parseJson: false,
    promptType: 'generate-impact',
    campaignId: campaign.id,
  });

  const bodyHtml = impactText
    .split('\n\n')
    .filter(Boolean)
    .map((p) => `<p>${p.trim()}</p>`)
    .join('\n');

  await db.insert(schema.campaignUpdates).values({
    campaignId: campaign.id,
    title: `Impact Report: ${campaign.subjectName}'s Campaign`,
    bodyHtml,
    updateType: 'impact_report',
  });
}
