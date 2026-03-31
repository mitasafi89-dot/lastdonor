/**
 * Campaign API Integration Tests
 *
 * These tests require a running database (DATABASE_URL).
 * Run with: npm run test:integration
 */
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { clearDatabase, seedCampaign } from '../../../../../test/helpers';

describe('Campaign API Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Campaign listing', () => {
    it('returns only active and last_donor_zone campaigns', async () => {
      await seedCampaign({ slug: 'active-1', status: 'active' });
      await seedCampaign({ slug: 'ldz-1', status: 'last_donor_zone' });
      await seedCampaign({ slug: 'draft-1', status: 'draft' });
      await seedCampaign({ slug: 'completed-1', status: 'completed' });

      const activeCampaigns = await db
        .select()
        .from(schema.campaigns)
        .where(
          sql`${schema.campaigns.status} IN ('active', 'last_donor_zone')`,
        );

      expect(activeCampaigns).toHaveLength(2);
      const slugs = activeCampaigns.map((c) => c.slug);
      expect(slugs).toContain('active-1');
      expect(slugs).toContain('ldz-1');
      expect(slugs).not.toContain('draft-1');
      expect(slugs).not.toContain('completed-1');
    });

    it('filters by category', async () => {
      await seedCampaign({ slug: 'med-1', category: 'medical' });
      await seedCampaign({ slug: 'dis-1', category: 'disaster' });

      const medical = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.category, 'medical'));

      expect(medical).toHaveLength(1);
      expect(medical[0].slug).toBe('med-1');
    });

    it('paginates with cursor', async () => {
      // Create multiple campaigns
      for (let i = 0; i < 5; i++) {
        await seedCampaign({ slug: `campaign-${i}` });
      }

      const allCampaigns = await db
        .select()
        .from(schema.campaigns)
        .orderBy(schema.campaigns.id)
        .limit(3);

      expect(allCampaigns).toHaveLength(3);

      const nextPage = await db
        .select()
        .from(schema.campaigns)
        .where(sql`${schema.campaigns.id} > ${allCampaigns[2].id}`)
        .orderBy(schema.campaigns.id)
        .limit(3);

      expect(nextPage.length).toBeGreaterThan(0);
      expect(nextPage[0].id).not.toBe(allCampaigns[2].id);
    });
  });

  describe('Campaign by slug', () => {
    it('returns campaign data for active campaign', async () => {
      const created = await seedCampaign({ slug: 'find-me', status: 'active' });

      const [found] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.slug, 'find-me'))
        .limit(1);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Test Campaign');
    });

    it('returns nothing for draft campaign', async () => {
      await seedCampaign({ slug: 'hidden', status: 'draft' });

      const found = await db
        .select()
        .from(schema.campaigns)
        .where(
          sql`${schema.campaigns.slug} = 'hidden' AND ${schema.campaigns.status} IN ('active', 'last_donor_zone')`,
        )
        .limit(1);

      expect(found).toHaveLength(0);
    });
  });

  describe('Campaign creation', () => {
    it('creates a campaign with valid data', async () => {
      const [campaign] = await db
        .insert(schema.campaigns)
        .values({
          title: 'New Campaign',
          slug: 'new-campaign',
          status: 'draft',
          heroImageUrl: 'https://example.com/img.webp',
          storyHtml: '<p>Story content that is long enough to pass the minimum validation requirements.</p>',
          goalAmount: 500_000,
          category: 'medical',
          subjectName: 'Test Person',
        })
        .returning();

      expect(campaign).toBeDefined();
      expect(campaign.slug).toBe('new-campaign');
      expect(campaign.status).toBe('draft');
      expect(campaign.raisedAmount).toBe(0);
      expect(campaign.donorCount).toBe(0);
    });

    it('enforces unique slug constraint', async () => {
      await seedCampaign({ slug: 'unique-slug' });

      await expect(
        db.insert(schema.campaigns).values({
          title: 'Duplicate',
          slug: 'unique-slug',
          heroImageUrl: 'https://example.com/img.webp',
          storyHtml: '<p>Story content that is long enough to pass the minimum validation requirements.</p>',
          goalAmount: 500_000,
          category: 'medical',
          subjectName: 'Test Person',
        }),
      ).rejects.toThrow();
    });
  });
});
