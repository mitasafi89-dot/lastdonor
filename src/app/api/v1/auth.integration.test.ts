/**
 * Auth Integration Tests
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { clearDatabase, seedUser } from '../../../../test/helpers';

describe('Auth Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Registration', () => {
    it('creates a user with hashed password', async () => {
      const user = await seedUser({
        email: 'register@test.com',
        passwordHash: '$2b$12$fakehashfortest',
      });

      expect(user.email).toBe('register@test.com');
      expect(user.passwordHash).not.toBeNull();
      expect(user.role).toBe('donor');
    });

    it('rejects duplicate email', async () => {
      await seedUser({ email: 'dupe@test.com' });

      await expect(
        db.insert(schema.users).values({
          email: 'dupe@test.com',
          name: 'Another User',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Role enforcement', () => {
    it('creates admin user with admin role', async () => {
      const admin = await seedUser({ email: 'admin@test.com', role: 'admin' });
      expect(admin.role).toBe('admin');
    });

    it('creates editor user with editor role', async () => {
      const editor = await seedUser({ email: 'editor@test.com', role: 'editor' });
      expect(editor.role).toBe('editor');
    });

    it('defaults to donor role', async () => {
      const donor = await seedUser({ email: 'donor@test.com' });
      expect(donor.role).toBe('donor');
    });
  });
});
