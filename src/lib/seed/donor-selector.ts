import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import type { CampaignCategory } from '@/types';
import {
  DONOR_POOL,
  DONOR_POOL_SIZE,
  DONORS_BY_STATE,
  DONORS_BY_REGION,
  DONORS_BY_CITY,
  DONORS_BY_LAST_NAME,
  MILITARY_DONOR_IDS,
  type SimulatedDonor,
} from './donor-pool';
import type { Campaign, TrajectoryProfile } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SelectedDonor = {
  /** The simulated donor record. */
  donor: SimulatedDonor;
  /** Display name (may include formatting variants). */
  displayName: string;
  /** Display location string. */
  displayLocation: string;
  /** Whether this donation should be anonymous. */
  isAnonymous: boolean;
};

/**
 * A cohort of donors that should be inserted together to create
 * natural-looking group donation patterns.
 */
export type DonorCohort = {
  type: 'community_group' | 'workplace_match' | 'family_chain';
  donors: SelectedDonor[];
  /** For family chains: suggested stagger interval in ms between donations. */
  staggerMs?: number;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const ANONYMOUS_RATE = 0.05;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Probability of selecting a repeat donor (donated to another campaign recently). */
const REPEAT_DONOR_CHANCE = 0.08; // 5-10% range

/** Probability of triggering a cohort pattern in a given cycle. */
const COHORT_CHANCE = 0.12;

// ─── Display Name Formatting ────────────────────────────────────────────────

type NameFormatter = (first: string, last: string) => string;

const NAME_FORMATS: NameFormatter[] = [
  (f, l) => `${f} ${l}`,           // Full name: "Sarah Johnson"
  (f, l) => `${f} ${l.charAt(0)}.`, // First + initial: "Sarah J."
  (f, _l) => f,                     // First name only: "Sarah"
  (f, l) => `${f} ${l}`,           // Full name (weighted duplicate for frequency)
];

type LocationFormatter = (city: string, state: string) => string;

const LOCATION_FORMATS: LocationFormatter[] = [
  (c, s) => `${c}, ${s}`,           // "Portland, OR"
  (_c, s) => s,                      // "OR"
  (c, s) => `${c}, ${s}`,           // duplicate for frequency
  (c, _s) => c,                     // "Portland"
];

function formatDonorName(donor: SimulatedDonor, rand: () => number): string {
  const fmt = NAME_FORMATS[Math.floor(rand() * NAME_FORMATS.length)];
  return fmt(donor.firstName, donor.lastName);
}

function formatDonorLocation(donor: SimulatedDonor, rand: () => number): string {
  const fmt = LOCATION_FORMATS[Math.floor(rand() * LOCATION_FORMATS.length)];
  return fmt(donor.city, donor.state);
}

// ─── Simple PRNG for runtime selection (not the pool generator) ─────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Campaign Location Parsing ──────────────────────────────────────────────

type ParsedLocation = {
  city: string | null;
  state: string | null;
  region: string | null;
};

// US state abbreviations for parsing
const STATE_ABBRS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]);

const STATE_FULL_NAMES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
};

/**
 * Parse a campaign's location string (e.g. "Portland, OR" or "Texas")
 * into structured city/state/region for donor matching.
 */
function parseCampaignLocation(location: string | null): ParsedLocation {
  if (!location) return { city: null, state: null, region: null };

  const trimmed = location.trim();

  // Try "City, STATE" format
  const commaMatch = trimmed.match(/^(.+),\s*([A-Z]{2})$/);
  if (commaMatch) {
    const city = commaMatch[1].trim();
    const state = commaMatch[2];
    if (STATE_ABBRS.has(state)) {
      // Find matching region from pool data
      const matchingDonor = DONOR_POOL.find(
        (d) => d.city.toLowerCase() === city.toLowerCase() && d.state === state,
      );
      return { city, state, region: matchingDonor?.region ?? null };
    }
  }

  // Try state abbreviation only
  const upper = trimmed.toUpperCase();
  if (STATE_ABBRS.has(upper)) {
    return { city: null, state: upper, region: null };
  }

  // Try full state name
  const lower = trimmed.toLowerCase();
  if (STATE_FULL_NAMES[lower]) {
    return { city: null, state: STATE_FULL_NAMES[lower], region: null };
  }

  // Try city name match against the pool
  const matchingDonor = DONOR_POOL.find(
    (d) => d.city.toLowerCase() === lower,
  );
  if (matchingDonor) {
    return { city: matchingDonor.city, state: matchingDonor.state, region: matchingDonor.region };
  }

  return { city: null, state: null, region: null };
}

// ─── Repeat Donor Detection ────────────────────────────────────────────────

/**
 * Find donor IDs from the pool who have donated (as seed) to other campaigns
 * in the last 30 days - these are candidates for repeat-donor selection.
 */
async function getRecentSeedDonorNames(): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const recentDonors = await db
    .select({ donorName: schema.donations.donorName })
    .from(schema.donations)
    .where(
      and(
        eq(schema.donations.source, 'seed'),
        gte(schema.donations.createdAt, cutoff),
      ),
    )
    .limit(500);

  return new Set(recentDonors.map((d) => d.donorName));
}

