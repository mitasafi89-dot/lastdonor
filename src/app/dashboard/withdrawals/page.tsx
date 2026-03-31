import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, campaigns, campaignWithdrawals, campaignMilestones } from '@/db/schema';
import { eq, desc, inArray, and, sql } from 'drizzle-orm';
import FinancesClient from '@/components/dashboard/FinancesClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Finances — Dashboard — LastDonor.org',
  robots: { index: false },
};

export default async function FinancesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard/withdrawals');
  const userId = session.user.id;

  // User's Stripe Connect status
  const [user] = await db
    .select({
      stripeConnectStatus: users.stripeConnectStatus,
      stripeConnectAccountId: users.stripeConnectAccountId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // All campaigns created by user
  const userCampaigns = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      status: campaigns.status,
      goalAmount: campaigns.goalAmount,
      raisedAmount: campaigns.raisedAmount,
      totalReleasedAmount: campaigns.totalReleasedAmount,
      totalWithdrawnAmount: campaigns.totalWithdrawnAmount,
      milestoneFundRelease: campaigns.milestoneFundRelease,
    })
    .from(campaigns)
    .where(eq(campaigns.creatorId, userId))
    .orderBy(desc(campaigns.createdAt));

  const campaignIds = userCampaigns.map((c) => c.id);

  let allMilestones: Array<{
    id: string;
    campaignId: string;
    phase: number;
    title: string;
    fundPercentage: number;
    fundAmount: number | null;
    status: string;
    releasedAmount: number;
  }> = [];
  let inFlightByCampaign: Record<string, number> = {};
  let withdrawalRows: Array<{
    id: string;
    campaignId: string;
    campaignTitle: string | null;
    campaignSlug: string | null;
    amount: number;
    status: string;
    notes: string | null;
    failureReason: string | null;
    requestedAt: Date;
    processedAt: Date | null;
  }> = [];

  if (campaignIds.length > 0) {
    // Fetch milestones, in-flight withdrawals, and full withdrawal history in parallel
    const [milestones, inFlightRows, wdRows] = await Promise.all([
      db
        .select({
          id: campaignMilestones.id,
          campaignId: campaignMilestones.campaignId,
          phase: campaignMilestones.phase,
          title: campaignMilestones.title,
          fundPercentage: campaignMilestones.fundPercentage,
          fundAmount: campaignMilestones.fundAmount,
          status: campaignMilestones.status,
          releasedAmount: campaignMilestones.releasedAmount,
        })
        .from(campaignMilestones)
        .where(inArray(campaignMilestones.campaignId, campaignIds)),

      db
        .select({
          campaignId: campaignWithdrawals.campaignId,
          total: sql<number>`COALESCE(SUM(${campaignWithdrawals.amount}), 0)::int`,
        })
        .from(campaignWithdrawals)
        .where(
          and(
            inArray(campaignWithdrawals.campaignId, campaignIds),
            inArray(campaignWithdrawals.status, ['requested', 'approved', 'processing']),
          ),
        )
        .groupBy(campaignWithdrawals.campaignId),

      db
        .select({
          id: campaignWithdrawals.id,
          campaignId: campaignWithdrawals.campaignId,
          campaignTitle: campaigns.title,
          campaignSlug: campaigns.slug,
          amount: campaignWithdrawals.amount,
          status: campaignWithdrawals.status,
          notes: campaignWithdrawals.notes,
          failureReason: campaignWithdrawals.failureReason,
          requestedAt: campaignWithdrawals.requestedAt,
          processedAt: campaignWithdrawals.processedAt,
        })
        .from(campaignWithdrawals)
        .innerJoin(campaigns, eq(campaignWithdrawals.campaignId, campaigns.id))
        .where(eq(campaignWithdrawals.requestedBy, userId))
        .orderBy(desc(campaignWithdrawals.requestedAt)),
    ]);

    allMilestones = milestones;
    inFlightByCampaign = Object.fromEntries(inFlightRows.map((r) => [r.campaignId, r.total]));
    withdrawalRows = wdRows;
  }

  // Group milestones by campaign
  const milestoneMap = new Map<string, typeof allMilestones>();
  for (const m of allMilestones) {
    const arr = milestoneMap.get(m.campaignId) ?? [];
    arr.push(m);
    milestoneMap.set(m.campaignId, arr);
  }

  // Build enriched campaign data with computed fields
  const enrichedCampaigns = userCampaigns.map((c) => {
    const released = c.totalReleasedAmount ?? 0;
    const withdrawn = c.totalWithdrawnAmount ?? 0;
    const inFlight = inFlightByCampaign[c.id] ?? 0;
    return {
      id: c.id,
      title: c.title ?? 'Untitled Campaign',
      slug: c.slug ?? '',
      status: c.status ?? 'active',
      goalAmount: c.goalAmount,
      raisedAmount: c.raisedAmount ?? 0,
      totalReleasedAmount: released,
      totalWithdrawnAmount: withdrawn,
      inFlightAmount: inFlight,
      availableBalance: Math.max(0, released - withdrawn - inFlight),
      milestoneFundRelease: c.milestoneFundRelease,
      milestones: (milestoneMap.get(c.id) ?? [])
        .sort((a, b) => a.phase - b.phase)
        .map((m) => ({
          id: m.id,
          phase: m.phase,
          title: m.title,
          fundPercentage: m.fundPercentage,
          fundAmount: m.fundAmount ?? 0,
          status: m.status,
          releasedAmount: m.releasedAmount,
        })),
    };
  });

  const serializedWithdrawals = withdrawalRows.map((r) => ({
    id: r.id,
    campaignId: r.campaignId,
    campaignTitle: r.campaignTitle ?? 'Unknown',
    campaignSlug: r.campaignSlug ?? '',
    amount: r.amount,
    status: r.status,
    notes: r.notes,
    failureReason: r.failureReason,
    requestedAt: r.requestedAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
  }));

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-foreground">Finances</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Track your campaign funds, milestone releases, and withdrawals
      </p>
      <div className="mt-6">
        <FinancesClient
          stripeConnectStatus={user?.stripeConnectStatus ?? 'not_started'}
          hasStripeAccount={!!user?.stripeConnectAccountId}
          campaigns={enrichedCampaigns}
          withdrawals={serializedWithdrawals}
        />
      </div>
    </>
  );
}
