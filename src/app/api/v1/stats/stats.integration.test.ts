/**
 * Stats API Integration Tests
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, sum, count, and } from 'drizzle-orm';
import { clearDatabase, seedCampaign, seedDonation } from '../../../../../test/helpers';

describe('Stats Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it('computes correct aggregate stats excluding seed donations', async () => {
    const campaign = await seedCampaign({ raisedAmount: 15000, donorCount: 3 });

    // Real donations
    await seedDonation(campaign.id, { amount: 5000, source: 'real', stripePaymentId: 'pi_r1' });
    await seedDonation(campaign.id, { amount: 5000, source: 'real', stripePaymentId: 'pi_r2' });
    await seedDonation(campaign.id, { amount: 5000, source: 'real', stripePaymentId: 'pi_r3' });

    // Seed donations (should be excluded from stats)
    await seedDonation(campaign.id, { amount: 10000, source: 'seed', stripePaymentId: 'pi_s1' });

    const [stats] = await db
      .select({
        totalRaised: sum(schema.donations.amount),
        totalDonors: count(),
      })
      .from(schema.donations)
      .where(
        and(
          eq(schema.donations.source, 'real'),
          eq(schema.donations.refunded, false),
        ),
      );

    expect(Number(stats.totalRaised)).toBe(15000);
    expect(stats.totalDonors).toBe(3);
  });

  it('excludes refunded donations from stats', async () => {
    const campaign = await seedCampaign();

    await seedDonation(campaign.id, { amount: 5000, source: 'real', stripePaymentId: 'pi_good' });
    await seedDonation(campaign.id, {
      amount: 5000,
      source: 'real',
      refunded: true,
      stripePaymentId: 'pi_refunded',
    });

    const [stats] = await db
      .select({
        totalRaised: sum(schema.donations.amount),
        totalDonors: count(),
      })
      .from(schema.donations)
      .where(
        and(
          eq(schema.donations.source, 'real'),
          eq(schema.donations.refunded, false),
        ),
      );

    expect(Number(stats.totalRaised)).toBe(5000);
    expect(stats.totalDonors).toBe(1);
  });
});
