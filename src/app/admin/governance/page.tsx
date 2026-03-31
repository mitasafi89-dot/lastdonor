import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { campaigns, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { GovernancePanel } from '@/components/admin/GovernancePanel';

export const metadata: Metadata = {
  title: 'Campaign Governance — Admin — LastDonor.org',
  robots: { index: false },
};

export const revalidate = 60;

export default async function AdminGovernancePage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/admin');

  const rows = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      status: campaigns.status,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      donorCount: campaigns.donorCount,
      creatorName: users.name,
      creatorEmail: users.email,
      pausedAt: campaigns.pausedAt,
      pausedReason: campaigns.pausedReason,
      suspendedAt: campaigns.suspendedAt,
      suspendedReason: campaigns.suspendedReason,
      cancelledAt: campaigns.cancelledAt,
      cancellationReason: campaigns.cancellationReason,
      verificationStatus: campaigns.verificationStatus,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .leftJoin(users, eq(campaigns.creatorId, users.id))
    .orderBy(desc(campaigns.updatedAt))
    .limit(200);

  const serialized = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    pausedAt: r.pausedAt?.toISOString() ?? null,
    suspendedAt: r.suspendedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Campaign Governance</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} campaigns loaded
        </p>
      </div>
      <GovernancePanel campaigns={serialized} />
    </>
  );
}
