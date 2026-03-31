/**
 * Donation Flow Integration Tests
 *
 * Tests critical donation paths at the database level.
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, sum, count } from 'drizzle-orm';
import { clearDatabase, seedCampaign, seedDonation } from '../../../../../test/helpers';

describe('Donation Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Donation creation', () => {
    it('creates a donation and atomically updates campaign totals', async () => {
      const campaign = await seedCampaign({ raisedAmount: 0, donorCount: 0 });
      const donationAmount = 5000; // $50

      // Insert donation
      await db.insert(schema.donations).values({
        campaignId: campaign.id,
        stripePaymentId: `pi_test_${Date.now()}`,
        amount: donationAmount,
        donorName: 'Jane',
        donorEmail: 'jane@test.com',
        phaseAtTime: 'first_believers',
        source: 'real',
      });

      // Atomic update
      await db
        .update(schema.campaigns)
        .set({
          raisedAmount: sql`${schema.campaigns.raisedAmount} + ${donationAmount}`,
          donorCount: sql`${schema.campaigns.donorCount} + 1`,
        })
        .where(eq(schema.campaigns.id, campaign.id));

      const [updated] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(updated.raisedAmount).toBe(5000);
      expect(updated.donorCount).toBe(1);
    });

    it('enforces minimum donation amount of 500 cents via DB check', async () => {
      const campaign = await seedCampaign();

      await expect(
        db.insert(schema.donations).values({
          campaignId: campaign.id,
          stripePaymentId: 'pi_too_small',
          amount: 499, // Below $5.00 minimum
          donorName: 'Cheap',
          donorEmail: 'cheap@test.com',
          phaseAtTime: 'first_believers',
          source: 'real',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Financial invariants', () => {
    it('campaign.raisedAmount equals SUM(donations.amount) for non-refunded', async () => {
      const campaign = await seedCampaign({ raisedAmount: 0, donorCount: 0 });

      // Create 3 donations
      const amounts = [5000, 10000, 2500];
      for (const amount of amounts) {
        await seedDonation(campaign.id, { amount, stripePaymentId: `pi_${Date.now()}_${amount}` });
        await db
          .update(schema.campaigns)
          .set({
            raisedAmount: sql`${schema.campaigns.raisedAmount} + ${amount}`,
            donorCount: sql`${schema.campaigns.donorCount} + 1`,
          })
          .where(eq(schema.campaigns.id, campaign.id));
      }

      // Verify invariant
      const [{ total }] = await db
        .select({ total: sum(schema.donations.amount) })
        .from(schema.donations)
        .where(
          sql`${schema.donations.campaignId} = ${campaign.id} AND ${schema.donations.refunded} = false`,
        );

      const [updatedCampaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(updatedCampaign.raisedAmount).toBe(Number(total));
    });

    it('campaign.donorCount equals COUNT(donations) for non-refunded', async () => {
      const campaign = await seedCampaign({ raisedAmount: 0, donorCount: 0 });

      for (let i = 0; i < 4; i++) {
        await seedDonation(campaign.id, { stripePaymentId: `pi_count_${i}` });
        await db
          .update(schema.campaigns)
          .set({
            raisedAmount: sql`${schema.campaigns.raisedAmount} + 5000`,
            donorCount: sql`${schema.campaigns.donorCount} + 1`,
          })
          .where(eq(schema.campaigns.id, campaign.id));
      }

      const [{ donationCount }] = await db
        .select({ donationCount: count() })
        .from(schema.donations)
        .where(
          sql`${schema.donations.campaignId} = ${campaign.id} AND ${schema.donations.refunded} = false`,
        );

      const [updatedCampaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(updatedCampaign.donorCount).toBe(donationCount);
    });
  });

  describe('Campaign completion', () => {
    it('marks campaign as completed when goal is met', async () => {
      const campaign = await seedCampaign({ goalAmount: 10000, raisedAmount: 5000 });

      // Final donation that meets the goal
      const finalAmount = 5000;
      await seedDonation(campaign.id, {
        amount: finalAmount,
        stripePaymentId: 'pi_final',
      });

      await db
        .update(schema.campaigns)
        .set({
          raisedAmount: sql`${schema.campaigns.raisedAmount} + ${finalAmount}`,
          donorCount: sql`${schema.campaigns.donorCount} + 1`,
        })
        .where(eq(schema.campaigns.id, campaign.id));

      // Check if goal is met
      const [updated] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      if (updated.raisedAmount >= updated.goalAmount) {
        await db
          .update(schema.campaigns)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(schema.campaigns.id, campaign.id));
      }

      const [completed] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.raisedAmount).toBe(10000);
    });
  });

  describe('Refund handling', () => {
    it('marks donation as refunded and decrements campaign totals', async () => {
      const campaign = await seedCampaign({ raisedAmount: 10000, donorCount: 2 });
      const donation = await seedDonation(campaign.id, {
        amount: 5000,
        stripePaymentId: 'pi_refund_test',
      });

      // Process refund
      await db
        .update(schema.donations)
        .set({ refunded: true })
        .where(eq(schema.donations.id, donation.id));

      await db
        .update(schema.campaigns)
        .set({
          raisedAmount: sql`${schema.campaigns.raisedAmount} - ${donation.amount}`,
          donorCount: sql`${schema.campaigns.donorCount} - 1`,
        })
        .where(eq(schema.campaigns.id, campaign.id));

      const [updatedCampaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      const [refundedDonation] = await db
        .select()
        .from(schema.donations)
        .where(eq(schema.donations.id, donation.id));

      expect(refundedDonation.refunded).toBe(true);
      expect(updatedCampaign.raisedAmount).toBe(5000);
      expect(updatedCampaign.donorCount).toBe(1);
    });
  });

  describe('Seed vs real donations', () => {
    it('distinguishes seed and real donation sources', async () => {
      const campaign = await seedCampaign();

      await seedDonation(campaign.id, { source: 'real', stripePaymentId: 'pi_real' });
      await seedDonation(campaign.id, { source: 'seed', stripePaymentId: 'pi_seed' });

      const [{ realCount }] = await db
        .select({ realCount: count() })
        .from(schema.donations)
        .where(
          sql`${schema.donations.campaignId} = ${campaign.id} AND ${schema.donations.source} = 'real'`,
        );

      const [{ seedCount }] = await db
        .select({ seedCount: count() })
        .from(schema.donations)
        .where(
          sql`${schema.donations.campaignId} = ${campaign.id} AND ${schema.donations.source} = 'seed'`,
        );

      expect(realCount).toBe(1);
      expect(seedCount).toBe(1);
    });
  });
});
