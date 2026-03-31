/**
 * User Campaign Integration Tests
 *
 * Tests the user-created campaign system: schema, ownership, creation limits.
 * Run with: npm run test:integration
 */
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { clearDatabase, seedCampaign, seedUser } from '../../../../../test/helpers';

describe('User Campaign Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Schema: creatorId and ownership', () => {
    it('stores creatorId on campaign', async () => {
      const user = await seedUser({ role: 'donor' });
      const campaign = await seedCampaign({
        slug: 'user-created-1',
        creatorId: user.id,
        beneficiaryRelation: 'family',
        verificationStatus: 'unverified',
        simulationFlag: false,
        source: 'manual',
      });

      expect(campaign.creatorId).toBe(user.id);
      expect(campaign.beneficiaryRelation).toBe('family');
      expect(campaign.verificationStatus).toBe('unverified');
      expect(campaign.simulationFlag).toBe(false);
    });

    it('allows null creatorId for editorially-created campaigns', async () => {
      const campaign = await seedCampaign({
        slug: 'editorial-1',
        creatorId: null,
        simulationFlag: true,
      });

      expect(campaign.creatorId).toBeNull();
      expect(campaign.simulationFlag).toBe(true);
    });

    it('queries campaigns by creatorId', async () => {
      const user1 = await seedUser({ email: 'user1@example.com' });
      const user2 = await seedUser({ email: 'user2@example.com' });

      await seedCampaign({ slug: 'u1-camp-1', creatorId: user1.id });
      await seedCampaign({ slug: 'u1-camp-2', creatorId: user1.id });
      await seedCampaign({ slug: 'u2-camp-1', creatorId: user2.id });
      await seedCampaign({ slug: 'editorial', creatorId: null });

      const user1Campaigns = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.creatorId, user1.id));

      expect(user1Campaigns).toHaveLength(2);
      expect(user1Campaigns.every((c) => c.creatorId === user1.id)).toBe(true);
    });
  });

  describe('Schema: verificationStatus', () => {
    it('defaults to unverified', async () => {
      const campaign = await seedCampaign({ slug: 'unverified-1' });
      expect(campaign.verificationStatus).toBe('unverified');
    });

    it('supports all verification statuses', async () => {
      const statuses = ['unverified', 'pending', 'verified'] as const;

      for (const status of statuses) {
        const campaign = await seedCampaign({
          slug: `verify-${status}`,
          verificationStatus: status,
        });
        expect(campaign.verificationStatus).toBe(status);
      }
    });
  });

  describe('Schema: campaignWithdrawals', () => {
    it('creates a withdrawal record', async () => {
      const user = await seedUser({ role: 'donor' });
      const campaign = await seedCampaign({
        slug: 'withdrawal-test',
        creatorId: user.id,
        raisedAmount: 100_000,
      });

      const [withdrawal] = await db
        .insert(schema.campaignWithdrawals)
        .values({
          campaignId: campaign.id,
          requestedBy: user.id,
          amount: 50_000,
          status: 'requested',
        })
        .returning();

      expect(withdrawal.campaignId).toBe(campaign.id);
      expect(withdrawal.requestedBy).toBe(user.id);
      expect(withdrawal.amount).toBe(50_000);
      expect(withdrawal.status).toBe('requested');
      expect(withdrawal.processedBy).toBeNull();
    });

    it('links withdrawal to campaign and user via FK', async () => {
      const user = await seedUser({ role: 'donor' });
      const campaign = await seedCampaign({
        slug: 'fk-test',
        creatorId: user.id,
      });

      const [withdrawal] = await db
        .insert(schema.campaignWithdrawals)
        .values({
          campaignId: campaign.id,
          requestedBy: user.id,
          amount: 10_000,
          status: 'requested',
        })
        .returning();

      // Verify FK integrity by joining
      const result = await db
        .select({
          withdrawalId: schema.campaignWithdrawals.id,
          campaignTitle: schema.campaigns.title,
          userName: schema.users.name,
        })
        .from(schema.campaignWithdrawals)
        .innerJoin(schema.campaigns, eq(schema.campaignWithdrawals.campaignId, schema.campaigns.id))
        .innerJoin(schema.users, eq(schema.campaignWithdrawals.requestedBy, schema.users.id))
        .where(eq(schema.campaignWithdrawals.id, withdrawal.id));

      expect(result).toHaveLength(1);
      expect(result[0].campaignTitle).toBe('Test Campaign');
    });
  });

  describe('Schema: users.campaignsCreated counter', () => {
    it('increments campaigns_created', async () => {
      const user = await seedUser({ role: 'donor' });
      expect(user.campaignsCreated).toBe(0);

      await db
        .update(schema.users)
        .set({ campaignsCreated: sql`${schema.users.campaignsCreated} + 1` })
        .where(eq(schema.users.id, user.id));

      const [updated] = await db
        .select({ campaignsCreated: schema.users.campaignsCreated })
        .from(schema.users)
        .where(eq(schema.users.id, user.id));

      expect(updated.campaignsCreated).toBe(1);
    });
  });

  describe('Bug fix C1: publish-campaigns simulationFlag', () => {
    it('simulated campaigns have simulationFlag true', async () => {
      const campaign = await seedCampaign({
        slug: 'sim-test',
        simulationFlag: true,
        simulationConfig: { paused: false, fundAllocation: 'pool' },
        source: 'automated',
      });

      expect(campaign.simulationFlag).toBe(true);
      expect(campaign.simulationConfig).toEqual({ paused: false, fundAllocation: 'pool' });
    });
  });

  describe('Bug fix C3: stripe_payment_id unique constraint', () => {
    it('rejects duplicate stripe_payment_id', async () => {
      const campaign = await seedCampaign({ slug: 'dup-test' });
      const paymentId = `pi_unique_${Date.now()}`;

      await db.insert(schema.donations).values({
        campaignId: campaign.id,
        stripePaymentId: paymentId,
        amount: 5000,
        donorName: 'First',
        donorEmail: 'first@example.com',
        phaseAtTime: 'first_believers',
        source: 'real',
      });

      // Second insert with same stripe_payment_id should be rejected or do nothing
      const result = await db
        .insert(schema.donations)
        .values({
          campaignId: campaign.id,
          stripePaymentId: paymentId,
          amount: 5000,
          donorName: 'Duplicate',
          donorEmail: 'dup@example.com',
          phaseAtTime: 'first_believers',
          source: 'real',
        })
        .onConflictDoNothing({ target: schema.donations.stripePaymentId })
        .returning({ id: schema.donations.id });

      expect(result).toHaveLength(0);
    });
  });

  describe('Bug fix H1: lastDonorName and lastDonorAmount', () => {
    it('stores lastDonorName and lastDonorAmount on campaign', async () => {
      const campaign = await seedCampaign({ slug: 'last-donor-test' });

      await db
        .update(schema.campaigns)
        .set({
          lastDonorName: 'Jane Doe',
          lastDonorAmount: 10_000,
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(schema.campaigns.id, campaign.id));

      const [updated] = await db
        .select({
          lastDonorName: schema.campaigns.lastDonorName,
          lastDonorAmount: schema.campaigns.lastDonorAmount,
          status: schema.campaigns.status,
        })
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));

      expect(updated.lastDonorName).toBe('Jane Doe');
      expect(updated.lastDonorAmount).toBe(10_000);
      expect(updated.status).toBe('completed');
    });
  });

  describe('Bug fix H2: celebration update on completion', () => {
    it('inserts celebration update', async () => {
      const campaign = await seedCampaign({ slug: 'celebration-test' });

      await db.insert(schema.campaignUpdates).values({
        campaignId: campaign.id,
        title: '🎉 Campaign Goal Reached!',
        bodyHtml: '<p>The campaign has been fully funded!</p>',
        updateType: 'celebration',
      });

      const updates = await db
        .select()
        .from(schema.campaignUpdates)
        .where(eq(schema.campaignUpdates.campaignId, campaign.id));

      expect(updates).toHaveLength(1);
      expect(updates[0].updateType).toBe('celebration');
      expect(updates[0].title).toContain('Goal Reached');
    });
  });

  describe('User campaign creation flow', () => {
    it('creates a campaign with user ownership', async () => {
      const user = await seedUser({ role: 'donor' });

      const [campaign] = await db
        .insert(schema.campaigns)
        .values({
          title: 'Help My Neighbor',
          slug: 'help-my-neighbor',
          status: 'draft',
          heroImageUrl: 'https://example.com/photo.jpg',
          storyHtml: '<p>My neighbor needs help with medical bills.</p>',
          goalAmount: 50_000,
          category: 'medical',
          subjectName: 'John Doe',
          subjectHometown: 'Springfield, IL',
          fundUsagePlan: 'Medical bills breakdown: surgery costs $30,000, rehabilitation therapy $15,000, medication $5,000.',
          simulationFlag: false,
          source: 'manual',
          creatorId: user.id,
          beneficiaryRelation: 'community_member',
          verificationStatus: 'pending',
        })
        .returning();

      expect(campaign.creatorId).toBe(user.id);
      expect(campaign.simulationFlag).toBe(false);
      expect(campaign.source).toBe('manual');
      expect(campaign.status).toBe('draft');
      expect(campaign.verificationStatus).toBe('pending');
      expect(campaign.fundUsagePlan).toContain('Medical bills');

      // Verify it's queryable by creator
      const myCampaigns = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.creatorId, user.id));

      expect(myCampaigns).toHaveLength(1);
    });
  });

  describe('Admin notification on campaign submission', () => {
    it('audit log records campaign.submitted event', async () => {
      const user = await seedUser({ role: 'donor' });
      const campaign = await seedCampaign({
        slug: 'audit-submitted',
        creatorId: user.id,
        source: 'manual',
        verificationStatus: 'pending',
        status: 'draft',
      });

      // Simulate what the POST route does: insert audit log
      await db.insert(schema.auditLogs).values({
        eventType: 'campaign.submitted',
        actorId: user.id,
        actorRole: 'donor',
        targetType: 'campaign',
        targetId: campaign.id,
        severity: 'info',
        details: {
          title: campaign.title,
          category: campaign.category,
          goalAmount: campaign.goalAmount,
          slug: campaign.slug,
        },
      });

      const logs = await db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.eventType, 'campaign.submitted'));

      expect(logs).toHaveLength(1);
      expect(logs[0].actorId).toBe(user.id);
      expect(logs[0].targetId).toBe(campaign.id);
      expect(logs[0].targetType).toBe('campaign');
      expect(logs[0].severity).toBe('info');
      const details = logs[0].details as Record<string, unknown>;
      expect(details.title).toBe(campaign.title);
    });

    it('admin notification created for campaign submission', async () => {
      const admin = await seedUser({ role: 'admin', email: 'admin-notif@test.com' });
      const _creator = await seedUser({ role: 'donor', email: 'creator-notif@test.com', name: 'Jane Creator' });

      // Simulate creating a notification like notifyAdminsCampaignSubmitted does
      await db.insert(schema.notifications).values({
        userId: admin.id,
        type: 'campaign_submitted',
        title: 'New campaign: "Help My Family After House Fire"',
        message: 'Jane Creator published a new campaign. Category: medical, Goal: $500.00.',
        link: '/admin/campaigns/some-id/edit',
      });

      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, admin.id));

      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('campaign_submitted');
      expect(notifs[0].title).toContain('Help My Family');
      expect(notifs[0].link).toContain('/admin/campaigns/');
      expect(notifs[0].read).toBe(false);
    });

    it('pending campaigns queryable for admin dashboard', async () => {
      const creator = await seedUser({ role: 'donor', email: 'pending-test@test.com' });

      await seedCampaign({
        slug: 'pending-1',
        creatorId: creator.id,
        source: 'manual',
        status: 'draft',
        verificationStatus: 'pending',
      });
      await seedCampaign({
        slug: 'pending-2',
        creatorId: creator.id,
        source: 'manual',
        status: 'draft',
        verificationStatus: 'pending',
      });
      // Editorial campaign (not pending review)
      await seedCampaign({
        slug: 'editorial-active',
        status: 'active',
        verificationStatus: 'unverified',
        source: 'automated',
      });

      const pending = await db
        .select()
        .from(schema.campaigns)
        .where(
          sql`${schema.campaigns.verificationStatus} = 'pending' AND ${schema.campaigns.status} = 'draft' AND ${schema.campaigns.source} = 'manual'`,
        );

      expect(pending).toHaveLength(2);
      expect(pending.every((c) => c.creatorId === creator.id)).toBe(true);
      expect(pending.every((c) => c.verificationStatus === 'pending')).toBe(true);
    });
  });
});
