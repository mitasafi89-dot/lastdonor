import type { CampaignCategory } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A planned surge event that accelerates donation velocity at a specific
 * percentage threshold. Simulates real-world share events, media pickups,
 * workplace challenges, etc.
 */
export type SurgeEvent = {
  /** Campaign percentage threshold that triggers this surge. */
  atPercent: number;
  /** Multiplier applied to base donation count for this + next cycle. */
  multiplier: number;
  /** How many consecutive 15-min cycles this surge lasts. */
  durationCycles: number;
  /** Human-readable label for audit logging. */
  label: string;
};

/**
 * The trajectory profile attached to each campaign at creation time.
 * Stored as JSONB on the campaigns table. Dictates how the simulation
 * engine distributes donations over the campaign's lifetime.
 */
export type TrajectoryProfile = {
  /** Archetype identifier. */
  type: TrajectoryType;
  /** Target number of days from publish to 100% funded. */
  targetDays: number;
  /** Base probability (0–1) that this campaign receives donations in a given cycle. */
  baseDonateChance: number;
  /**
   * Phase-specific multipliers applied to baseDonateChance.
   * Allows each archetype to have a distinct velocity curve per phase.
   */
  phaseMultipliers: {
    first_believers: number;
    the_push: number;
    closing_in: number;
    last_donor_zone: number;
  };
  /**
   * Min and max donations per cycle when a donation event fires.
   * Profile-driven to allow viral campaigns to batch more donations.
   */
  donationsPerCycle: { min: number; max: number };
  /** Planned surge events during the campaign lifecycle. */
  surges: SurgeEvent[];
  /**
   * Amount tier key controlling which psychological-pricing distribution
   * is used. Linked to goal size.
   */
  amountTier: AmountTier;
  /**
   * Optional: fraction of donations that should come from the campaign's
   * region (state/metro). Used by donor selection (Milestone 2).
   * Stored now so profiles are complete; unused until donor identity system exists.
   */
  localDonorWeight: number;
};

export type TrajectoryType =
  | 'viral'
  | 'steady'
  | 'slow_burn'
  | 'surge_late';

export type AmountTier = 'low' | 'mid' | 'high';

// ─── Archetype Definitions ──────────────────────────────────────────────────

/**
 * Viral: Goal reached in 1–3 days.
 * Models first-responder LODD, major disasters with media coverage.
 * Extremely high first_believers velocity with rapid decay.
 */
const VIRAL_BASE: Omit<TrajectoryProfile, 'amountTier' | 'surges' | 'targetDays'> = {
  type: 'viral',
  baseDonateChance: 0.90,
  phaseMultipliers: {
    first_believers: 1.0,
    the_push: 0.85,
    closing_in: 0.70,
    last_donor_zone: 0.95,
  },
  donationsPerCycle: { min: 2, max: 5 },
  localDonorWeight: 0.35,
};

/**
 * Steady: Goal reached in 10–21 days.
 * Models medical campaigns, community causes with consistent sharing.
 * Moderate activity throughout with gentle acceleration near end.
 */
const STEADY_BASE: Omit<TrajectoryProfile, 'amountTier' | 'surges' | 'targetDays'> = {
  type: 'steady',
  baseDonateChance: 0.55,
  phaseMultipliers: {
    first_believers: 0.90,
    the_push: 1.0,
    closing_in: 1.10,
    last_donor_zone: 1.20,
  },
  donationsPerCycle: { min: 1, max: 3 },
  localDonorWeight: 0.25,
};

/**
 * Slow Burn: Goal reached in 30–60 days.
 * Models essential-needs, veterans campaigns that trickle for weeks
 * before a share event or media pickup accelerates them.
 */
const SLOW_BURN_BASE: Omit<TrajectoryProfile, 'amountTier' | 'surges' | 'targetDays'> = {
  type: 'slow_burn',
  baseDonateChance: 0.30,
  phaseMultipliers: {
    first_believers: 0.80,
    the_push: 1.0,
    closing_in: 1.30,
    last_donor_zone: 1.50,
  },
  donationsPerCycle: { min: 1, max: 2 },
  localDonorWeight: 0.20,
};

/**
 * Surge Late: Stalls at 30–50% then a triggering event causes rapid completion.
 * Models memorial campaigns where a news article resurfaces,
 * or community campaigns picked up by a local influencer.
 */
const SURGE_LATE_BASE: Omit<TrajectoryProfile, 'amountTier' | 'surges' | 'targetDays'> = {
  type: 'surge_late',
  baseDonateChance: 0.25,
  phaseMultipliers: {
    first_believers: 0.90,
    the_push: 0.50,       // deliberate lull - the "stall"
    closing_in: 1.60,     // post-surge acceleration
    last_donor_zone: 1.40,
  },
  donationsPerCycle: { min: 1, max: 2 },
  localDonorWeight: 0.30,
};