/**
 * Match a set of recently used donor display names back to pool donor IDs.
 * Returns IDs of donors whose first+last names appear in the recent set.
 */
function matchRecentToDonorPool(recentNames: Set<string>): number[] {
  const ids: number[] = [];
  for (const donor of DONOR_POOL) {
    const fullName = `${donor.firstName} ${donor.lastName}`;
    const firstInitial = `${donor.firstName} ${donor.lastName.charAt(0)}.`;
    if (recentNames.has(fullName) || recentNames.has(firstInitial) || recentNames.has(donor.firstName)) {
      ids.push(donor.id);
    }
  }
  return ids;
}

// ─── Core Selection Algorithm ───────────────────────────────────────────────

/**
 * Select a simulated donor appropriate for this campaign.
 *
 * Algorithm:
 * 1. Parse campaign location → state/region
 * 2. If campaign is <48hrs old, apply 40% local weighting
 * 3. If military/veterans category, apply 30% military weighting
 * 4. 5-10% chance of selecting a repeat donor (someone who donated elsewhere recently)
 * 5. Remaining selections are random from the full pool, weighted by category affinity
 */
export async function selectSimulatedDonor(campaign: Campaign): Promise<SelectedDonor> {
  const profile = (campaign.campaignProfile as TrajectoryProfile) ?? null;
  const localWeight = profile?.localDonorWeight ?? 0.25;
  const rand = mulberry32(Date.now() ^ (Math.random() * 0xffff_ffff));

  // Anonymous check first
  if (rand() < ANONYMOUS_RATE) {
    const randomDonor = DONOR_POOL[Math.floor(rand() * DONOR_POOL_SIZE)];
    return {
      donor: randomDonor,
      displayName: 'Anonymous',
      displayLocation: '',
      isAnonymous: true,
    };
  }

  // Parse campaign location
  const loc = parseCampaignLocation(campaign.location ?? campaign.subjectHometown ?? null);
  const publishedAt = campaign.publishedAt ?? campaign.createdAt;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const isEarly = ageMs < FORTY_EIGHT_HOURS_MS;
  const isMilitaryCategory = campaign.category === 'military' || campaign.category === 'veterans';

  // Determine selection strategy
  const r = rand();

  // Strategy 1: Repeat donor (5-10%)
  if (r < REPEAT_DONOR_CHANCE) {
    const recentNames = await getRecentSeedDonorNames();
    const repeatCandidates = matchRecentToDonorPool(recentNames);
    if (repeatCandidates.length > 0) {
      const id = repeatCandidates[Math.floor(rand() * repeatCandidates.length)];
      const donor = DONOR_POOL[id];
      return {
        donor,
        displayName: formatDonorName(donor, rand),
        displayLocation: formatDonorLocation(donor, rand),
        isAnonymous: false,
      };
    }
    // Fall through if no repeat candidates found
  }

  // Strategy 2: Military-adjacent donors (30% for military campaigns)
  if (isMilitaryCategory && rand() < 0.30 && MILITARY_DONOR_IDS.length > 0) {
    const id = MILITARY_DONOR_IDS[Math.floor(rand() * MILITARY_DONOR_IDS.length)];
    const donor = DONOR_POOL[id];
    return {
      donor,
      displayName: formatDonorName(donor, rand),
      displayLocation: formatDonorLocation(donor, rand),
      isAnonymous: false,
    };
  }

  // Strategy 3: Local donor (40% weight in first 48hrs, localDonorWeight thereafter)
  const effectiveLocalWeight = isEarly ? 0.40 : localWeight;
  if (loc.state && rand() < effectiveLocalWeight) {
    // Try region first (tighter clustering), fall back to state
    let candidateIds: number[] | undefined;
    if (loc.region) {
      candidateIds = DONORS_BY_REGION.get(loc.region);
    }
    if (!candidateIds || candidateIds.length === 0) {
      candidateIds = DONORS_BY_STATE.get(loc.state);
    }
    if (candidateIds && candidateIds.length > 0) {
      const id = candidateIds[Math.floor(rand() * candidateIds.length)];
      const donor = DONOR_POOL[id];
      return {
        donor,
        displayName: formatDonorName(donor, rand),
        displayLocation: formatDonorLocation(donor, rand),
        isAnonymous: false,
      };
    }
  }

  // Strategy 4: Category-affinity weighted random selection
  const donor = pickByAffinity(campaign.category, rand);
  return {
    donor,
    displayName: formatDonorName(donor, rand),
    displayLocation: formatDonorLocation(donor, rand),
    isAnonymous: false,
  };
}

/**
 * Pick a donor with slight preference for donors whose categoryAffinity
 * includes the campaign's category. Non-matching donors still have a chance.
 */
function pickByAffinity(category: string, rand: () => number): SimulatedDonor {
  // 60% chance to filter by affinity, 40% pure random
  if (rand() < 0.60) {
    // Try to find a donor with matching affinity (sample up to 20 random picks)
    for (let i = 0; i < 20; i++) {
      const donor = DONOR_POOL[Math.floor(rand() * DONOR_POOL_SIZE)];
      if (donor.categoryAffinity.includes(category as CampaignCategory)) {
        return donor;
      }
    }
  }
  // Pure random fallback
  return DONOR_POOL[Math.floor(rand() * DONOR_POOL_SIZE)];
}

