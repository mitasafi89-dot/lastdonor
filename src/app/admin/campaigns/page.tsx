import { db } from '@/db';
import { campaigns, users } from '@/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { CampaignsList } from '@/components/admin/CampaignsList';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campaigns - Admin - LastDonor.org',
  robots: { index: false },
};

export default async function AdminCampaignsPage() {
  const allCampaigns = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      status: campaigns.status,
      category: campaigns.category,
      source: campaigns.source,
      verificationStatus: campaigns.verificationStatus,
      creatorId: campaigns.creatorId,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      donorCount: campaigns.donorCount,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt));

  // Resolve creator names for user-submitted campaigns
  const creatorIds = allCampaigns
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

  // Compute status counts for filter tiles
  const statusCounts: Record<string, number> = {};
  for (const c of allCampaigns) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  }

  // Map to client-safe shape (serialize dates, resolve creator names)
  const campaignData = allCampaigns.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    category: c.category,
    verificationStatus: c.verificationStatus,
    source: c.source ?? 'editorial',
    creatorName: c.creatorId ? (creatorMap.get(c.creatorId) ?? null) : null,
    raisedAmount: c.raisedAmount,
    goalAmount: c.goalAmount,
    donorCount: c.donorCount,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
  }));

  return <CampaignsList campaigns={campaignData} statusCounts={statusCounts} />;
}
