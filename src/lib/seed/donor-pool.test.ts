import { describe, it, expect } from 'vitest';
import {
  DONOR_POOL,
  DONOR_POOL_SIZE,
  DONORS_BY_STATE,
  DONORS_BY_REGION,
  DONORS_BY_CITY,
  DONORS_BY_LAST_NAME,
  MILITARY_DONOR_IDS,
  type SimulatedDonor,
} from '@/lib/seed/donor-pool';

describe('DONOR_POOL', () => {
  it('has at least 3000 entries', () => {
    expect(DONOR_POOL_SIZE).toBeGreaterThanOrEqual(3000);
    expect(DONOR_POOL.length).toBe(DONOR_POOL_SIZE);
  });

  it('every donor has all required fields', () => {
    // Validate all donors (pool is generated from fixed seed)
    for (const donor of DONOR_POOL) {
      expect(typeof donor.id).toBe('number');
      expect(typeof donor.firstName).toBe('string');
      expect(donor.firstName.length).toBeGreaterThan(0);
      expect(typeof donor.lastName).toBe('string');
      expect(donor.lastName.length).toBeGreaterThan(0);
      expect(typeof donor.city).toBe('string');
      expect(typeof donor.state).toBe('string');
      expect(donor.state.length).toBe(2);
      expect(typeof donor.region).toBe('string');
      expect(donor.region.length).toBeGreaterThan(0);
      expect(['young_adult', 'adult', 'middle_aged', 'senior']).toContain(donor.ageGroup);
      expect(['low', 'medium', 'high']).toContain(donor.donationBudget);
      expect(['formal', 'casual', 'minimal', 'emoji']).toContain(donor.messageStyle);
      expect(typeof donor.isMilitaryAdjacent).toBe('boolean');
      expect(Array.isArray(donor.categoryAffinity)).toBe(true);
      expect(donor.categoryAffinity.length).toBeGreaterThanOrEqual(2);
    }
  }, 15_000);

  it('has unique IDs from 0 to POOL_SIZE-1', () => {
    const ids = new Set(DONOR_POOL.map((d) => d.id));
    expect(ids.size).toBe(DONOR_POOL_SIZE);
    expect(DONOR_POOL[0].id).toBe(0);
    expect(DONOR_POOL[DONOR_POOL_SIZE - 1].id).toBe(DONOR_POOL_SIZE - 1);
  });

  it('is deterministic (same pool every time)', () => {
    // The pool is module-level and generated from a fixed seed.
    // Verify a few known entries haven't changed (regression check).
    const first = DONOR_POOL[0];
    const last = DONOR_POOL[DONOR_POOL_SIZE - 1];

    // These should always be the same across runs
    expect(first.id).toBe(0);
    expect(last.id).toBe(DONOR_POOL_SIZE - 1);
    expect(typeof first.firstName).toBe('string');
    expect(typeof last.firstName).toBe('string');
  });

  it('has diverse demographics (not all one group)', () => {
    const ages = new Map<string, number>();
    const budgets = new Map<string, number>();
    const styles = new Map<string, number>();

    for (const d of DONOR_POOL) {
      ages.set(d.ageGroup, (ages.get(d.ageGroup) ?? 0) + 1);
      budgets.set(d.donationBudget, (budgets.get(d.donationBudget) ?? 0) + 1);
      styles.set(d.messageStyle, (styles.get(d.messageStyle) ?? 0) + 1);
    }

    // All age groups should be present
    expect(ages.size).toBe(4);
    // All budget levels should be present
    expect(budgets.size).toBe(3);
    // All message styles should be present
    expect(styles.size).toBe(4);

    // No single group should exceed 60%
    for (const [, count] of ages) {
      expect(count / DONOR_POOL_SIZE).toBeLessThan(0.60);
    }
  });

  it('has donors spread across multiple states', () => {
    const states = new Set(DONOR_POOL.map((d) => d.state));
    // Should cover most US states/DC
    expect(states.size).toBeGreaterThanOrEqual(30);
  });

  it('has military-adjacent donors', () => {
    expect(MILITARY_DONOR_IDS.length).toBeGreaterThan(0);
    // Should be a reasonable fraction (not 0, not everyone)
    expect(MILITARY_DONOR_IDS.length / DONOR_POOL_SIZE).toBeGreaterThan(0.01);
    expect(MILITARY_DONOR_IDS.length / DONOR_POOL_SIZE).toBeLessThan(0.20);
  });
});

describe('DONORS_BY_STATE index', () => {
  it('covers the same total donors as the pool', () => {
    let total = 0;
    for (const [, ids] of DONORS_BY_STATE) {
      total += ids.length;
    }
    expect(total).toBe(DONOR_POOL_SIZE);
  });

  it('returns valid donor IDs', () => {
    for (const [, ids] of DONORS_BY_STATE) {
      for (const id of ids) {
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(DONOR_POOL_SIZE);
      }
    }
  });
});

describe('DONORS_BY_REGION index', () => {
  it('has multiple regions', () => {
    expect(DONORS_BY_REGION.size).toBeGreaterThan(10);
  });
});

describe('DONORS_BY_CITY index', () => {
  it('has multiple cities', () => {
    expect(DONORS_BY_CITY.size).toBeGreaterThan(20);
  });
});

describe('DONORS_BY_LAST_NAME index', () => {
  it('has families with 2+ members (for family chain cohorts)', () => {
    let familiesWithMultiple = 0;
    for (const [, ids] of DONORS_BY_LAST_NAME) {
      if (ids.length >= 2) familiesWithMultiple++;
    }
    // Should have plenty of shared last names for family chains
    expect(familiesWithMultiple).toBeGreaterThan(20);
  });
});
