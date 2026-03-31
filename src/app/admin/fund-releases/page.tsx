import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
  campaigns,
  campaignMilestones,
  milestoneEvidence,
  fundReleases,
  auditLogs,
  users,
} from '@/db/schema';
import { desc, sql, count, eq, inArray, and } from 'drizzle-orm';
import { FundReleaseDashboard } from '@/components/admin/FundReleaseDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fund Releases — Admin — LastDonor.org',
  robots: { index: false },
};

export const revalidate = 60;

export default async function AdminFundReleasesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    redirect('/admin');
  }

  // Load campaigns that have milestone-based fund release enabled
  const [campaignList, [stats]] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        verificationStatus: campaigns.verificationStatus,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        totalReleasedAmount: campaigns.totalReleasedAmount,
        milestoneFundRelease: campaigns.milestoneFundRelease,
        creatorId: campaigns.creatorId,
        creatorName: users.name,
        creatorEmail: users.email,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.creatorId, users.id))
      .where(eq(campaigns.milestoneFundRelease, true))
      .orderBy(desc(campaigns.updatedAt))
      .limit(500),
    db
      .select({
        totalEvidenceSubmitted: sql<number>`count(*) FILTER (WHERE ${campaignMilestones.status} = 'evidence_submitted')::int`,
        totalApproved: sql<number>`count(*) FILTER (WHERE ${campaignMilestones.status} = 'approved')::int`,
        totalRejected: sql<number>`count(*) FILTER (WHERE ${campaignMilestones.status} = 'rejected')::int`,
        totalPending: sql<number>`count(*) FILTER (WHERE ${campaignMilestones.status} = 'pending')::int`,
        totalReached: sql<number>`count(*) FILTER (WHERE ${campaignMilestones.status} = 'reached')::int`,
      })
      .from(campaignMilestones),
  ]);

  const campaignIds = campaignList.map((c) => c.id);

  if (campaignIds.length === 0) {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Fund Releases</h1>
          <p className="text-sm text-muted-foreground">No campaigns with milestone-based fund release</p>
        </div>
        <FundReleaseDashboard initialCampaigns={[]} stats={stats} />
      </>
    );
  }

  // Parallel: milestones + evidence counts + fund releases + recent audit entries
  const [allMilestones, evidenceCountsRaw, allFundReleases, auditEntries] = await Promise.all([
    db
      .select({
        id: campaignMilestones.id,
        campaignId: campaignMilestones.campaignId,
        phase: campaignMilestones.phase,
        title: campaignMilestones.title,
        description: campaignMilestones.description,
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
        notes: fundReleases.notes,
        flaggedForAudit: fundReleases.flaggedForAudit,
        flagReason: fundReleases.flagReason,
        pauseReason: fundReleases.pauseReason,
        createdAt: fundReleases.createdAt,
      })
      .from(fundReleases)
      .where(inArray(fundReleases.campaignId, campaignIds)),
    db
      .select({
        id: auditLogs.id,
        eventType: auditLogs.eventType,
        actorId: auditLogs.actorId,
        targetId: auditLogs.targetId,
        targetType: auditLogs.targetType,
        details: auditLogs.details,
        severity: auditLogs.severity,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .where(
        and(
          inArray(auditLogs.targetId, campaignIds),
          eq(auditLogs.targetType, 'campaign'),
        ),
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(200),
  ]);

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

  // Group audit entries by campaign
  const auditByCampaign: Record<string, typeof auditEntries> = {};
  for (const a of auditEntries) {
    const tId = a.targetId!;
    if (!auditByCampaign[tId]) auditByCampaign[tId] = [];
    auditByCampaign[tId].push(a);
  }

  // Also include fund-release targeted audit entries
  const releaseIds = allFundReleases.map((r) => r.id);
  let fundReleaseAuditEntries: typeof auditEntries = [];
  if (releaseIds.length > 0) {
    fundReleaseAuditEntries = await db
      .select({
        id: auditLogs.id,
        eventType: auditLogs.eventType,
        actorId: auditLogs.actorId,
        targetId: auditLogs.targetId,
        targetType: auditLogs.targetType,
        details: auditLogs.details,
        severity: auditLogs.severity,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .where(
        and(
          inArray(auditLogs.targetId, releaseIds),
          eq(auditLogs.targetType, 'fund_release'),
        ),
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(200);
  }

  // Map fund release audit entries back to campaigns
  const releaseIdToCampaign: Record<string, string> = {};
  for (const r of allFundReleases) {
    releaseIdToCampaign[r.id] = r.campaignId;
  }
  for (const a of fundReleaseAuditEntries) {
    const campaignId = releaseIdToCampaign[a.targetId!];
    if (campaignId) {
      if (!auditByCampaign[campaignId]) auditByCampaign[campaignId] = [];
      auditByCampaign[campaignId].push(a);
    }
  }

  // Sort audit entries by timestamp (desc) within each campaign
  for (const key of Object.keys(auditByCampaign)) {
    auditByCampaign[key].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  const serialized = campaignList.map((c) => ({
    ...c,
    totalReleasedAmount: c.totalReleasedAmount ?? 0,
    updatedAt: c.updatedAt.toISOString(),
    milestones: (milestonesByCampaign[c.id] || []).map((m) => ({
      id: m.id,
      phase: m.phase,
      title: m.title,
      description: m.description,
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
            notes: releasesByMilestone[m.id].notes,
            flaggedForAudit: releasesByMilestone[m.id].flaggedForAudit,
            flagReason: releasesByMilestone[m.id].flagReason,
            pauseReason: releasesByMilestone[m.id].pauseReason,
            createdAt: releasesByMilestone[m.id].createdAt.toISOString(),
          }
        : null,
    })),
    auditTrail: (auditByCampaign[c.id] || []).slice(0, 20).map((a) => ({
      id: a.id,
      eventType: a.eventType,
      actorId: a.actorId,
      details: a.details as Record<string, unknown> | null,
      severity: a.severity,
      timestamp: a.timestamp.toISOString(),
    })),
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Fund Releases</h1>
        <p className="text-sm text-muted-foreground">
          {stats.totalEvidenceSubmitted} milestones awaiting review
        </p>
      </div>
      <FundReleaseDashboard initialCampaigns={serialized} stats={stats} />
    </>
  );
}
