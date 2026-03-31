/**
 * Audit Log Integration Tests
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { clearDatabase, seedUser, seedCampaign } from '../../../../test/helpers';

describe('Audit Log Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it('logs an event with correct structure', async () => {
    const campaign = await seedCampaign();

    await db.insert(schema.auditLogs).values({
      eventType: 'campaign.created',
      targetType: 'campaign',
      targetId: campaign.id,
      severity: 'info',
      details: { title: campaign.title },
    });

    const [log] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.eventType, 'campaign.created'))
      .limit(1);

    expect(log).toBeDefined();
    expect(log.targetId).toBe(campaign.id);
    expect(log.severity).toBe('info');
    expect(log.timestamp).toBeDefined();
  });

  it('records actor information', async () => {
    const admin = await seedUser({ role: 'admin' });

    await db.insert(schema.auditLogs).values({
      eventType: 'user.login',
      actorId: admin.id,
      actorRole: 'admin',
      actorIp: '127.0.0.1',
      severity: 'info',
    });

    const [log] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.eventType, 'user.login'))
      .limit(1);

    expect(log.actorId).toBe(admin.id);
    expect(log.actorRole).toBe('admin');
    expect(log.actorIp).toBe('127.0.0.1');
  });

  it('supports all severity levels', async () => {
    const severities = ['info', 'warning', 'error', 'critical'] as const;

    for (const severity of severities) {
      await db.insert(schema.auditLogs).values({
        eventType: `test.${severity}`,
        severity,
      });
    }

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.timestamp));

    expect(logs).toHaveLength(4);
  });
});