// ─── Cohort Generation ──────────────────────────────────────────────────────

/**
 * Determine if this cycle should produce a cohort pattern, and if so,
 * generate the cohort donors. Returns null if no cohort this cycle.
 *
 * Cohort types:
 * - Community group: 3-5 donors from the same city, donated within 2 hours
 * - Workplace match: 5-10 donors from the same metro, all same amount
 * - Family chain: 2-3 donors sharing a last name, staggered 30-90 min
 */
export function maybeBuildCohort(
  campaign: Campaign,
): DonorCohort | null {
  const rand = mulberry32(Date.now() ^ (Math.random() * 0xffff_ffff));

  if (rand() > COHORT_CHANCE) return null;

  const loc = parseCampaignLocation(campaign.location ?? campaign.subjectHometown ?? null);

  // Pick cohort type
  const cohortRoll = rand();

  if (cohortRoll < 0.40) {
    // Community group: 3-5 donors from same city
    return buildCommunityGroup(loc, rand);
  } else if (cohortRoll < 0.75) {
    // Workplace match: 5-10 donors from same metro/region
    return buildWorkplaceMatch(loc, rand);
  } else {
    // Family chain: 2-3 donors with same last name
    return buildFamilyChain(rand);
  }
}

function buildCommunityGroup(loc: ParsedLocation, rand: () => number): DonorCohort | null {
  // Find a city with enough donors
  let candidateIds: number[] | undefined;

  if (loc.city && loc.state) {
    const key = `${loc.city}, ${loc.state}`;
    candidateIds = DONORS_BY_CITY.get(key) ? [...DONORS_BY_CITY.get(key)!] : undefined;
  }

  // If campaign city doesn't have enough donors, pick a random city with 5+
  if (!candidateIds || candidateIds.length < 3) {
    const cities = [...DONORS_BY_CITY.entries()].filter(([, ids]) => ids.length >= 5);
    if (cities.length === 0) return null;
    const [, ids] = cities[Math.floor(rand() * cities.length)];
    candidateIds = [...ids];
  }

  const count = 3 + Math.floor(rand() * 3); // 3-5
  const selected: SelectedDonor[] = [];
  shuffle(candidateIds, rand);

  for (let i = 0; i < Math.min(count, candidateIds.length); i++) {
    const donor = DONOR_POOL[candidateIds[i]];
    selected.push({
      donor,
      displayName: formatDonorName(donor, rand),
      displayLocation: formatDonorLocation(donor, rand),
      isAnonymous: false,
    });
  }

  return selected.length >= 3
    ? { type: 'community_group', donors: selected }
    : null;
}

function buildWorkplaceMatch(loc: ParsedLocation, rand: () => number): DonorCohort | null {
  let candidateIds: number[] | undefined;

  if (loc.region) {
    candidateIds = DONORS_BY_REGION.get(loc.region) ? [...DONORS_BY_REGION.get(loc.region)!] : undefined;
  }

  if (!candidateIds || candidateIds.length < 5) {
    // Pick a random region with enough donors
    const regions = [...DONORS_BY_REGION.entries()].filter(([, ids]) => ids.length >= 10);
    if (regions.length === 0) return null;
    const [, ids] = regions[Math.floor(rand() * regions.length)];
    candidateIds = [...ids];
  }

  const count = 5 + Math.floor(rand() * 6); // 5-10
  const selected: SelectedDonor[] = [];
  shuffle(candidateIds, rand);

  for (let i = 0; i < Math.min(count, candidateIds.length); i++) {
    const donor = DONOR_POOL[candidateIds[i]];
    selected.push({
      donor,
      displayName: formatDonorName(donor, rand),
      displayLocation: formatDonorLocation(donor, rand),
      isAnonymous: false,
    });
  }

  return selected.length >= 5
    ? { type: 'workplace_match', donors: selected }
    : null;
}

function buildFamilyChain(rand: () => number): DonorCohort | null {
  // Pick a last name with 2+ donors
  const families = [...DONORS_BY_LAST_NAME.entries()].filter(([, ids]) => ids.length >= 2);
  if (families.length === 0) return null;

  const [, ids] = families[Math.floor(rand() * families.length)];
  const count = 2 + (rand() < 0.40 ? 1 : 0); // 2-3
  const selected: SelectedDonor[] = [];
  const shuffled = [...ids];
  shuffle(shuffled, rand);

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const donor = DONOR_POOL[shuffled[i]];
    selected.push({
      donor,
      displayName: formatDonorName(donor, rand),
      displayLocation: formatDonorLocation(donor, rand),
      isAnonymous: false,
    });
  }

  // Stagger interval: 30-90 minutes in ms
  const staggerMs = (30 + Math.floor(rand() * 61)) * 60 * 1000;

  return selected.length >= 2
    ? { type: 'family_chain', donors: selected, staggerMs }
    : null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (in-place) using provided PRNG. */
function shuffle<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
