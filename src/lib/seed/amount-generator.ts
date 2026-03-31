import type { AmountTier } from '@/lib/seed/trajectory-profiles';

/**
 * Psychologically-priced donation amounts based on real-world crowdfunding data.
 *
 * Humans donate in round numbers. The distribution below is derived from
 * publicly available GoFundMe / crowdfunding research:
 *   $25 (30%), $50 (25%), $100 (20%), $250 (8%), $20 (5%),
 *   $500 (4%), $75 (3%), $150 (2%), $1000 (1.5%), $35 (0.5%),
 *   $200 (0.5%), $2500 (0.3%), $5000 (0.2%).
 *
 * Three tiers control which amounts are available and at what weights,
 * so a $5K-goal campaign never sees a $5,000 donation.
 */

type WeightedAmount = { amount: number; weight: number };

/** Low-tier: campaigns ≤$10K goal. Max donation $500. */
const LOW_TIER: WeightedAmount[] = [
  { amount: 20, weight: 8 },
  { amount: 25, weight: 32 },
  { amount: 35, weight: 2 },
  { amount: 50, weight: 28 },
  { amount: 75, weight: 5 },
  { amount: 100, weight: 18 },
  { amount: 150, weight: 3 },
  { amount: 200, weight: 2 },
  { amount: 250, weight: 1.5 },
  { amount: 500, weight: 0.5 },
];

/** Mid-tier: campaigns $10K–$25K goal. Max donation $2,500. */
const MID_TIER: WeightedAmount[] = [
  { amount: 20, weight: 5 },
  { amount: 25, weight: 28 },
  { amount: 35, weight: 1 },
  { amount: 50, weight: 25 },
  { amount: 75, weight: 3 },
  { amount: 100, weight: 20 },
  { amount: 150, weight: 3 },
  { amount: 200, weight: 2 },
  { amount: 250, weight: 6 },
  { amount: 500, weight: 4 },
  { amount: 1000, weight: 2 },
  { amount: 2500, weight: 1 },
];

/** High-tier: campaigns >$25K goal. Allows rare $5,000 donations. */
const HIGH_TIER: WeightedAmount[] = [
  { amount: 20, weight: 4 },
  { amount: 25, weight: 25 },
  { amount: 35, weight: 0.5 },
  { amount: 50, weight: 24 },
  { amount: 75, weight: 3 },
  { amount: 100, weight: 20 },
  { amount: 150, weight: 3 },
  { amount: 200, weight: 2 },
  { amount: 250, weight: 7 },
  { amount: 500, weight: 5 },
  { amount: 1000, weight: 3.5 },
  { amount: 2500, weight: 2 },
  { amount: 5000, weight: 1 },
];

const TIERS: Record<AmountTier, WeightedAmount[]> = {
  low: LOW_TIER,
  mid: MID_TIER,
  high: HIGH_TIER,
};

/**
 * Pick a donation amount using weighted random selection from the
 * psychologically-priced tier.
 */
export function generateSeedAmount(tier: AmountTier = 'mid'): number {
  const pool = TIERS[tier];
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let r = Math.random() * totalWeight;

  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) return entry.amount;
  }

  // Fallback (should never reach here due to floating-point)
  return pool[pool.length - 1].amount;
}

/**
 * Convert dollar amount to cents for DB storage.
 */
export function seedAmountCents(tier: AmountTier = 'mid'): number {
  return generateSeedAmount(tier) * 100;
}

/** All valid amounts for a given tier (used by tests). */
export function validAmountsForTier(tier: AmountTier): number[] {
  return TIERS[tier].map((e) => e.amount);
}
