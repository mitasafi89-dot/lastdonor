import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignWithdrawals, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { withdrawalRequestSchema } from '@/lib/validators/payout';
import { createTransfer } from '@/lib/stripe-connect';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

/**
 * POST /api/v1/user-campaigns/[id]/withdraw
 * Creator-initiated withdrawal. Validates ownership, Connect status,
 * available balance, then creates a Stripe transfer.
 */
export async function POST(
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

  // Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  const parsed = withdrawalRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: firstError.message, field: firstError.path.join('.'), requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  const { amount } = parsed.data;

  // Fetch campaign and verify ownership
  const [campaign] = await db
    .select({
      id: campaigns.id,
      creatorId: campaigns.creatorId,
      totalReleasedAmount: campaigns.totalReleasedAmount,
      totalWithdrawnAmount: campaigns.totalWithdrawnAmount,
      title: campaigns.title,
    })
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

  // Verify the user has a verified Stripe Connect account
  const [user] = await db
    .select({
      stripeConnectAccountId: users.stripeConnectAccountId,
      stripeConnectStatus: users.stripeConnectStatus,
      payoutCurrency: users.payoutCurrency,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.stripeConnectAccountId || user.stripeConnectStatus !== 'verified') {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Complete Stripe Connect setup before withdrawing', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  // Check available balance
  const availableBalance = (campaign.totalReleasedAmount ?? 0) - (campaign.totalWithdrawnAmount ?? 0);
  if (amount > availableBalance) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: `Insufficient balance. Available: ${availableBalance} cents`, requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  // Create withdrawal record and execute Stripe transfer
  const withdrawalId = randomUUID();
  const currency = user.payoutCurrency ?? 'usd';

  try {
    // Insert withdrawal as 'processing'
    await db.insert(campaignWithdrawals).values({
      id: withdrawalId,
      campaignId: campaign.id,
      requestedBy: session.user.id,
      amount,
      status: 'processing',
      stripeConnectAccount: user.stripeConnectAccountId,
    });

    // Execute Stripe transfer
    const transferResult = await createTransfer(
      amount,
      currency,
      user.stripeConnectAccountId,
      {
        campaign_id: campaign.id,
        campaign_title: campaign.title ?? '',
        withdrawal_id: withdrawalId,
        user_id: session.user.id,
      },
    );

    // Update withdrawal with transfer ID
    await db
      .update(campaignWithdrawals)
      .set({ stripeTransferId: transferResult.transferId })
      .where(eq(campaignWithdrawals.id, withdrawalId));

    const data = {
      withdrawalId,
      amount,
      currency,
      transferId: transferResult.transferId,
      status: 'processing' as const,
    };

    const response: ApiResponse<typeof data> = { ok: true, data };
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/user-campaigns/[id]/withdraw]', err);

    // Mark withdrawal as failed if it was inserted
    await db
      .update(campaignWithdrawals)
      .set({
        status: 'failed',
        failureReason: err instanceof Error ? err.message : 'Transfer failed',
        processedAt: new Date(),
      })
      .where(eq(campaignWithdrawals.id, withdrawalId));

    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Withdrawal failed. Please try again.', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
