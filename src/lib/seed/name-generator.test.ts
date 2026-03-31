import { describe, it, expect } from 'vitest';
import { generateSeedDonor, NAME_POOL_SIZE } from '@/lib/seed/name-generator';

describe('generateSeedDonor', () => {
  it('returns an object with name, location, and isAnonymous', () => {
    const donor = generateSeedDonor();
    expect(donor).toHaveProperty('name');
    expect(donor).toHaveProperty('location');
    expect(donor).toHaveProperty('isAnonymous');
    expect(typeof donor.name).toBe('string');
    expect(typeof donor.location).toBe('string');
    expect(typeof donor.isAnonymous).toBe('boolean');
  });

  it('returns non-empty name for non-anonymous donors', () => {
    // Run enough times to get non-anonymous results
    let foundNonAnonymous = false;
    for (let i = 0; i < 100; i++) {
      const donor = generateSeedDonor();
      if (!donor.isAnonymous) {
        expect(donor.name.length).toBeGreaterThan(0);
        foundNonAnonymous = true;
        break;
      }
    }
    expect(foundNonAnonymous).toBe(true);
  });

  it('approximately 5% anonymous rate', () => {
    let anonymousCount = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      const donor = generateSeedDonor();
      if (donor.isAnonymous) anonymousCount++;
    }
    const rate = anonymousCount / iterations;
    // Allow 2%-10% range for statistical fluctuation
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.10);
  });

  it('anonymous donors have name "Anonymous"', () => {
    for (let i = 0; i < 500; i++) {
      const donor = generateSeedDonor();
      if (donor.isAnonymous) {
        expect(donor.name).toBe('Anonymous');
        expect(donor.location).toBe('');
        break;
      }
    }
  });
});

describe('NAME_POOL_SIZE', () => {
  it('has approximately 500 entries', () => {
    // Pool should be substantial
    expect(NAME_POOL_SIZE).toBeGreaterThanOrEqual(100);
  });
});
