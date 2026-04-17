import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
  campaigns,
  verificationDocuments,
  users,
} from '@/db/schema';
import { desc, sql, count, eq, inArray } from 'drizzle-orm';
import { VerificationDashboard } from '@/components/admin/VerificationDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verification Queue - Admin - LastDonor.org',
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
        stripeVerificationId: campaigns.stripeVerificationId,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        totalReleasedAmount: campaigns.totalReleasedAmount,
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

  // Document counts per campaign
  const docCountsRaw = await db
    .select({
      campaignId: verificationDocuments.campaignId,
      docCount: count(),
    })
    .from(verificationDocuments)
    .where(inArray(verificationDocuments.campaignId, campaignIds))
    .groupBy(verificationDocuments.campaignId);

  const docCounts = Object.fromEntries(docCountsRaw.map((c) => [c.campaignId, c.docCount]));

  const serialized = queuedCampaigns.map((c) => ({
    ...c,
    documentCount: docCounts[c.id] || 0,
    stripeVerificationId: c.stripeVerificationId ?? null,
    totalReleasedAmount: c.totalReleasedAmount ?? 0,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    verificationReviewedAt: c.verificationReviewedAt?.toISOString() ?? null,
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
