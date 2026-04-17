/**
 * Campaign Filters Integration Tests
 *
 * Verifies that every filter parameter (category, q, location,
 * close_to_target, sort) is correctly applied at the database level.
 * 
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or, desc, asc, sql, ilike, gte } from 'drizzle-orm';
import { clearDatabase, seedCampaign } from '../../../test/helpers';

/* ------------------------------------------------------------------ */
/*  Shared query builder - mirrors page.tsx & route.ts logic          */
/* ------------------------------------------------------------------ */

type CampaignCategory = typeof campaigns.$inferSelect['category'];

const VALID_CATEGORIES: CampaignCategory[] = [
  'medical', 'memorial', 'emergency', 'charity', 'education', 'animal',
  'environment', 'business', 'community', 'competition', 'creative', 'event',
  'faith', 'family', 'sports', 'travel', 'volunteer', 'wishes',
  'military', 'veterans', 'first-responders', 'disaster', 'essential-needs',
];

function buildCampaignQuery(params: {
  category?: string | null;
  q?: string;
  location?: string;
  close_to_target?: boolean;
  sort?: string;
}) {
  const statusFilter = or(
    eq(campaigns.status, 'active'),
    eq(campaigns.status, 'last_donor_zone'),
  )!;

  const filterParts = [statusFilter];

  if (params.category && VALID_CATEGORIES.includes(params.category as CampaignCategory)) {
    filterParts.push(eq(campaigns.category, params.category as CampaignCategory));
  }

  if (params.q) {
    const pattern = `%${params.q}%`;
    filterParts.push(
      or(
        ilike(campaigns.title, pattern),
        ilike(campaigns.subjectName, pattern),
        ilike(campaigns.location, pattern),
        ilike(campaigns.subjectHometown, pattern),
      )!,
    );
  }

  if (params.location) {
    const locPattern = `%${params.location}%`;
    filterParts.push(
      or(
        ilike(campaigns.location, locPattern),
        ilike(campaigns.subjectHometown, locPattern),
      )!,
    );
  }

  if (params.close_to_target) {
    filterParts.push(
      gte(
        sql`(${campaigns.raisedAmount}::float / NULLIF(${campaigns.goalAmount}, 0))`,
        0.9,
      ),
    );
  }

  const conditions = and(...filterParts)!;

  const orderBy = (() => {
    switch (params.sort) {
      case 'most_funded':
        return desc(campaigns.raisedAmount);
      case 'least_funded':
        return asc(campaigns.raisedAmount);
      case 'closing_soon':
        return desc(sql`(${campaigns.raisedAmount}::float / NULLIF(${campaigns.goalAmount}, 0))`);
      case 'newest':
      default:
        return desc(campaigns.publishedAt);
    }
  })();

  return { conditions, orderBy };
}

async function queryCampaigns(params: Parameters<typeof buildCampaignQuery>[0]) {
  const { conditions, orderBy } = buildCampaignQuery(params);
  return db
    .select({ id: campaigns.id, title: campaigns.title, slug: campaigns.slug })
    .from(campaigns)
    .where(conditions)
    .orderBy(orderBy);
}

/* ------------------------------------------------------------------ */
/*  Test data setup                                                   */
/* ------------------------------------------------------------------ */

