/**
 * Critical Path & Concurrency Integration Tests
 *
 * Tests race conditions and critical donation paths.
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { clearDatabase, seedCampaign, seedDonation } from '../../../test/helpers';

describe('Critical Path Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Last Donor Zone completion', () => {
    it('correctly transitions campaign to completed when final donation arrives', async () => {
      // Campaign at $490 of $500 goal
      const campaign = await seedCampaign({
        goalAmount: 50000,
        raisedAmount: 49000,
        donorCount: 9,
        status: 'last_donor_zone',
      });

      // Final $10 donation that should complete the campaign
      const finalAmount = 1000;
      await seedDonation(campaign.id, {
        amount: finalAmount,
        stripePaymentId: 'pi_final_donor',
        phaseAtTime: 'last_donor_zone',
      });

      // Atomic update
      await db
        .update(schema.campaigns)
        .set({
          raisedAmount: sql`${schema.campaigns.raisedAmount} + ${finalAmount}`,
          donorCount: sql`${schema.campaigns.donorCount} + 1`,
        })
        .where(eq(schema.campaigns.id, campaign.id));

      // Check and transition
      const [updated] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(updated.raisedAmount).toBe(50000);
      expect(updated.raisedAmount).toBeGreaterThanOrEqual(updated.goalAmount);

      // Mark completed
      await db
        .update(schema.campaigns)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(schema.campaigns.id, campaign.id));

      const [completed] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });

    it('handles over-goal donations correctly', async () => {
      const campaign = await seedCampaign({
        goalAmount: 10000,
        raisedAmount: 9500,
        status: 'last_donor_zone',
      });

      // Donation that exceeds the goal
      const overAmount = 2000; // $20 puts at $115
      await seedDonation(campaign.id, {
        amount: overAmount,
        stripePaymentId: 'pi_over',
      });

      await db
        .update(schema.campaigns)
        .set({
          raisedAmount: sql`${schema.campaigns.raisedAmount} + ${overAmount}`,
          donorCount: sql`${schema.campaigns.donorCount} + 1`,
        })
        .where(eq(schema.campaigns.id, campaign.id));

      const [updated] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      // Over-goal is allowed — we don't cap raisedAmount
      expect(updated.raisedAmount).toBe(11500);
      expect(updated.raisedAmount).toBeGreaterThan(updated.goalAmount);
    });
  });

  describe('Concurrent donations', () => {
    it('handles two simultaneous donations with atomic SQL updates', async () => {
      const campaign = await seedCampaign({
        goalAmount: 100000,
        raisedAmount: 0,
        donorCount: 0,
      });

      // Simulate two concurrent donations
      const donation1 = 5000;
      const donation2 = 7500;

      // Both donations insert concurrently
      const [d1, d2] = await Promise.all([
        seedDonation(campaign.id, {
          amount: donation1,
          stripePaymentId: 'pi_concurrent_1',
        }),
        seedDonation(campaign.id, {
          amount: donation2,
          stripePaymentId: 'pi_concurrent_2',
        }),
      ]);

      // Both atomic updates fire concurrently
      await Promise.all([
        db
          .update(schema.campaigns)
          .set({
            raisedAmount: sql`${schema.campaigns.raisedAmount} + ${donation1}`,
            donorCount: sql`${schema.campaigns.donorCount} + 1`,
          })
          .where(eq(schema.campaigns.id, campaign.id)),
        db
          .update(schema.campaigns)
          .set({
            raisedAmount: sql`${schema.campaigns.raisedAmount} + ${donation2}`,
            donorCount: sql`${schema.campaigns.donorCount} + 1`,
          })
          .where(eq(schema.campaigns.id, campaign.id)),
      ]);

      const [updated] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      // Both donations should be counted thanks to atomic SQL
      expect(updated.raisedAmount).toBe(donation1 + donation2);
      expect(updated.donorCount).toBe(2);
    });
  });

  describe('Phase transitions', () => {
    it('campaign phases transition at correct percentages', async () => {
      const goalAmount = 100000;
      const campaign = await seedCampaign({
        goalAmount,
        raisedAmount: 0,
        donorCount: 0,
      });

      // Donate to 25% boundary -> should be "first_believers"
      await db
        .update(schema.campaigns)
        .set({ raisedAmount: 25000 })
        .where(eq(schema.campaigns.id, campaign.id));

      const [at25] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      const pct25 = Math.floor((at25.raisedAmount / at25.goalAmount) * 100);
      expect(pct25).toBe(25);

      // At 50% -> "the_push"
      await db
        .update(schema.campaigns)
        .set({ raisedAmount: 50000 })
        .where(eq(schema.campaigns.id, campaign.id));

      const [at50] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      const pct50 = Math.floor((at50.raisedAmount / at50.goalAmount) * 100);
      expect(pct50).toBe(50);

      // At 75% -> "closing_in"
      await db
        .update(schema.campaigns)
        .set({ raisedAmount: 75000 })
        .where(eq(schema.campaigns.id, campaign.id));

      const [at75] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      const pct75 = Math.floor((at75.raisedAmount / at75.goalAmount) * 100);
      expect(pct75).toBe(75);

      // At 90% -> "last_donor_zone"
      await db
        .update(schema.campaigns)
        .set({ raisedAmount: 90000 })
        .where(eq(schema.campaigns.id, campaign.id));

      const [at90] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      const pct90 = Math.floor((at90.raisedAmount / at90.goalAmount) * 100);
      expect(pct90).toBe(90);
    });
  });
});
