import { auth } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaigns, newsletterSubscribers, users } from '@/db/schema';
import { eq, sql, gte, and, inArray } from 'drizzle-orm';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard — LastDonor.org',
  robots: { index: false },
};

async function getDashboardStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayDonations] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
    })
    .from(donations)
    .where(
      and(
        gte(donations.createdAt, startOfDay),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  const [monthDonations] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
    })
    .from(donations)
    .where(
      and(
        gte(donations.createdAt, startOfMonth),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  const [todaySubs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsletterSubscribers)
    .where(gte(newsletterSubscribers.subscribedAt, startOfDay));

  const [monthSubs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsletterSubscribers)
    .where(gte(newsletterSubscribers.subscribedAt, startOfMonth));

  const [monthLaunched] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(
      and(
        gte(campaigns.publishedAt, startOfMonth),
        inArray(campaigns.status, ['active', 'last_donor_zone', 'completed']),
      ),
    );

  const [monthCompleted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(
      and(
        gte(campaigns.completedAt, startOfMonth),
        eq(campaigns.status, 'completed'),
      ),
    );

  const activeCampaigns = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      donorCount: campaigns.donorCount,
    })
    .from(campaigns)
    .where(inArray(campaigns.status, ['active', 'last_donor_zone']))
    .orderBy(campaigns.createdAt);

  const recentDonations = await db
    .select({
      id: donations.id,
      donorName: donations.donorName,
      amount: donations.amount,
      isAnonymous: donations.isAnonymous,
      createdAt: donations.createdAt,
      campaignTitle: campaigns.title,
      campaignSlug: campaigns.slug,
    })
    .from(donations)
    .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
    .where(eq(donations.source, 'real'))
    .orderBy(sql`${donations.createdAt} desc`)
    .limit(10);

  // User-submitted campaigns pending admin review
  const pendingReview = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      category: campaigns.category,
      goalAmount: campaigns.goalAmount,
      creatorId: campaigns.creatorId,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.verificationStatus, 'pending'),
        eq(campaigns.status, 'draft'),
        eq(campaigns.source, 'manual'),
      ),
    )
    .orderBy(campaigns.createdAt);

  // Resolve creator names for pending campaigns
  const creatorIds = pendingReview
    .map((c) => c.creatorId)
    .filter((id): id is string => id != null);
  const creatorMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const creators = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, creatorIds));
    for (const c of creators) {
      creatorMap.set(c.id, c.name ?? 'Unknown');
    }
  }

  const pendingCampaigns = pendingReview.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    category: c.category,
    goalAmount: c.goalAmount,
    creatorName: c.creatorId ? (creatorMap.get(c.creatorId) ?? 'Unknown') : 'Unknown',
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    today: {
      donationCount: todayDonations.count,
      donationTotal: todayDonations.total,
      newSubscribers: todaySubs.count,
    },
    month: {
      donationCount: monthDonations.count,
      donationTotal: monthDonations.total,
      newSubscribers: monthSubs.count,
      campaignsLaunched: monthLaunched.count,
      campaignsCompleted: monthCompleted.count,
    },
    activeCampaigns,
    pendingCampaigns,
    recentDonations: recentDonations.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';
  const stats = await getDashboardStats();

  return <AdminDashboard stats={stats} isAdmin={isAdmin} />;
}
