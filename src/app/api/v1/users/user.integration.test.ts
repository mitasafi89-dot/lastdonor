/**
 * User Integration Tests
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, sum, count } from 'drizzle-orm';
import { clearDatabase, seedUser, seedCampaign, seedDonation } from '../../../../../test/helpers';

describe('User Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('User CRUD', () => {
    it('creates a user with default role and stats', async () => {
      const user = await seedUser({ email: 'new@test.com' });

      expect(user.role).toBe('donor');
      expect(user.totalDonated).toBe(0);
      expect(user.campaignsSupported).toBe(0);
      expect(user.lastDonorCount).toBe(0);
    });

    it('updates user profile fields', async () => {
      const user = await seedUser();

      await db
        .update(schema.users)
        .set({ name: 'Updated Name', location: 'Portland, OR' })
        .where(eq(schema.users.id, user.id));

      const [updated] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id));

      expect(updated.name).toBe('Updated Name');
      expect(updated.location).toBe('Portland, OR');
    });

    it('enforces unique email constraint', async () => {
      await seedUser({ email: 'unique@test.com' });

      await expect(
        db.insert(schema.users).values({
          email: 'unique@test.com',
          name: 'Duplicate',
        }),
      ).rejects.toThrow();
    });
  });

  describe('User deletion / anonymization', () => {
    it('can delete user while donations remain (via no FK cascade)', async () => {
      const user = await seedUser();
      const campaign = await seedCampaign();

      await seedDonation(campaign.id, {
        userId: user.id,
        stripePaymentId: 'pi_delete_test',
      });

      // Anonymize donations first
      await db
        .update(schema.donations)
        .set({ userId: null, donorName: 'Deleted User', donorEmail: 'deleted@lastdonor.org' })
        .where(eq(schema.donations.userId, user.id));

      // Then delete user
      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      const found = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id));

      expect(found).toHaveLength(0);

      // Donation still exists
      const donations = await db
        .select()
        .from(schema.donations)
        .where(eq(schema.donations.campaignId, campaign.id));

      expect(donations).toHaveLength(1);
      expect(donations[0].donorName).toBe('Deleted User');
    });
  });
});
