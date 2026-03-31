import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeBuildCohort } from '@/lib/seed/donor-selector';
import type { Campaign } from '@/types';

// Build a minimal campaign object for testing (no DB needed for cohort generation)
function buildTestCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Campaign',
    slug: 'test-campaign',
    status: 'active',
    heroImageUrl: '/img.jpg',
    photoCredit: null,
    storyHtml: '<p>Test</p>',
    goalAmount: 1000000,
    raisedAmount: 200000,
    donorCount: 50,
    category: 'medical',
    location: 'Portland, OR',
    subjectName: 'Test Subject',
    subjectHometown: 'Portland, OR',
    impactTiers: [],
    campaignProfile: null,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    completedAt: null,
    lastDonorId: null,
    lastDonorName: null,
    lastDonorAmount: null,
    ...overrides,
  } as Campaign;
}

describe('maybeBuildCohort', () => {
  it('returns null or a valid cohort object', () => {
    const campaign = buildTestCampaign();
    // Run many times to check both null and non-null paths
    let gotNull = false;
    let gotCohort = false;

    for (let i = 0; i < 200; i++) {
      const result = maybeBuildCohort(campaign);
      if (result === null) {
        gotNull = true;
      } else {
        gotCohort = true;
        expect(['community_group', 'workplace_match', 'family_chain']).toContain(result.type);
        expect(result.donors.length).toBeGreaterThanOrEqual(2);

        for (const d of result.donors) {
          expect(typeof d.displayName).toBe('string');
          expect(d.displayName.length).toBeGreaterThan(0);
          expect(typeof d.displayLocation).toBe('string');
          expect(typeof d.isAnonymous).toBe('boolean');
          expect(d.donor).toBeDefined();
          expect(typeof d.donor.id).toBe('number');
        }

        if (result.type === 'family_chain') {
          expect(result.staggerMs).toBeDefined();
          expect(result.staggerMs!).toBeGreaterThanOrEqual(30 * 60 * 1000);
          expect(result.staggerMs!).toBeLessThanOrEqual(90 * 60 * 1000);
        }

        if (result.type === 'community_group') {
          expect(result.donors.length).toBeGreaterThanOrEqual(3);
        }

        if (result.type === 'workplace_match') {
          expect(result.donors.length).toBeGreaterThanOrEqual(5);
        }
      }
    }

    // Should produce both outcomes over 200 iterations
    expect(gotNull).toBe(true);
    expect(gotCohort).toBe(true);
  });

  it('family chain donors share a last name', () => {
    const campaign = buildTestCampaign();
    let checked = false;

    for (let i = 0; i < 500 && !checked; i++) {
      const result = maybeBuildCohort(campaign);
      if (result && result.type === 'family_chain') {
        // All donors should share the same last name from the underlying pool
        const lastNames = result.donors.map((d) => d.donor.lastName);
        const unique = new Set(lastNames);
        expect(unique.size).toBe(1);
        checked = true;
      }
    }

    // Should have found at least one family chain in 500 attempts
    expect(checked).toBe(true);
  });

  it('community group donors share a city', () => {
    const campaign = buildTestCampaign();
    let checked = false;

    for (let i = 0; i < 500 && !checked; i++) {
      const result = maybeBuildCohort(campaign);
      if (result && result.type === 'community_group') {
        // All donors should be from the same city
        const cities = result.donors.map((d) => `${d.donor.city}, ${d.donor.state}`);
        const unique = new Set(cities);
        expect(unique.size).toBe(1);
        checked = true;
      }
    }

    expect(checked).toBe(true);
  });

  it('workplace match donors share a region', () => {
    const campaign = buildTestCampaign();
    let checked = false;

    for (let i = 0; i < 500 && !checked; i++) {
      const result = maybeBuildCohort(campaign);
      if (result && result.type === 'workplace_match') {
        // All donors should be from the same region
        const regions = result.donors.map((d) => d.donor.region);
        const unique = new Set(regions);
        expect(unique.size).toBe(1);
        checked = true;
      }
    }

    expect(checked).toBe(true);
  });
});
