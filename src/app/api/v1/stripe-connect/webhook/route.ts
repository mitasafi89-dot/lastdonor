import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, campaigns, campaignWithdrawals } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { mapAccountToStatus } from '@/lib/stripe-connect';
import { notifyWithdrawalCompleted } from '@/lib/notifications';
import type Stripe from 'stripe';

const CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

// In-memory dedup (durable guard is DB unique constraints / idempotent updates)
const processedEvents = new Set<string>();

/**
 * POST /api/v1/stripe-connect/webhook
 * Handles Stripe Connect webhook events for account status changes and transfer updates.
 */
export async function POST(request: NextRequest) {
  if (!CONNECT_WEBHOOK_SECRET) {
    console.error('[Connect Webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    event = stripe.webhooks.constructEvent(rawBody, signature, CONNECT_WEBHOOK_SECRET);
  } catch (error) {
    console.error('[Connect Webhook] Signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 },
    );
  }

  // Idempotency check
  if (processedEvents.has(event.id)) {
    return NextResponse.json({ received: true });
  }
  processedEvents.add(event.id);

  // Cap set size to prevent memory leak
  if (processedEvents.size > 10000) {
    const iter = processedEvents.values();
    for (let i = 0; i < 5000; i++) {
      const val = iter.next().value;
      if (val !== undefined) processedEvents.delete(val);
    }
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case 'transfer.reversed':
        await handleTransferReversed(event.data.object as Stripe.Transfer);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error(`[Connect Webhook] Error processing ${event.type}:`, error);
    // Return 200 to prevent Stripe retries for application errors
  }

  return NextResponse.json({ received: true });
}

/**
 * Syncs a Stripe Connect account status to the local user record.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const userId = account.metadata?.lastdonor_user_id;
  if (!userId) {
    console.warn('[Connect Webhook] account.updated missing lastdonor_user_id:', account.id);
    return;
  }

  const accountInfo = mapAccountToStatus(account);

  const updateFields: Record<string, unknown> = {
    stripeConnectStatus: accountInfo.status,
  };

  if (accountInfo.status === 'verified' || accountInfo.status === 'restricted') {
    // Account has been through onboarding at least once
    updateFields.stripeConnectOnboardedAt = new Date();
  }

  if (account.default_currency) {
    updateFields.payoutCurrency = account.default_currency;
  }

  await db
    .update(users)
    .set(updateFields)
    .where(eq(users.id, userId));

  console.log(`[Connect Webhook] account.updated: user=${userId} status=${accountInfo.status}`);
}

/**
 * Handles a completed transfer by marking the withdrawal as completed
 * and incrementing campaign's totalWithdrawnAmount.
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  const withdrawalId = transfer.metadata?.withdrawal_id;
  const campaignId = transfer.metadata?.campaign_id;

  if (!withdrawalId || !campaignId) {
    console.warn('[Connect Webhook] transfer.paid missing metadata:', transfer.id);
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(campaignWithdrawals)
      .set({
        status: 'completed',
        processedAt: new Date(),
      })
      .where(eq(campaignWithdrawals.id, withdrawalId));

    await tx
      .update(campaigns)
      .set({
        totalWithdrawnAmount: sql`${campaigns.totalWithdrawnAmount} + ${transfer.amount}`,
      })
      .where(eq(campaigns.id, campaignId));
  });

  // Send notification to the campaign creator
  try {
    const [campaign] = await db
      .select({ title: campaigns.title, creatorId: campaigns.creatorId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaign?.creatorId) {
      const [creator] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, campaign.creatorId))
        .limit(1);

      if (creator?.email) {
        notifyWithdrawalCompleted({
          creatorId: campaign.creatorId,
          creatorEmail: creator.email,
          creatorName: creator.name ?? 'Campaigner',
          campaignTitle: campaign.title ?? 'Campaign',
          amount: transfer.amount,
          transferId: transfer.id,
        }).catch((err) => console.error('[Connect Webhook] notification error:', err));
      }
    }
  } catch (err) {
    console.error('[Connect Webhook] Failed to send transfer.paid notification:', err);
  }

  console.log(`[Connect Webhook] transfer.created: withdrawal=${withdrawalId} amount=${transfer.amount}`);
}

/**
 * Handles a reversed transfer by decrementing the campaign's totalWithdrawnAmount
 * and marking the withdrawal as failed.
 */
async function handleTransferReversed(transfer: Stripe.Transfer) {
  const withdrawalId = transfer.metadata?.withdrawal_id;
  const campaignId = transfer.metadata?.campaign_id;

  if (!withdrawalId || !campaignId) {
    console.warn('[Connect Webhook] transfer.reversed missing metadata:', transfer.id);
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(campaignWithdrawals)
      .set({
        status: 'failed',
        failureReason: 'Transfer reversed',
        processedAt: new Date(),
      })
      .where(eq(campaignWithdrawals.id, withdrawalId));

    await tx
      .update(campaigns)
      .set({
        totalWithdrawnAmount: sql`GREATEST(0, ${campaigns.totalWithdrawnAmount} - ${transfer.amount})`,
      })
      .where(eq(campaigns.id, campaignId));
  });

  console.log(`[Connect Webhook] transfer.reversed: withdrawal=${withdrawalId} amount=${transfer.amount}`);
}
