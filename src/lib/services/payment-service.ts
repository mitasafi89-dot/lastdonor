/**
 * Payment Processing Service
 *
 * SOLID: Single Responsibility - handles the business logic of processing
 * successful payments, separated from the HTTP webhook handler.
 *
 * The webhook route.ts is now a thin adapter that verifies Stripe signatures
 * and delegates to this service.
 */

import { db } from '@/db';
import {
  campaigns, donations, users, auditLogs, fundPoolAllocations,
  campaignMessages, campaignUpdates, donorCampaignSubscriptions,
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { getCampaignPhase } from '@/lib/utils/phase';
import { revalidatePath } from 'next/cache';
import { resend } from '@/lib/resend';
import { retryWithBackoff } from '@/lib/utils/retry';
import {
  notifyAdminsDonationReceived, notifyCreatorDonationReceived,
  notifyCreatorFirstDonation, notifyCreatorCampaignCompleted,
} from '@/lib/notifications';
import { formatDocumentRequirementsHtml } from '@/lib/document-requirements';
import { logError } from '@/lib/errors';
import { safeAsync } from '@/lib/api-handler';
import type Stripe from 'stripe';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PaymentMetadata {
  campaignId: string;
  donorName: string;
  donorEmail: string;
  donorLocation: string | null;
  message: string | null;
  isAnonymous: boolean;
  isRecurring: boolean;
  subscribedToUpdates: boolean;
}

interface TransactionResult {
  newRaised: number;
  goalAmount: number;
  justCompleted: boolean;
  donationId: string;
}

// ─── Metadata Extraction (Fail Fast) ────────────────────────────────────────

function extractMetadata(paymentIntent: Stripe.PaymentIntent): PaymentMetadata | null {
  const meta = paymentIntent.metadata;
  if (!meta.campaignId || !meta.donorEmail) {
    logError(
      new Error('Missing required metadata on PaymentIntent'),
      { requestId: paymentIntent.id, route: 'webhook/payment-service' },
    );
    return null;
  }

  return {
    campaignId: meta.campaignId,
    donorName: meta.donorName || 'Anonymous',
    donorEmail: meta.donorEmail,
    donorLocation: meta.donorLocation || null,
    message: meta.message || null,
    isAnonymous: meta.isAnonymous === 'true',
    isRecurring: meta.isRecurring === 'true',
    subscribedToUpdates: meta.subscribedToUpdates === 'true',
  };
}

// ─── Core Transaction ───────────────────────────────────────────────────────

async function processPaymentTransaction(
  paymentIntent: Stripe.PaymentIntent,
  meta: PaymentMetadata,
  campaign: typeof campaigns.$inferSelect,
  userId: string | null,
): Promise<TransactionResult | null> {
  const { campaignId, donorName, donorLocation, message, isAnonymous, isRecurring } = meta;
  const amount = paymentIntent.amount;
  // Compute phase from post-increment value to avoid stale reads under concurrency
  const phase = getCampaignPhase(campaign.raisedAmount + amount, campaign.goalAmount);

  return db.transaction(async (tx) => {
    // Insert donation - unique constraint on stripe_payment_id prevents duplicates
    const insertResult = await tx.insert(donations).values({
      campaignId,
      userId,
      stripePaymentId: paymentIntent.id,
      amount,
      donorName,
      donorEmail: meta.donorEmail,
      donorLocation,
      message,
      isAnonymous,
      isRecurring,
      phaseAtTime: phase,
      source: 'real',
    }).onConflictDoNothing({ target: donations.stripePaymentId }).returning({ id: donations.id });

    if (insertResult.length === 0) return null; // Duplicate webhook

    const donationId = insertResult[0].id;

    // Update campaign tallies atomically
    const newRaisedResult = await tx
      .update(campaigns)
      .set({
        raisedAmount: sql`${campaigns.raisedAmount} + ${amount}`,
        donorCount: sql`${campaigns.donorCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId))
      .returning({ raisedAmount: campaigns.raisedAmount, goalAmount: campaigns.goalAmount });

    const newRaised = newRaisedResult[0]?.raisedAmount ?? campaign.raisedAmount + amount;
    const goalAmount = newRaisedResult[0]?.goalAmount ?? campaign.goalAmount;

    let justCompleted = false;

    // Check if campaign is now completed
    if (newRaised >= goalAmount && campaign.status !== 'completed') {
      justCompleted = true;
      await tx.update(campaigns).set({
        status: 'completed',
        completedAt: new Date(),
        lastDonorName: isAnonymous ? 'Anonymous' : donorName,
        lastDonorAmount: amount,
        ...(userId ? { lastDonorId: userId } : {}),
      }).where(eq(campaigns.id, campaignId));

      if (userId) {
        await tx.update(users).set({
          lastDonorCount: sql`${users.lastDonorCount} + 1`,
        }).where(eq(users.id, userId));
      }

      // Celebration update
      const lastDonorDisplay = isAnonymous ? 'An anonymous donor' : donorName;
      await tx.insert(campaignUpdates).values({
        campaignId,
        title: 'Campaign Goal Reached!',
        bodyHtml: `<p><strong>${lastDonorDisplay}</strong> just made the final donation of $${(amount / 100).toFixed(2)}, pushing this campaign past its goal of $${(goalAmount / 100).toFixed(2)}!</p><p>Thank you to every single donor who made this possible. This campaign has now been fully funded.</p>`,
        updateType: 'celebration',
      });
    } else if (newRaised >= goalAmount * 0.9 && campaign.status === 'active') {
      await tx.update(campaigns).set({ status: 'last_donor_zone' }).where(eq(campaigns.id, campaignId));
    }

    // Update user stats
    if (userId) {
      await tx.update(users).set({
        totalDonated: sql`${users.totalDonated} + ${amount}`,
        campaignsSupported: sql`${users.campaignsSupported} + 1`,
        lastDonationAt: new Date(),
      }).where(eq(users.id, userId));
    }

    // Audit log
    await tx.insert(auditLogs).values({
      eventType: 'donation.recorded',
      actorId: userId,
      targetType: 'donation',
      targetId: campaignId,
      details: { amount, campaignId, stripePaymentId: paymentIntent.id, phase, isAnonymous },
      severity: 'info',
    });

    // Fund pool tracking for simulated campaigns
    if (campaign.simulationFlag) {
      await tx.insert(fundPoolAllocations).values({
        donationId,
        sourceCampaignId: campaignId,
        amount,
        status: 'pending',
      });

      await tx.insert(auditLogs).values({
        eventType: 'fund_pool.donation_received',
        targetType: 'donation',
        targetId: donationId,
        severity: 'info',
        details: { amount, campaignId, paymentIntentId: paymentIntent.id },
      });
    }

    // Insert campaign message if donor left one
    if (message) {
      await tx.insert(campaignMessages).values({
        campaignId,
        userId,
        donorName: isAnonymous ? 'Anonymous' : donorName,
        donorLocation: isAnonymous ? null : donorLocation,
        message,
        isAnonymous,
        donationId,
      });
    }

    return { newRaised, goalAmount, justCompleted, donationId };
  });
}

// ─── Post-Transaction Side Effects ──────────────────────────────────────────

async function handlePostPaymentEffects(
  paymentIntent: Stripe.PaymentIntent,
  meta: PaymentMetadata,
  campaign: typeof campaigns.$inferSelect,
  userId: string | null,
  txResult: TransactionResult,
) {
  const { campaignId, donorName, donorEmail, isAnonymous, message: _message, subscribedToUpdates } = meta;
  const amount = paymentIntent.amount;
  const { newRaised: _newRaised, goalAmount, justCompleted } = txResult;
  const requestCtx = { requestId: paymentIntent.id, userId: userId ?? undefined };

  // Campaign subscription (fire-and-forget)
  if (subscribedToUpdates && donorEmail) {
    safeAsync(
      db.insert(donorCampaignSubscriptions).values({
        donorEmail, userId, campaignId, subscribed: true,
      }).onConflictDoNothing(),
      'webhook/campaign-subscription', requestCtx,
    );
  }

  // ISR revalidation
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath('/campaigns');

  // Receipt email (fire-and-forget)
  safeAsync(
    sendDonationReceipt({ paymentIntent, meta, campaign, userId }),
    'webhook/receipt-email', requestCtx,
  );

  // Admin + creator notifications (fire-and-forget)
  safeAsync(
    sendDonationNotifications({ meta, campaign, amount }),
    'webhook/donation-notifications', requestCtx,
  );

  // Pre-fetch creator for completion notifications
  const creator = campaign.creatorId ? await fetchCreator(campaign.creatorId) : null;

  // First donation notification
  if (campaign.donorCount === 0 && creator) {
    safeAsync(
      notifyCreatorFirstDonation({
        creatorId: creator.id,
        creatorEmail: creator.email,
        creatorName: creator.name || 'Campaigner',
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug,
        donorName, amount, isAnonymous,
      }),
      'webhook/first-donation', requestCtx,
    );
  }

  // Campaign completion notification
  if (justCompleted && creator) {
    safeAsync(
      notifyCreatorCampaignCompleted({
        creatorId: creator.id,
        creatorEmail: creator.email,
        creatorName: creator.name || 'Campaigner',
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug,
        goalAmount,
        donorCount: campaign.donorCount + 1,
        documentRequirementsHtml: formatDocumentRequirementsHtml(
          campaign.category,
          campaign.beneficiaryRelation ?? 'other',
        ),
      }),
      'webhook/completion', requestCtx,
    );
  }

}

// ─── Helper Functions ───────────────────────────────────────────────────────

async function fetchCreator(creatorId: string) {
  const [creator] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1);
  return creator ?? null;
}

async function sendDonationReceipt({
  paymentIntent, meta, campaign, userId,
}: {
  paymentIntent: Stripe.PaymentIntent;
  meta: PaymentMetadata;
  campaign: typeof campaigns.$inferSelect;
  userId: string | null;
}) {
  // Check user email preferences
  if (userId) {
    const [userData] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const prefs = userData?.preferences as Record<string, unknown> | null;
    if (prefs?.emailDonationReceipts === false) return;
  }

  if (!meta.donorEmail) return;
  const amount = paymentIntent.amount;

  await retryWithBackoff(
    () => resend.emails.send({
      from: 'LastDonor.org <receipts@lastdonor.org>',
    to: meta.donorEmail,
    subject: `Donation Receipt - ${campaign.title}`,
    html: `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #0F766E; font-size: 24px;">Thank You for Your Donation!</h1>
        <p>Dear ${meta.isAnonymous ? 'Donor' : meta.donorName},</p>
        <p>Your generous donation to <strong>${campaign.title}</strong> has been received and processed successfully.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Amount</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">$${(amount / 100).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Campaign</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${campaign.title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Transaction ID</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-family: monospace; font-size: 12px;">${paymentIntent.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date</td>
            <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 14px;">LastDonor.org is a 501(c)(3) nonprofit organization. This donation may be tax-deductible. Please retain this email as your receipt.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">LastDonor.org - Every campaign has a last donor. Will it be you?</p>
      </div>
    `,
    }),
    { maxRetries: 2, baseDelayMs: 500 },
  );
}

async function sendDonationNotifications({
  meta, campaign, amount,
}: {
  meta: PaymentMetadata;
  campaign: typeof campaigns.$inferSelect;
  amount: number;
}) {
  await notifyAdminsDonationReceived({
    campaignId: meta.campaignId,
    campaignSlug: campaign.slug,
    campaignTitle: campaign.title,
    donorName: meta.donorName,
    amount,
    isAnonymous: meta.isAnonymous,
    message: meta.message,
    excludeUserId: campaign.creatorId ?? undefined,
  });

  if (campaign.creatorId) {
    await notifyCreatorDonationReceived({
      creatorId: campaign.creatorId,
      campaignId: meta.campaignId,
      campaignTitle: campaign.title,
      campaignSlug: campaign.slug,
      donorName: meta.donorName,
      amount,
      isAnonymous: meta.isAnonymous,
      message: meta.message,
    });
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function processPaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const meta = extractMetadata(paymentIntent);
  if (!meta) return;

  // Fetch campaign
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, meta.campaignId))
    .limit(1);

  if (!campaign) {
    logError(
      new Error(`Campaign not found: ${meta.campaignId}`),
      { requestId: paymentIntent.id, route: 'webhook/payment-service' },
    );
    return;
  }

  // Reject donations on completed campaigns
  if (campaign.status === 'completed') {
    logError(
      new Error(`Donation on completed campaign - refunding: ${meta.campaignId}`),
      { requestId: paymentIntent.id, route: 'webhook/payment-service' },
    );
    try {
      await stripe.refunds.create({ payment_intent: paymentIntent.id });
    } catch (refundError) {
      logError(refundError, { requestId: paymentIntent.id, route: 'webhook/auto-refund' });
    }
    return;
  }

  // Look up registered user
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, meta.donorEmail)).limit(1);
  const userId = user?.id ?? null;

  // Core transaction
  const txResult = await processPaymentTransaction(paymentIntent, meta, campaign, userId);
  if (!txResult) return; // Duplicate webhook

  // Side effects (non-blocking where possible)
  await handlePostPaymentEffects(paymentIntent, meta, campaign, userId, txResult);
}

export async function processPaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  await db.insert(auditLogs).values({
    eventType: 'donation.failed',
    targetType: 'donation',
    details: {
      stripePaymentId: paymentIntent.id,
      campaignId: paymentIntent.metadata.campaignId,
      reason: paymentIntent.last_payment_error?.message ?? 'Unknown',
    },
    severity: 'warning',
  });
}

export async function processRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  const [donation] = await db.select().from(donations).where(eq(donations.stripePaymentId, paymentIntentId)).limit(1);
  if (!donation || donation.refunded) return;

  await db.transaction(async (tx) => {
    await tx.update(donations).set({ refunded: true }).where(eq(donations.id, donation.id));

    await tx.update(campaigns).set({
      raisedAmount: sql`GREATEST(${campaigns.raisedAmount} - ${donation.amount}, 0)`,
      donorCount: sql`GREATEST(${campaigns.donorCount} - 1, 0)`,
      updatedAt: new Date(),
    }).where(eq(campaigns.id, donation.campaignId));

    await tx.insert(auditLogs).values({
      eventType: 'donation.refunded',
      targetType: 'donation',
      targetId: donation.id,
      details: { amount: donation.amount, campaignId: donation.campaignId, stripePaymentId: paymentIntentId },
      severity: 'warning',
    });
  });

  const [campaign] = await db.select({ slug: campaigns.slug }).from(campaigns).where(eq(campaigns.id, donation.campaignId)).limit(1);
  if (campaign) {
    revalidatePath(`/campaigns/${campaign.slug}`);
    revalidatePath('/campaigns');
  }
}
