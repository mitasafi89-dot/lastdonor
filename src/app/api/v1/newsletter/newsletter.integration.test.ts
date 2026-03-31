/**
 * Newsletter Integration Tests
 *
 * Tests newsletter subscription workflows at the database level.
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { clearDatabase } from '../../../../../test/helpers';

describe('Newsletter Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it('subscribes a new email', async () => {
    const [sub] = await db
      .insert(schema.newsletterSubscribers)
      .values({
        email: 'new@example.com',
        source: 'homepage',
      })
      .returning();

    expect(sub).toBeDefined();
    expect(sub.email).toBe('new@example.com');
    expect(sub.unsubscribedAt).toBeNull();
  });

  it('enforces unique email constraint', async () => {
    await db.insert(schema.newsletterSubscribers).values({
      email: 'dupe@example.com',
      source: 'footer',
    });

    await expect(
      db.insert(schema.newsletterSubscribers).values({
        email: 'dupe@example.com',
        source: 'blog',
      }),
    ).rejects.toThrow();
  });

  it('supports unsubscribe by setting unsubscribedAt', async () => {
    const [sub] = await db
      .insert(schema.newsletterSubscribers)
      .values({ email: 'unsub@example.com' })
      .returning();

    await db
      .update(schema.newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(schema.newsletterSubscribers.id, sub.id));

    const [updated] = await db
      .select()
      .from(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.id, sub.id));

    expect(updated.unsubscribedAt).not.toBeNull();
  });
});