describe('Campaign Filters – DB Integration', () => {
  beforeAll(async () => {
    await clearDatabase();

    // Seed diverse campaigns for filter testing
    await seedCampaign({
      title: 'Help Veterans in Texas',
      slug: 'help-veterans-texas',
      category: 'veterans',
      location: 'Austin, TX',
      subjectName: 'Sgt. Mike Johnson',
      subjectHometown: 'Dallas, TX',
      raisedAmount: 450_000, // 90% of 500k goal
      goalAmount: 500_000,
      publishedAt: new Date('2026-01-01'),
      status: 'active',
    });

    await seedCampaign({
      title: 'Medical Bills for Sarah',
      slug: 'medical-bills-sarah',
      category: 'medical',
      location: 'Portland, OR',
      subjectName: 'Sarah Williams',
      subjectHometown: 'Portland, OR',
      raisedAmount: 100_000, // 20% of 500k
      goalAmount: 500_000,
      publishedAt: new Date('2026-02-01'),
      status: 'active',
    });

    await seedCampaign({
      title: 'Disaster Relief California',
      slug: 'disaster-relief-california',
      category: 'disaster',
      location: 'San Diego, CA',
      subjectName: 'The Martinez Family',
      subjectHometown: 'San Diego, CA',
      raisedAmount: 480_000, // 96% of 500k
      goalAmount: 500_000,
      publishedAt: new Date('2026-03-01'),
      status: 'active',
    });

    await seedCampaign({
      title: 'Community Center Rebuild',
      slug: 'community-center-rebuild',
      category: 'community',
      location: 'Austin, TX',
      subjectName: 'Austin Community Org',
      subjectHometown: 'Austin, TX',
      raisedAmount: 250_000,
      goalAmount: 500_000,
      publishedAt: new Date('2026-01-15'),
      status: 'active',
    });

    // Completed campaign - should never appear
    await seedCampaign({
      title: 'Completed Campaign',
      slug: 'completed-campaign',
      category: 'medical',
      location: 'NYC, NY',
      subjectName: 'Completed Person',
      subjectHometown: 'NYC, NY',
      raisedAmount: 500_000,
      goalAmount: 500_000,
      publishedAt: new Date('2025-12-01'),
      status: 'completed',
    });
  });

  afterAll(async () => {
    await clearDatabase();
  });

  // ────────────────────────────────────────────────────────
  //  STATUS FILTER (baseline)
  // ────────────────────────────────────────────────────────

  it('only returns active or last_donor_zone campaigns', async () => {
    const results = await queryCampaigns({});
    expect(results.length).toBe(4);
    expect(results.find((c) => c.slug === 'completed-campaign')).toBeUndefined();
  });

  // ────────────────────────────────────────────────────────
  //  CATEGORY FILTER
  // ────────────────────────────────────────────────────────

  describe('Category filter', () => {
    it('filters by veterans category', async () => {
      const results = await queryCampaigns({ category: 'veterans' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('help-veterans-texas');
    });

    it('filters by medical category', async () => {
      const results = await queryCampaigns({ category: 'medical' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('medical-bills-sarah');
    });

    it('returns all when category is null', async () => {
      const results = await queryCampaigns({ category: null });
      expect(results.length).toBe(4);
    });

    it('returns all when category is invalid', async () => {
      const results = await queryCampaigns({ category: 'not-a-real-category' });
      expect(results.length).toBe(4);
    });
  });

  // ────────────────────────────────────────────────────────
  //  TEXT SEARCH (q param)
  // ────────────────────────────────────────────────────────

  describe('Text search (q)', () => {
    it('searches by title', async () => {
      const results = await queryCampaigns({ q: 'disaster relief' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('disaster-relief-california');
    });

    it('searches by subject name', async () => {
      const results = await queryCampaigns({ q: 'sarah' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('medical-bills-sarah');
    });

    it('searches by location field', async () => {
      const results = await queryCampaigns({ q: 'portland' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('medical-bills-sarah');
    });

    it('searches by subject hometown', async () => {
      const results = await queryCampaigns({ q: 'dallas' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('help-veterans-texas');
    });

    it('is case-insensitive', async () => {
      const results = await queryCampaigns({ q: 'VETERANS' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('help-veterans-texas');
    });

    it('returns empty for non-matching query', async () => {
      const results = await queryCampaigns({ q: 'zzz-nonexistent-zzz' });
      expect(results.length).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────
  //  LOCATION FILTER
  // ────────────────────────────────────────────────────────

  describe('Location filter', () => {
    it('filters by location text', async () => {
      const results = await queryCampaigns({ location: 'Austin' });
      expect(results.length).toBe(2); // veterans + community both in Austin
      const slugs = results.map((r) => r.slug).sort();
      expect(slugs).toEqual(['community-center-rebuild', 'help-veterans-texas']);
    });

    it('filters by hometown (Dallas is only in subjectHometown for veterans)', async () => {
      const results = await queryCampaigns({ location: 'Dallas' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('help-veterans-texas');
    });

    it('is case-insensitive', async () => {
      const results = await queryCampaigns({ location: 'san diego' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('disaster-relief-california');
    });

    it('returns empty for non-matching location', async () => {
      const results = await queryCampaigns({ location: 'Antarctica' });
      expect(results.length).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────
  //  CLOSE TO TARGET
  // ────────────────────────────────────────────────────────

  describe('Close to target', () => {
    it('returns only campaigns ≥90% funded', async () => {
      const results = await queryCampaigns({ close_to_target: true });
      expect(results.length).toBe(2);
      const slugs = results.map((r) => r.slug).sort();
      expect(slugs).toEqual(['disaster-relief-california', 'help-veterans-texas']);
    });

    it('returns all campaigns when close_to_target is false', async () => {
      const results = await queryCampaigns({ close_to_target: false });
      expect(results.length).toBe(4);
    });
  });

  // ────────────────────────────────────────────────────────
  //  SORT
  // ────────────────────────────────────────────────────────

  describe('Sort', () => {
    it('sorts by newest (default) - most recent publishedAt first', async () => {
      const results = await queryCampaigns({ sort: 'newest' });
      expect(results[0].slug).toBe('disaster-relief-california'); // Mar 2026
      expect(results[results.length - 1].slug).toBe('help-veterans-texas'); // Jan 2026
    });

    it('sorts by most_funded - highest raisedAmount first', async () => {
      const results = await queryCampaigns({ sort: 'most_funded' });
      expect(results[0].slug).toBe('disaster-relief-california'); // 480k
      expect(results[1].slug).toBe('help-veterans-texas'); // 450k
    });

    it('sorts by least_funded - lowest raisedAmount first', async () => {
      const results = await queryCampaigns({ sort: 'least_funded' });
      expect(results[0].slug).toBe('medical-bills-sarah'); // 100k
    });

    it('sorts by closing_soon - highest funded ratio first', async () => {
      const results = await queryCampaigns({ sort: 'closing_soon' });
      expect(results[0].slug).toBe('disaster-relief-california'); // 96%
      expect(results[1].slug).toBe('help-veterans-texas'); // 90%
    });
  });

  // ────────────────────────────────────────────────────────
  //  COMBINED FILTERS
  // ────────────────────────────────────────────────────────

  describe('Combined filters', () => {
    it('category + location narrows correctly', async () => {
      const results = await queryCampaigns({ category: 'veterans', location: 'Austin' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('help-veterans-texas');
    });

    it('category + close_to_target combined', async () => {
      const results = await queryCampaigns({ category: 'disaster', close_to_target: true });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('disaster-relief-california');
    });

    it('q + location combined - both must match', async () => {
      // "sarah" matches medical-bills-sarah and "Portland" matches same
      const results = await queryCampaigns({ q: 'sarah', location: 'Portland' });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('medical-bills-sarah');
    });

    it('q + location where they refer to different campaigns → empty', async () => {
      // "sarah" matches medical (Portland) but "Austin" matches veterans/community
      const results = await queryCampaigns({ q: 'sarah', location: 'Austin' });
      expect(results.length).toBe(0);
    });

    it('close_to_target + sort by least_funded', async () => {
      const results = await queryCampaigns({ close_to_target: true, sort: 'least_funded' });
      expect(results.length).toBe(2);
      expect(results[0].slug).toBe('help-veterans-texas'); // 450k < 480k
      expect(results[1].slug).toBe('disaster-relief-california');
    });

    it('all filters combined - category + q + location + close_to_target', async () => {
      // Veterans + "johnson" + Austin + close to target → only veterans campaign matches all
      const results = await queryCampaigns({
        category: 'veterans',
        q: 'johnson',
        location: 'Austin',
        close_to_target: true,
      });
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe('help-veterans-texas');
    });

    it('all filters combined - contradicting → empty', async () => {
      const results = await queryCampaigns({
        category: 'medical',
        q: 'johnson',
        location: 'Austin',
        close_to_target: true,
      });
      expect(results.length).toBe(0);
    });
  });
});
