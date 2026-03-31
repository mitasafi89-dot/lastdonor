import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, campaignWithdrawals } from '@/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';

/**
 * GET /api/v1/user/balance
 *
 * Returns the authenticated user's available balance across all campaigns they created.
 * Available = SUM(totalReleasedAmount - totalWithdrawnAmount) - pending/processing withdrawals.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Get all campaigns created by this user
  const userCampaigns = await db
    .select({
      id: campaigns.id,
      totalReleasedAmount: campaigns.totalReleasedAmount,
      totalWithdrawnAmount: campaigns.totalWithdrawnAmount,
    })
    .from(campaigns)
    .where(eq(campaigns.creatorId, userId));

  if (userCampaigns.length === 0) {
    return NextResponse.json({ availableBalance: 0, hasCampaigns: false });
  }

  // Sum released - withdrawn across all campaigns
  const grossAvailable = userCampaigns.reduce(
    (sum, c) => sum + (c.totalReleasedAmount ?? 0) - (c.totalWithdrawnAmount ?? 0),
    0,
  );

  // Subtract in-flight withdrawals (requested/approved/processing)
  // These haven't hit totalWithdrawnAmount yet (only updated by Stripe webhook on completion)
  const campaignIds = userCampaigns.map((c) => c.id);
  const [pendingRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${campaignWithdrawals.amount}), 0)::int` })
    .from(campaignWithdrawals)
    .where(
      and(
        inArray(campaignWithdrawals.campaignId, campaignIds),
        inArray(campaignWithdrawals.status, ['requested', 'approved', 'processing']),
      ),
    );

  const pendingAmount = pendingRow?.total ?? 0;
  const availableBalance = Math.max(0, grossAvailable - pendingAmount);

  return NextResponse.json({ availableBalance, hasCampaigns: true });
}
