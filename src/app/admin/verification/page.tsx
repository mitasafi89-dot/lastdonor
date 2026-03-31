import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
  campaigns,
  verificationDocuments,
  campaignMilestones,
  milestoneEvidence,
  fundReleases,
  users,
} from '@/db/schema';
import { desc, sql, count, eq, inArray } from 'drizzle-orm';
import { VerificationDashboard } from '@/components/admin/VerificationDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verification Queue — Admin — LastDonor.org',
  robots: { index: false },
};

export const revalidate = 60;

export default async function AdminVerificationPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    redirect('/admin');
  }

  // Load all campaigns that have entered verification (exclude unverified/pending/legacy-verified)
  const excludedStatuses = sql`${campaigns.verificationStatus} NOT IN ('unverified','pending','verified')`;

  // Parallel: campaigns + stats + milestones
  const [queuedCampaigns, [stats]] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        category: campaigns.category,
        verificationStatus: campaigns.verificationStatus,
        verificationNotes: campaigns.verificationNotes,
        verificationReviewedAt: campaigns.verificationReviewedAt,
        veriffSessionId: campaigns.veriffSessionId,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        totalReleasedAmount: campaigns.totalReleasedAmount,
        milestoneFundRelease: campaigns.milestoneFundRelease,
        creatorId: campaigns.creatorId,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.creatorId, users.id))
      .where(excludedStatuses)
      .orderBy(desc(campaigns.updatedAt))
      .limit(500),
    db
      .select({
        totalPending: sql<number>`count(*) FILTER (WHERE ${campaigns.verificationStatus} IN ('documents_uploaded','submitted_for_review'))::int`,
        totalIdentityVerified: sql<number>`count(*) FILTER (WHERE ${campaigns.verificationStatus} = 'identity_verified')::int`,
        totalFullyVerified: sql<number>`count(*) FILTER (WHERE ${campaigns.verificationStatus} = 'fully_verified')::int`,
        totalRejected: sql<number>`count(*) FILTER (WHERE ${campaigns.verificationStatus} = 'rejected')::int`,
      })
      .from(campaigns)
      .where(sql`${campaigns.verificationStatus} NOT IN ('unverified','pending','verified')`),
  ]);

  const campaignIds = queuedCampaigns.map((c) => c.id);

  if (campaignIds.length === 0) {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Verification Queue</h1>
          <p className="text-sm text-muted-foreground">No campaigns in verification queue</p>
        </div>
        <VerificationDashboard initialCampaigns={[]} stats={stats} />
      </>
    );
  }

  // Parallel: document counts + milestones + fund releases
  const [docCountsRaw, allMilestones, evidenceCountsRaw, allFundReleases] = await Promise.all([
    db
      .select({
        campaignId: verificationDocuments.campaignId,
        docCount: count(),
      })
      .from(verificationDocuments)
      .where(inArray(verificationDocuments.campaignId, campaignIds))
      .groupBy(verificationDocuments.campaignId),
    db
      .select({
        id: campaignMilestones.id,
        campaignId: campaignMilestones.campaignId,
        phase: campaignMilestones.phase,
        title: campaignMilestones.title,
        status: campaignMilestones.status,
        fundPercentage: campaignMilestones.fundPercentage,
        fundAmount: campaignMilestones.fundAmount,
        releasedAmount: campaignMilestones.releasedAmount,
        releasedAt: campaignMilestones.releasedAt,
        updatedAt: campaignMilestones.updatedAt,
      })
      .from(campaignMilestones)
      .where(inArray(campaignMilestones.campaignId, campaignIds))
      .orderBy(campaignMilestones.phase),
    db
      .select({
        milestoneId: milestoneEvidence.milestoneId,
        evidenceCount: count(),
      })
      .from(milestoneEvidence)
      .where(inArray(milestoneEvidence.campaignId, campaignIds))
      .groupBy(milestoneEvidence.milestoneId),
    db
      .select({
        id: fundReleases.id,
        campaignId: fundReleases.campaignId,
        milestoneId: fundReleases.milestoneId,
        amount: fundReleases.amount,
        status: fundReleases.status,
        approvedBy: fundReleases.approvedBy,
        approvedAt: fundReleases.approvedAt,
        releasedAt: fundReleases.releasedAt,
        flaggedForAudit: fundReleases.flaggedForAudit,
      })
      .from(fundReleases)
      .where(inArray(fundReleases.campaignId, campaignIds)),
  ]);

  const docCounts = Object.fromEntries(docCountsRaw.map((c) => [c.campaignId, c.docCount]));
  const evidenceCounts = Object.fromEntries(evidenceCountsRaw.map((e) => [e.milestoneId, e.evidenceCount]));

  // Group milestones by campaign
  const milestonesByCampaign: Record<string, typeof allMilestones> = {};
  for (const m of allMilestones) {
    if (!milestonesByCampaign[m.campaignId]) milestonesByCampaign[m.campaignId] = [];
    milestonesByCampaign[m.campaignId].push(m);
  }

  // Group fund releases by milestone
  const releasesByMilestone: Record<string, (typeof allFundReleases)[0]> = {};
  for (const r of allFundReleases) {
    releasesByMilestone[r.milestoneId] = r;
  }

  const serialized = queuedCampaigns.map((c) => ({
    ...c,
    documentCount: docCounts[c.id] || 0,
    veriffSessionId: c.veriffSessionId ?? null,
    totalReleasedAmount: c.totalReleasedAmount ?? 0,
    milestoneFundRelease: c.milestoneFundRelease ?? false,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    verificationReviewedAt: c.verificationReviewedAt?.toISOString() ?? null,
    milestones: (milestonesByCampaign[c.id] || []).map((m) => ({
      id: m.id,
      phase: m.phase,
      title: m.title,
      status: m.status,
      fundPercentage: m.fundPercentage,
      fundAmount: m.fundAmount,
      releasedAmount: m.releasedAmount,
      releasedAt: m.releasedAt?.toISOString() ?? null,
      evidenceCount: evidenceCounts[m.id] || 0,
      fundRelease: releasesByMilestone[m.id]
        ? {
            id: releasesByMilestone[m.id].id,
            amount: releasesByMilestone[m.id].amount,
            status: releasesByMilestone[m.id].status,
            approvedBy: releasesByMilestone[m.id].approvedBy,
            approvedAt: releasesByMilestone[m.id].approvedAt?.toISOString() ?? null,
            releasedAt: releasesByMilestone[m.id].releasedAt?.toISOString() ?? null,
            flaggedForAudit: releasesByMilestone[m.id].flaggedForAudit,
          }
        : null,
    })),
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Verification Queue</h1>
        <p className="text-sm text-muted-foreground">
          {stats.totalPending} campaigns pending review
        </p>
      </div>
      <VerificationDashboard initialCampaigns={serialized} stats={stats} />
    </>
  );
}
