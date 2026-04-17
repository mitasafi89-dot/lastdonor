import { db } from '@/db';
import { users, donations } from '@/db/schema';
import { eq, count, and, gte } from 'drizzle-orm';
import { computeDonorScore } from '@/lib/donor-scoring';
import { logError } from '@/lib/errors';

/**
 * Compute and persist the score for a single donor.
 * Returns the new score.
 */
export async function refreshDonorScore(userId: string): Promise<number> {
  try {
  const [user] = await db
    .select({
      totalDonated: users.totalDonated,
      lastDonationAt: users.lastDonationAt,
      name: users.name,
      location: users.location,
      avatarUrl: users.avatarUrl,
      address: users.address,
      preferences: users.preferences,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return 0;

  const [donationStats] = await db
    .select({
      total: count(),
    })
    .from(donations)
    .where(eq(donations.userId, userId));

  const [recurringCheck] = await db
    .select({ total: count() })
    .from(donations)
    .where(
      and(
        eq(donations.userId, userId),
        eq(donations.isRecurring, true),
        gte(donations.createdAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
      ),
    );

  const score = computeDonorScore({
    totalDonated: user.totalDonated,
    lastDonationAt: user.lastDonationAt,
    donationCount: donationStats.total,
    hasRecurring: recurringCheck.total > 0,
    name: user.name,
    location: user.location,
    avatarUrl: user.avatarUrl,
    address: user.address,
    preferences: user.preferences,
  });

  await db
    .update(users)
    .set({ donorScore: score })
    .where(eq(users.id, userId));

  return score;
  } catch (err) {
    logError(err, 'donor-scoring', { userId });
    return 0;
  }
}
