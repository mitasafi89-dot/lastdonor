/**
 * Compute a lower starting goal for automated goal setting.
 * Uses piecewise linear interpolation in log10 space, capped at $2,600.
 *
 * Anchor points (matching GoFundMe):
 *   $100     → $100
 *   $1,000   → $300
 *   $10,000  → $600
 *   $100,000 → $1,200
 *   $1M+     → $2,600 (cap)
 */
export function computeStartingGoal(amount: number): number {
  if (amount <= 0) return 0;
  if (amount <= 100) return amount;
  if (amount >= 1_000_000) return 2600;

  const tiers = [
    { amt: 100, goal: 100 },
    { amt: 1_000, goal: 300 },
    { amt: 10_000, goal: 600 },
    { amt: 100_000, goal: 1_200 },
    { amt: 1_000_000, goal: 2_600 },
  ];

  const log = Math.log10(amount);
  for (let i = 0; i < tiers.length - 1; i++) {
    const logLow = Math.log10(tiers[i].amt);
    const logHigh = Math.log10(tiers[i + 1].amt);
    if (log <= logHigh) {
      const t = (log - logLow) / (logHigh - logLow);
      return Math.round(tiers[i].goal + t * (tiers[i + 1].goal - tiers[i].goal));
    }
  }

  return 2600;
}