// ─── Category → Archetype Probability Weights ───────────────────────────────

/**
 * For each category, defines the probability of being assigned each archetype.
 * Probabilities are weights (not strict fractions) - they are normalized at selection.
 *
 * Reasoning:
 * - military/first-responders: unions share instantly → often viral
 * - disaster: depends on severity; mostly steady, sometimes viral
 * - medical: steady trajectory, occasionally slow burn
 * - memorial: emotionally charged, often surge_late when shared
 * - veterans: slow burn, communities take time to mobilize
 * - community: mixed, slightly favoring steady
 * - essential-needs: most likely slow burn, hardest to gain traction
 * - emergency: high urgency → viral or steady, rarely slow
 * - charity: established orgs → steady/slow_burn, predictable
 * - education: scholarship/tuition → slow_burn dominant, some surge_late
 * - animal: emotional appeal → viral potential, often surge_late shares
 * - environment: cause-driven → slow_burn dominant, niche audience
 * - business: pragmatic donors → steady, low emotional velocity
 * - competition: gamification → surge_late as deadlines approach
 * - creative: artist/musician → slow_burn, niche loyal fanbases
 * - event: time-bound → steady with natural surge_late near event date
 * - faith: congregation-driven → steady with predictable giving patterns
 * - family: emotional → viral potential from shares, surge_late common
 * - sports: team/community → surge_late around games/seasons
 * - travel: lower urgency → slow_burn, hardest to generate momentum
 * - volunteer: cause-driven → slow_burn, grassroots mobilization
 * - wishes: highly emotional → viral from social shares, surge_late
 */
const CATEGORY_WEIGHTS: Record<CampaignCategory, Record<TrajectoryType, number>> = {
  // ── Core categories (original 8) ──
  military:            { viral: 0.40, steady: 0.30, slow_burn: 0.10, surge_late: 0.20 },
  veterans:            { viral: 0.05, steady: 0.30, slow_burn: 0.45, surge_late: 0.20 },
  'first-responders':  { viral: 0.45, steady: 0.30, slow_burn: 0.05, surge_late: 0.20 },
  disaster:            { viral: 0.30, steady: 0.40, slow_burn: 0.15, surge_late: 0.15 },
  medical:             { viral: 0.10, steady: 0.45, slow_burn: 0.30, surge_late: 0.15 },
  memorial:            { viral: 0.15, steady: 0.25, slow_burn: 0.20, surge_late: 0.40 },
  community:           { viral: 0.10, steady: 0.40, slow_burn: 0.25, surge_late: 0.25 },
  'essential-needs':   { viral: 0.05, steady: 0.25, slow_burn: 0.50, surge_late: 0.20 },
  // ── Extended categories (15) ──
  emergency:           { viral: 0.35, steady: 0.35, slow_burn: 0.10, surge_late: 0.20 },
  charity:             { viral: 0.05, steady: 0.45, slow_burn: 0.35, surge_late: 0.15 },
  education:           { viral: 0.05, steady: 0.25, slow_burn: 0.45, surge_late: 0.25 },
  animal:              { viral: 0.30, steady: 0.20, slow_burn: 0.15, surge_late: 0.35 },
  environment:         { viral: 0.05, steady: 0.25, slow_burn: 0.50, surge_late: 0.20 },
  business:            { viral: 0.05, steady: 0.50, slow_burn: 0.30, surge_late: 0.15 },
  competition:         { viral: 0.10, steady: 0.25, slow_burn: 0.20, surge_late: 0.45 },
  creative:            { viral: 0.10, steady: 0.20, slow_burn: 0.45, surge_late: 0.25 },
  event:               { viral: 0.10, steady: 0.35, slow_burn: 0.15, surge_late: 0.40 },
  faith:               { viral: 0.05, steady: 0.50, slow_burn: 0.30, surge_late: 0.15 },
  family:              { viral: 0.25, steady: 0.25, slow_burn: 0.15, surge_late: 0.35 },
  sports:              { viral: 0.15, steady: 0.25, slow_burn: 0.15, surge_late: 0.45 },
  travel:              { viral: 0.05, steady: 0.20, slow_burn: 0.55, surge_late: 0.20 },
  volunteer:           { viral: 0.05, steady: 0.30, slow_burn: 0.45, surge_late: 0.20 },
  wishes:              { viral: 0.30, steady: 0.20, slow_burn: 0.10, surge_late: 0.40 },
};

// ─── Target Duration Ranges (days) ──────────────────────────────────────────

const DURATION_RANGES: Record<TrajectoryType, { min: number; max: number }> = {
  viral:      { min: 1, max: 3 },
  steady:     { min: 10, max: 21 },
  slow_burn:  { min: 30, max: 60 },
  surge_late: { min: 14, max: 35 },
};

// ─── Surge Event Templates ──────────────────────────────────────────────────

