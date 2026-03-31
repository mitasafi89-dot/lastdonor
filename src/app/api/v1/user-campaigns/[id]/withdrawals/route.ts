import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignWithdrawals } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

/**
 * GET /api/v1/user-campaigns/[id]/withdrawals
 * Returns paginated withdrawal history for a campaign the user owns.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const { id: campaignId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId } } satisfies ApiError,
      { status: 401 },
    );
  }

  // Verify campaign ownership
  const [campaign] = await db
    .select({ id: campaigns.id, creatorId: campaigns.creatorId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  if (campaign.creatorId !== session.user.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'You do not own this campaign', requestId } } satisfies ApiError,
      { status: 403 },
    );
  }

  // Parse pagination params
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const [withdrawals, countResult] = await Promise.all([
    db
      .select({
        id: campaignWithdrawals.id,
        amount: campaignWithdrawals.amount,
        status: campaignWithdrawals.status,
        stripeTransferId: campaignWithdrawals.stripeTransferId,
        failureReason: campaignWithdrawals.failureReason,
        requestedAt: campaignWithdrawals.requestedAt,
        processedAt: campaignWithdrawals.processedAt,
      })
      .from(campaignWithdrawals)
      .where(eq(campaignWithdrawals.campaignId, campaignId))
      .orderBy(desc(campaignWithdrawals.requestedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignWithdrawals)
      .where(eq(campaignWithdrawals.campaignId, campaignId)),
  ]);

  const total = countResult[0]?.count ?? 0;

  const response: ApiResponse<typeof withdrawals> = {
    ok: true,
    data: withdrawals,
    meta: {
      hasMore: offset + limit < total,
    },
  };
  return NextResponse.json(response);
}
