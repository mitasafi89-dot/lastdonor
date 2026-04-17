import { describe, it, expect } from 'vitest';
import {
  getActiveSurgeMultiplier,
  generateTrajectoryProfile,
  type SurgeState,
} from './trajectory-profiles';
import type { TrajectoryProfile, CampaignCategory } from '@/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildTestProfile(overrides: Partial<TrajectoryProfile> = {}): TrajectoryProfile {
  return {
    type: 'steady',
    targetDays: 14,
    baseDonateChance: 0.55,
    phaseMultipliers: {
      first_believers: 0.90,
      the_push: 1.0,
      closing_in: 1.10,
      last_donor_zone: 1.20,
    },
    donationsPerCycle: { min: 1, max: 3 },
    surges: [
      { atPercent: 25, multiplier: 1.5, durationCycles: 2, label: 'First milestone' },
      { atPercent: 50, multiplier: 1.6, durationCycles: 3, label: 'Halfway share' },
      { atPercent: 75, multiplier: 1.8, durationCycles: 4, label: 'Three-quarter push' },
    ],
    amountTier: 'mid',
    localDonorWeight: 0.25,
    ...overrides,
  };
}

// ── getActiveSurgeMultiplier ────────────────────────────────────────────────

describe('getActiveSurgeMultiplier', () => {
  describe('surge activation', () => {
    it('returns 1.0 when no surge threshold is crossed', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      const result = getActiveSurgeMultiplier(profile, 10, 100, surgeState);
      expect(result).toBe(1.0);
      expect(Object.keys(surgeState)).toHaveLength(0);
    });

    it('activates surge when crossing threshold for the first time', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      const result = getActiveSurgeMultiplier(profile, 30, 100, surgeState);
      expect(result).toBe(1.5);
      expect(surgeState[25]).toBe(100);
    });

    it('activates multiple surges simultaneously if past multiple thresholds', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      const result = getActiveSurgeMultiplier(profile, 60, 100, surgeState);
      // Both 25% and 50% surges activated, max multiplier wins
      expect(result).toBe(1.6);
      expect(surgeState[25]).toBe(100);
      expect(surgeState[50]).toBe(100);
    });
  });

  describe('surge duration tracking', () => {
    it('keeps surge active within its durationCycles', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 100 }; // Triggered at cycle 100
      // Current cycle 101 - 1 cycle elapsed, duration is 2 cycles
      const result = getActiveSurgeMultiplier(profile, 30, 101, surgeState);
      expect(result).toBe(1.5);
    });

    it('expires surge exactly at durationCycles boundary', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 100 }; // Triggered at cycle 100
      // Current cycle 102 - 2 cycles elapsed, duration is 2 cycles (expired)
      const result = getActiveSurgeMultiplier(profile, 30, 102, surgeState);
      expect(result).toBe(1.0);
    });

    it('expires surge beyond durationCycles', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 100 };
      // Current cycle 200 - well past the 2-cycle duration
      const result = getActiveSurgeMultiplier(profile, 30, 200, surgeState);
      expect(result).toBe(1.0);
    });

    it('does not re-trigger an expired surge', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 100 };
      // Surge at 25% expired (cycle 200, duration was 2)
      // Still above 25% - should NOT re-trigger
      const result = getActiveSurgeMultiplier(profile, 30, 200, surgeState);
      expect(result).toBe(1.0);
      // The trigger cycle should remain unchanged (not reset)
      expect(surgeState[25]).toBe(100);
    });
  });

  describe('multi-surge lifecycle', () => {
    it('handles first surge expiring while second is still active', () => {
      const profile = buildTestProfile();
      // Surge at 25% triggered at cycle 100 (duration 2), surge at 50% triggered at cycle 110 (duration 3)
      const surgeState: SurgeState = { 25: 100, 50: 110 };
      // At cycle 112: 25% expired (12 cycles > 2), 50% still active (2 cycles < 3)
      const result = getActiveSurgeMultiplier(profile, 60, 112, surgeState);
      expect(result).toBe(1.6); // Only 50% surge active
    });

    it('returns 1.0 when all surges have expired', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 100, 50: 110, 75: 120 };
      // All expired at cycle 500
      const result = getActiveSurgeMultiplier(profile, 80, 500, surgeState);
      expect(result).toBe(1.0);
    });

    it('returns max multiplier when multiple surges are concurrently active', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 99, 50: 100 };
      // Both active at cycle 100: 25% has 1 of 2 cycles left, 50% just triggered
      const result = getActiveSurgeMultiplier(profile, 52, 100, surgeState);
      expect(result).toBe(1.6); // max(1.5, 1.6) = 1.6
    });
  });

  describe('surge state mutation', () => {
    it('records trigger cycle in surgeState for new surges', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      getActiveSurgeMultiplier(profile, 80, 150, surgeState);
      expect(surgeState[25]).toBe(150);
      expect(surgeState[50]).toBe(150);
      expect(surgeState[75]).toBe(150);
    });

    it('does not modify trigger cycle of existing surges', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 100 };
      getActiveSurgeMultiplier(profile, 30, 101, surgeState);
      expect(surgeState[25]).toBe(100); // Unchanged
    });

    it('leaves surgeState empty when below all thresholds', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      getActiveSurgeMultiplier(profile, 5, 50, surgeState);
      expect(Object.keys(surgeState)).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles profile with no surges', () => {
      const profile = buildTestProfile({ surges: [] });
      const surgeState: SurgeState = {};
      const result = getActiveSurgeMultiplier(profile, 80, 100, surgeState);
      expect(result).toBe(1.0);
    });

    it('handles exactly-at-threshold percentage', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      const result = getActiveSurgeMultiplier(profile, 25, 100, surgeState);
      expect(result).toBe(1.5);
      expect(surgeState[25]).toBe(100);
    });

    it('handles 0% percentage', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = {};
      const result = getActiveSurgeMultiplier(profile, 0, 0, surgeState);
      expect(result).toBe(1.0);
    });

    it('handles 100% percentage with all surges expired', () => {
      const profile = buildTestProfile();
      const surgeState: SurgeState = { 25: 0, 50: 10, 75: 20 };
      const result = getActiveSurgeMultiplier(profile, 100, 100, surgeState);
      expect(result).toBe(1.0);
    });

    it('handles 1-cycle duration surges', () => {
      const profile = buildTestProfile({
        surges: [{ atPercent: 50, multiplier: 2.0, durationCycles: 1, label: 'Flash' }],
      });
      const surgeState: SurgeState = {};
      // Cycle 100: trigger
      expect(getActiveSurgeMultiplier(profile, 55, 100, surgeState)).toBe(2.0);
      // Cycle 101: expired (1 cycle elapsed = duration)
      expect(getActiveSurgeMultiplier(profile, 55, 101, surgeState)).toBe(1.0);
    });
  });
});

