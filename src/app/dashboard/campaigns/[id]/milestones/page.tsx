import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, campaignMilestones, milestoneEvidence, fundReleases, users } from '@/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { MilestoneEvidenceDashboard } from '@/components/verification/MilestoneEvidenceDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Milestones — LastDonor.org',
  robots: { index: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CampaignMilestonesPage({ params }: Props) {
  const { id: idOrSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');

  const campaignCondition = UUID_REGEX.test(idOrSlug)
    ? eq(campaigns.id, idOrSlug)
    : eq(campaigns.slug, idOrSlug);

  const [campaign] = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      goalAmount: campaigns.goalAmount,
      raisedAmount: campaigns.raisedAmount,
      totalReleasedAmount: campaigns.totalReleasedAmount,
      totalWithdrawnAmount: campaigns.totalWithdrawnAmount,
      milestoneFundRelease: campaigns.milestoneFundRelease,
      creatorId: campaigns.creatorId,
    })
    .from(campaigns)
    .where(and(campaignCondition, eq(campaigns.creatorId, session.user.id)))
    .limit(1);

  if (!campaign) {
    redirect('/dashboard');
  }

  // Fetch user's Stripe Connect status for payout banner
  const [userConnect] = await db
    .select({
      stripeConnectStatus: users.stripeConnectStatus,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const milestones = await db
    .select()
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, campaign.id))
    .orderBy(asc(campaignMilestones.phase));

  // Fetch evidence + fund releases
  const [evidenceRows, releaseRows] = await Promise.all([
    milestones.length > 0
      ? db
          .select({
            id: milestoneEvidence.id,
            milestoneId: milestoneEvidence.milestoneId,
            fileUrl: milestoneEvidence.fileUrl,
            fileName: milestoneEvidence.fileName,
            fileSize: milestoneEvidence.fileSize,
            mimeType: milestoneEvidence.mimeType,
            description: milestoneEvidence.description,
            status: milestoneEvidence.status,
            reviewerNotes: milestoneEvidence.reviewerNotes,
            reviewedAt: milestoneEvidence.reviewedAt,
            attemptNumber: milestoneEvidence.attemptNumber,
            createdAt: milestoneEvidence.createdAt,
          })
          .from(milestoneEvidence)
          .where(eq(milestoneEvidence.campaignId, campaign.id))
          .orderBy(desc(milestoneEvidence.attemptNumber))
      : Promise.resolve([]),
    milestones.length > 0
      ? db
          .select({
            id: fundReleases.id,
            milestoneId: fundReleases.milestoneId,
            amount: fundReleases.amount,
            status: fundReleases.status,
            approvedAt: fundReleases.approvedAt,
            releasedAt: fundReleases.releasedAt,
            notes: fundReleases.notes,
          })
          .from(fundReleases)
          .where(eq(fundReleases.campaignId, campaign.id))
      : Promise.resolve([]),
  ]);

  // Group by milestone
  const evidenceByMilestone = new Map<string, typeof evidenceRows>();
  for (const e of evidenceRows) {
    const arr = evidenceByMilestone.get(e.milestoneId) ?? [];
    arr.push(e);
    evidenceByMilestone.set(e.milestoneId, arr);
  }

  const releaseByMilestone = new Map<string, (typeof releaseRows)[0]>();
  for (const r of releaseRows) {
    releaseByMilestone.set(r.milestoneId, r);
  }

  // Serialize
  const serializedMilestones = milestones.map((m) => ({
    ...m,
    estimatedCompletion: m.estimatedCompletion?.toISOString() ?? null,
    releasedAt: m.releasedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    evidence: (evidenceByMilestone.get(m.id) ?? []).map((e) => ({
      ...e,
      reviewedAt: e.reviewedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    fundRelease: (() => {
      const r = releaseByMilestone.get(m.id);
      if (!r) return null;
      return {
        ...r,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        releasedAt: r.releasedAt?.toISOString() ?? null,
      };
    })(),
  }));

  return (
    <MilestoneEvidenceDashboard
      campaignId={campaign.id}
      campaignTitle={campaign.title}
      milestones={serializedMilestones}
      goalAmount={campaign.goalAmount}
      raisedAmount={campaign.raisedAmount}
      totalReleasedAmount={campaign.totalReleasedAmount}
      totalWithdrawnAmount={campaign.totalWithdrawnAmount}
      stripeConnectStatus={userConnect?.stripeConnectStatus ?? 'not_started'}
      milestoneFundRelease={campaign.milestoneFundRelease}
    />
  );
}