function generateSurges(type: TrajectoryType): SurgeEvent[] {
  switch (type) {
    case 'viral':
      // Viral campaigns front-load activity; one mid-campaign media bump
      return [
        { atPercent: 15, multiplier: 2.5, durationCycles: 4, label: 'Launch share wave' },
        { atPercent: 50, multiplier: 1.8, durationCycles: 3, label: 'Media pickup' },
      ];
    case 'steady':
      // Periodic share events that create gentle bumps
      return [
        { atPercent: 25, multiplier: 1.5, durationCycles: 2, label: 'First milestone share' },
        { atPercent: 50, multiplier: 1.6, durationCycles: 2, label: 'Halfway share' },
        { atPercent: 75, multiplier: 1.8, durationCycles: 3, label: 'Three-quarter push' },
      ];
    case 'slow_burn':
      // One big surge later that re-energizes the campaign
      return [
        { atPercent: 20, multiplier: 1.3, durationCycles: 2, label: 'Early supporter share' },
        { atPercent: 55, multiplier: 2.0, durationCycles: 4, label: 'Viral reshare event' },
        { atPercent: 85, multiplier: 1.6, durationCycles: 2, label: 'Final push share' },
      ];
    case 'surge_late':
      // Minimal early activity, then a transformative surge in the_push/closing_in
      return [
        { atPercent: 40, multiplier: 3.0, durationCycles: 6, label: 'Media/influencer pickup' },
        { atPercent: 80, multiplier: 1.8, durationCycles: 3, label: 'Community rally' },
      ];
  }
}

// ─── Amount Tier Assignment ─────────────────────────────────────────────────

/**
 * Determine the amount tier based on the campaign's goal.
 * Low-goal campaigns ($2K–$10K) get smaller donations.
 * High-goal campaigns ($25K+) get larger donations including rare major gifts.
 */
function getAmountTier(goalAmountCents: number): AmountTier {
  const goalDollars = goalAmountCents / 100;
  if (goalDollars <= 10_000) return 'low';
  if (goalDollars <= 25_000) return 'mid';
  return 'high';
}

// ─── Random Helpers ─────────────────────────────────────────────────────────

/** Pick a random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Weighted random selection. Weights don't need to sum to 1. */
function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * totalWeight;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a trajectory profile for a newly created campaign.
 * Called once at campaign creation time. The resulting profile is stored
 * as JSONB and drives all simulation behavior for this campaign's lifetime.
 */
export function generateTrajectoryProfile(
  category: CampaignCategory,
  goalAmountCents: number,
): TrajectoryProfile {
  // 1. Select archetype based on category weights
  const weights = CATEGORY_WEIGHTS[category];
  const type = weightedPick(weights);

  // 2. Pick target duration within the archetype's range
  const range = DURATION_RANGES[type];
  const targetDays = randInt(range.min, range.max);

  // 3. Get the base profile for this archetype
  const bases: Record<TrajectoryType, Omit<TrajectoryProfile, 'amountTier' | 'surges' | 'targetDays'>> = {
    viral: VIRAL_BASE,
    steady: STEADY_BASE,
    slow_burn: SLOW_BURN_BASE,
    surge_late: SURGE_LATE_BASE,
  };
  const base = bases[type];

  // 4. Generate surge events
  const surges = generateSurges(type);

  // 5. Determine amount tier from goal
  const amountTier = getAmountTier(goalAmountCents);

  return {
    ...base,
    targetDays,
    surges,
    amountTier,
  };
}

/**
 * Persisted surge state: maps surge atPercent thresholds to the cycle number
 * when they were first triggered. Stored in simulationConfig JSONB so surge
 * duration survives across 15-minute cron runs.
 */
export type SurgeState = Record<number, number>;

/**
 * Check if any surge event should be active for the current campaign state.
 *
 * A surge activates when the campaign percentage first crosses its threshold
 * and remains active for exactly `durationCycles` consecutive cycles. State
 * is persisted via the `surgeState` object (mutated in-place) so that surge
 * durations survive across cron runs.
 *
 * Returns the multiplier to apply (1.0 if no surge is active).
 */
export function getActiveSurgeMultiplier(
  profile: TrajectoryProfile,
  currentPercent: number,
  currentCycle: number,
  surgeState: SurgeState,
): number {
  let multiplier = 1.0;

  for (const surge of profile.surges) {
    const key = surge.atPercent;

    if (currentPercent >= key && !(key in surgeState)) {
      // Surge threshold just crossed - record the trigger cycle
      surgeState[key] = currentCycle;
    }

    if (key in surgeState) {
      const elapsed = currentCycle - surgeState[key];
      if (elapsed < surge.durationCycles) {
        // Surge is still within its duration window
        multiplier = Math.max(multiplier, surge.multiplier);
      }
    }
  }

  return multiplier;
}