// ── generateTrajectoryProfile ───────────────────────────────────────────────

describe('generateTrajectoryProfile', () => {
  const categories: CampaignCategory[] = [
    'military', 'veterans', 'first-responders', 'disaster', 'medical',
    'memorial', 'community', 'essential-needs', 'emergency', 'charity',
    'education', 'animal', 'environment', 'business', 'competition',
    'creative', 'event', 'faith', 'family', 'sports', 'travel',
    'volunteer', 'wishes',
  ];

  it('returns a valid profile for every category', () => {
    for (const category of categories) {
      const profile = generateTrajectoryProfile(category, 1_000_000);
      expect(profile.type).toBeDefined();
      expect(['viral', 'steady', 'slow_burn', 'surge_late']).toContain(profile.type);
      expect(profile.targetDays).toBeGreaterThanOrEqual(1);
      expect(profile.baseDonateChance).toBeGreaterThan(0);
      expect(profile.baseDonateChance).toBeLessThanOrEqual(1);
      expect(profile.surges.length).toBeGreaterThanOrEqual(1);
      expect(['low', 'mid', 'high']).toContain(profile.amountTier);
      expect(profile.donationsPerCycle.min).toBeLessThanOrEqual(profile.donationsPerCycle.max);
      expect(typeof profile.localDonorWeight).toBe('number');
    }
  });

  it('assigns correct amount tiers based on goal', () => {
    // Low tier: <=10K
    for (let i = 0; i < 10; i++) {
      const profile = generateTrajectoryProfile('medical', 500_000); // $5K
      expect(profile.amountTier).toBe('low');
    }
    // Mid tier: 10K-25K
    for (let i = 0; i < 10; i++) {
      const profile = generateTrajectoryProfile('medical', 1_500_000); // $15K
      expect(profile.amountTier).toBe('mid');
    }
    // High tier: >25K
    for (let i = 0; i < 10; i++) {
      const profile = generateTrajectoryProfile('medical', 5_000_000); // $50K
      expect(profile.amountTier).toBe('high');
    }
  });

  it('generates surges with valid durations', () => {
    for (let i = 0; i < 50; i++) {
      const profile = generateTrajectoryProfile(
        categories[i % categories.length],
        1_000_000,
      );
      for (const surge of profile.surges) {
        expect(surge.durationCycles).toBeGreaterThanOrEqual(1);
        expect(surge.multiplier).toBeGreaterThan(1.0);
        expect(surge.atPercent).toBeGreaterThanOrEqual(0);
        expect(surge.atPercent).toBeLessThanOrEqual(100);
        expect(typeof surge.label).toBe('string');
        expect(surge.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('generates target days within archetype range', () => {
    const ranges: Record<string, { min: number; max: number }> = {
      viral: { min: 1, max: 3 },
      steady: { min: 10, max: 21 },
      slow_burn: { min: 30, max: 60 },
      surge_late: { min: 14, max: 35 },
    };

    for (let i = 0; i < 100; i++) {
      const profile = generateTrajectoryProfile(
        categories[i % categories.length],
        1_000_000,
      );
      const range = ranges[profile.type];
      expect(profile.targetDays).toBeGreaterThanOrEqual(range.min);
      expect(profile.targetDays).toBeLessThanOrEqual(range.max);
    }
  });
});
