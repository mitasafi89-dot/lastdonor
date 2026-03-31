import { describe, it, expect } from 'vitest';
import { generateSeedAmount, seedAmountCents, validAmountsForTier } from '@/lib/seed/amount-generator';
import type { AmountTier } from '@/lib/seed/trajectory-profiles';

const TIERS: AmountTier[] = ['low', 'mid', 'high'];

describe('generateSeedAmount', () => {
  it.each(TIERS)('only produces valid psychological amounts for %s tier', (tier) => {
    const valid = new Set(validAmountsForTier(tier));
    for (let i = 0; i < 1000; i++) {
      const amount = generateSeedAmount(tier);
      expect(valid.has(amount)).toBe(true);
    }
  });

  it('low tier never exceeds $500', () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateSeedAmount('low')).toBeLessThanOrEqual(500);
    }
  });

  it('mid tier allows up to $2,500 but not $5,000', () => {
    const valid = validAmountsForTier('mid');
    expect(valid).toContain(2500);
    expect(valid).not.toContain(5000);
  });

  it('high tier includes the $5,000 amount', () => {
    const valid = validAmountsForTier('high');
    expect(valid).toContain(5000);
  });

  it('distribution skews toward common amounts ($25, $50, $100)', () => {
    const counts = new Map<number, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const a = generateSeedAmount('mid');
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    // $25 and $50 should each appear at least 15% of the time
    expect((counts.get(25) ?? 0) / N).toBeGreaterThan(0.15);
    expect((counts.get(50) ?? 0) / N).toBeGreaterThan(0.15);
    // $100 should appear at least 10%
    expect((counts.get(100) ?? 0) / N).toBeGreaterThan(0.10);
  });

  it('defaults to mid tier when no argument passed', () => {
    const valid = new Set(validAmountsForTier('mid'));
    for (let i = 0; i < 500; i++) {
      expect(valid.has(generateSeedAmount())).toBe(true);
    }
  });
});

describe('seedAmountCents', () => {
  it('returns amount in cents (100x the dollar amount)', () => {
    const validMid = new Set(validAmountsForTier('mid').map((a) => a * 100));
    for (let i = 0; i < 200; i++) {
      const cents = seedAmountCents('mid');
      expect(cents % 100).toBe(0);
      expect(validMid.has(cents)).toBe(true);
    }
  });

  it('accepts a tier parameter', () => {
    const validLow = new Set(validAmountsForTier('low').map((a) => a * 100));
    for (let i = 0; i < 200; i++) {
      expect(validLow.has(seedAmountCents('low'))).toBe(true);
    }
  });
});
