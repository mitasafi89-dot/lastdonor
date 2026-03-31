import { notFound } from 'next/navigation';
import { db } from '@/db';
import { campaigns, donations, campaignUpdates, campaignMilestones } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { CampaignDetail } from '@/components/admin/CampaignDetail';
import type { Metadata } from 'next';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: 'Campaign Detail — Admin — LastDonor.org',
  robots: { index: false },
};

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) notFound();

  // Recent donations for this campaign
  const recentDonations = await db
    .select({
      id: donations.id,
      donorName: donations.donorName,
      donorEmail: donations.donorEmail,
      donorLocation: donations.donorLocation,
      amount: donations.amount,
      message: donations.message,
      isAnonymous: donations.isAnonymous,
      phaseAtTime: donations.phaseAtTime,
      source: donations.source,
      refunded: donations.refunded,
      createdAt: donations.createdAt,
    })
    .from(donations)
    .where(eq(donations.campaignId, id))
    .orderBy(desc(donations.createdAt))
    .limit(30);

  // Campaign updates
  const updates = await db
    .select({
      id: campaignUpdates.id,
      title: campaignUpdates.title,
      bodyHtml: campaignUpdates.bodyHtml,
      imageUrl: campaignUpdates.imageUrl,
      createdAt: campaignUpdates.createdAt,
    })
    .from(campaignUpdates)
    .where(eq(campaignUpdates.campaignId, id))
    .orderBy(desc(campaignUpdates.createdAt));

  // Donation phase breakdown
  const phaseBreakdown = await db
    .select({
      phase: donations.phaseAtTime,
      count: sql<number>`count(*)::int`,
      total: sql<number>`sum(${donations.amount})::int`,
    })
    .from(donations)
    .where(eq(donations.campaignId, id))
    .groupBy(donations.phaseAtTime);

  // Campaign milestones
  const milestones = await db
    .select({
      phase: campaignMilestones.phase,
      title: campaignMilestones.title,
      status: campaignMilestones.status,
      fundPercentage: campaignMilestones.fundPercentage,
      releasedAmount: campaignMilestones.releasedAmount,
    })
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, id))
    .orderBy(campaignMilestones.phase);

  return (
    <CampaignDetail
      campaign={{
        ...campaign,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        publishedAt: campaign.publishedAt?.toISOString() ?? null,
        completedAt: campaign.completedAt?.toISOString() ?? null,
        pausedAt: campaign.pausedAt?.toISOString() ?? null,
        suspendedAt: campaign.suspendedAt?.toISOString() ?? null,
        cancelledAt: campaign.cancelledAt?.toISOString() ?? null,
      }}
      milestones={milestones}
      donations={recentDonations.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      }))}
      updates={updates.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      }))}
      phaseBreakdown={phaseBreakdown.map((p) => ({
        phase: p.phase,
        count: p.count,
        total: p.total ?? 0,
      }))}
    />
  );
}
