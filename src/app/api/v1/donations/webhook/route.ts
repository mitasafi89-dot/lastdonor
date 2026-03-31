import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, donations, users, auditLogs, fundPoolAllocations, campaignMessages, campaignUpdates, donorCampaignSubscriptions, campaignMilestones } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { getCampaignPhase } from '@/lib/utils/phase';
import { revalidatePath } from 'next/cache';
import { resend } from '@/lib/resend';
import { notifyAdminsDonationReceived, notifyCreatorDonationReceived, notifyCreatorMilestoneReached, notifyAdminMilestoneReached, notifyCreatorFirstDonation, notifyCreatorCampaignCompleted } from '@/lib/notifications';
import { formatDocumentRequirementsHtml } from '@/lib/document-requirements';
import type Stripe from 'stripe';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// In-memory dedup provides fast-path idempotency within a single instance.
// The DB unique constraint on stripe_payment_id is the durable idempotency guard.
const processedEvents = new Set<string>();

export async function POST(request: NextRequest) {
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

    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error);
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

  // Prevent memory leak: cap the set size
  if (processedEvents.size > 10000) {
    const iter = processedEvents.values();
    for (let i = 0; i < 5000; i++) {
      const val = iter.next().value;
      if (val !== undefined) processedEvents.delete(val);
    }
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      case 'invoice.payment_succeeded':
        // Recurring donation — extract PaymentIntent from invoice
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.payment_intent && typeof invoice.payment_intent === 'string') {
          const pi = await stripe.paymentIntents.retrieve(invoice.payment_intent);
          await handlePaymentSuccess(pi);
        }
        break;

      default:
        // Unhandled event type
        break;
    }
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    // Still return 200 to prevent Stripe retries for application errors
  }

  return NextResponse.json({ received: true });
}

export async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata;
  const campaignId = meta.campaignId;
  const donorName = meta.donorName || 'Anonymous';
  const donorEmail = meta.donorEmail;
  const donorLocation = meta.donorLocation || null;
  const message = meta.message || null;
  const isAnonymous = meta.isAnonymous === 'true';
  const isRecurring = meta.isRecurring === 'true';
  const subscribedToUpdates = meta.subscribedToUpdates === 'true';
  const amount = paymentIntent.amount;

  if (!campaignId || !donorEmail) {
    console.error('[Webhook] Missing required metadata on PaymentIntent:', paymentIntent.id);
    return;
  }

  // Fetch campaign to determine current phase
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    console.error('[Webhook] Campaign not found:', campaignId);
    return;
  }

  // C4 fix: reject donations on already-completed campaigns
  if (campaign.status === 'completed') {
    console.warn('[Webhook] Donation received for completed campaign — refunding:', campaignId, paymentIntent.id);
    try {
      await stripe.refunds.create({ payment_intent: paymentIntent.id });
    } catch (refundError) {
      console.error('[Webhook] Auto-refund failed for completed campaign donation:', refundError);
    }
    return;
  }

  const phase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);

  // Look up registered user by email
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, donorEmail))
    .limit(1);

  // Use a transaction for atomicity
  const txResult = await db.transaction(async (tx) => {
    // Insert donation record — unique constraint on stripe_payment_id prevents duplicates
    const insertResult = await tx.insert(donations).values({
      campaignId,
      userId: user?.id ?? null,
      stripePaymentId: paymentIntent.id,
      amount,
      donorName,
      donorEmail,
      donorLocation,
      message,
      isAnonymous,
      isRecurring,
      phaseAtTime: phase,
      source: 'real',
    }).onConflictDoNothing({ target: donations.stripePaymentId }).returning({ id: donations.id });

    // If no row returned, this payment was already processed (duplicate webhook)
    if (insertResult.length === 0) {
      return null;
    }
    const donationRecord = insertResult[0];

    // Update campaign tallies atomically using SQL expressions
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
      await tx
        .update(campaigns)
        .set({
          status: 'completed',
          completedAt: new Date(),
          lastDonorName: isAnonymous ? 'Anonymous' : donorName,
          lastDonorAmount: amount,
          ...(user ? { lastDonorId: user.id } : {}),
        })
        .where(eq(campaigns.id, campaignId));

      // Update last donor count for user
      if (user) {
        await tx
          .update(users)
          .set({
            lastDonorCount: sql`${users.lastDonorCount} + 1`,
          })
          .where(eq(users.id, user.id));
      }

      // Insert celebration update (H2 fix)
      const lastDonorDisplay = isAnonymous ? 'An anonymous donor' : donorName;
      await tx.insert(campaignUpdates).values({
        campaignId,
        title: '🎉 Campaign Goal Reached!',
        bodyHtml: `<p><strong>${lastDonorDisplay}</strong> just made the final donation of $${(amount / 100).toFixed(2)}, pushing this campaign past its goal of $${(goalAmount / 100).toFixed(2)}!</p><p>Thank you to every single donor who made this possible. This campaign has now been fully funded.</p>`,
        updateType: 'celebration',
      });

      // Mark ALL remaining pending milestones as 'reached' on completion
      if (campaign.milestoneFundRelease) {
        await tx
          .update(campaignMilestones)
          .set({ status: 'reached', updatedAt: new Date() })
          .where(and(
            eq(campaignMilestones.campaignId, campaignId),
            eq(campaignMilestones.status, 'pending'),
          ));
      }
    }
    // Check if campaign enters Last Donor Zone
    else if (
      newRaised >= goalAmount * 0.9 &&
      campaign.status === 'active'
    ) {
      await tx
        .update(campaigns)
        .set({ status: 'last_donor_zone' })
        .where(eq(campaigns.id, campaignId));
    }

    // Update user stats if the donor is a registered user
    if (user) {
      await tx
        .update(users)
        .set({
          totalDonated: sql`${users.totalDonated} + ${amount}`,
          campaignsSupported: sql`${users.campaignsSupported} + 1`,
          lastDonationAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    // Audit log
    await tx.insert(auditLogs).values({
      eventType: 'donation.recorded',
      actorId: user?.id ?? null,
      targetType: 'donation',
      targetId: campaignId,
      details: {
        amount,
        campaignId,
        stripePaymentId: paymentIntent.id,
        phase,
        isAnonymous,
      },
      severity: 'info',
    });

    // Fund pool tracking: if donation went to a simulated campaign
    // Determine from DB (not Stripe metadata) so simulation status is never client-exposed
    if (campaign.simulationFlag) {
      await tx.insert(fundPoolAllocations).values({
        donationId: donationRecord.id,
        sourceCampaignId: campaignId,
        amount,
        status: 'pending',
      });

      await tx.insert(auditLogs).values({
        eventType: 'fund_pool.donation_received',
        targetType: 'donation',
        targetId: donationRecord.id,
        severity: 'info',
        details: {
          amount,
          campaignId,
          paymentIntentId: paymentIntent.id,
        },
      });
    }

    // Insert campaign message if donor left a message
    if (message) {
      await tx.insert(campaignMessages).values({
        campaignId,
        userId: user?.id ?? null,
        donorName: isAnonymous ? 'Anonymous' : donorName,
        donorLocation: isAnonymous ? null : donorLocation,
        message,
        isAnonymous,
        donationId: donationRecord.id,
      });
    }

    return { newRaised, goalAmount, justCompleted };
  });

  // Duplicate webhook — already processed
  if (!txResult) return;

  const { newRaised, goalAmount, justCompleted } = txResult;

  // Create campaign subscription if donor opted in
  if (subscribedToUpdates && donorEmail) {
    try {
      await db
        .insert(donorCampaignSubscriptions)
        .values({
          donorEmail,
          userId: user?.id ?? null,
          campaignId,
          subscribed: true,
        })
        .onConflictDoNothing();
    } catch (subErr) {
      console.error('[Webhook] Failed to create campaign subscription:', subErr);
    }
  }

  // ISR revalidation (outside transaction — not DB-dependent)
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath('/campaigns');

  // Send donation receipt email
  try {
    // Check user email preferences if they are a registered user
    let shouldSend = true;
    if (user) {
      const [userData] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const prefs = userData?.preferences as Record<string, unknown> | null;
      if (prefs?.emailDonationReceipts === false) {
        shouldSend = false;
      }
    }

    if (shouldSend && donorEmail) {
      await resend.emails.send({
        from: 'LastDonor.org <receipts@lastdonor.org>',
        to: donorEmail,
        subject: `Donation Receipt — ${campaign.title}`,
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h1 style="color: #0F766E; font-size: 24px;">Thank You for Your Donation!</h1>
            <p>Dear ${isAnonymous ? 'Donor' : donorName},</p>
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
            <p style="color: #999; font-size: 12px;">LastDonor.org &mdash; Every campaign has a last donor. Will it be you?</p>
          </div>
        `,
      });
    }
  } catch (emailError) {
    // Don't fail the webhook if email sending fails
    console.error('[Webhook] Failed to send receipt email:', emailError);
  }

  // Notify admins and campaign creator about the donation
  try {
    await notifyAdminsDonationReceived({
      campaignId,
      campaignSlug: campaign.slug,
      campaignTitle: campaign.title,
      donorName,
      amount,
      isAnonymous,
      message,
      // If the campaign creator is an admin, skip them here — they get a
      // personalized creator notification below instead of the generic admin one.
      excludeUserId: campaign.creatorId ?? undefined,
    });

    if (campaign.creatorId) {
      await notifyCreatorDonationReceived({
        creatorId: campaign.creatorId,
        campaignId,
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug,
        donorName,
        amount,
        isAnonymous,
        message,
      });
    }
  } catch (notifError) {
    console.error('[Webhook] Failed to send donation notifications:', notifError);
  }

  // ── First donation trigger ────────────────────────────────────────────────
  // If the campaign had 0 donors before this donation, this is the FIRST donation.
  // Send celebratory email with banking details request (psychological golden moment).
  if (campaign.donorCount === 0 && campaign.creatorId) {
    try {
      const [creator] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, campaign.creatorId))
        .limit(1);

      if (creator) {
        await notifyCreatorFirstDonation({
          creatorId: creator.id,
          creatorEmail: creator.email,
          creatorName: creator.name || 'Campaigner',
          campaignTitle: campaign.title,
          campaignSlug: campaign.slug,
          donorName,
          amount,
          isAnonymous,
        });
      }
    } catch (firstDonErr) {
      console.error('[Webhook] Failed to send first donation notification:', firstDonErr);
    }
  }

  // ── Campaign completion → creator verification request ────────────────────
  // When a campaign just completed, notify the creator with per-category document
  // requirements. This starts the verification clock for fund release.
  if (justCompleted && campaign.creatorId) {
    try {
      const [creator] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, campaign.creatorId))
        .limit(1);

      if (creator) {
        const docReqsHtml = formatDocumentRequirementsHtml(
          campaign.category,
          campaign.beneficiaryRelation ?? 'other',
        );

        await notifyCreatorCampaignCompleted({
          creatorId: creator.id,
          creatorEmail: creator.email,
          creatorName: creator.name || 'Campaigner',
          campaignTitle: campaign.title,
          campaignSlug: campaign.slug,
          goalAmount,
          donorCount: campaign.donorCount + 1,
          documentRequirementsHtml: docReqsHtml,
        });
      }
    } catch (completionErr) {
      console.error('[Webhook] Failed to send campaign completion notification:', completionErr);
    }
  }

  // ── Milestone threshold detection ─────────────────────────────────────────
  // Check if this donation pushed the campaign past any milestone funding thresholds.
  // During the campaign: milestone reached = celebration only (no evidence request).
  // Evidence submission and fund release happen only AFTER campaign completion.
  if (campaign.milestoneFundRelease) {
    try {
      const milestones = await db
        .select()
        .from(campaignMilestones)
        .where(and(
          eq(campaignMilestones.campaignId, campaignId),
          eq(campaignMilestones.status, 'pending'),
        ))
        .orderBy(campaignMilestones.phase);

      if (milestones.length > 0) {
        // Get all milestones (including non-pending) to compute cumulative thresholds
        const allMilestones = await db
          .select({ phase: campaignMilestones.phase, fundPercentage: campaignMilestones.fundPercentage })
          .from(campaignMilestones)
          .where(eq(campaignMilestones.campaignId, campaignId))
          .orderBy(campaignMilestones.phase);

        // Build cumulative threshold map: phase → cumulative percentage
        const cumulativeMap = new Map<number, number>();
        let cumulative = 0;
        for (const m of allMilestones) {
          cumulative += m.fundPercentage;
          cumulativeMap.set(m.phase, cumulative);
        }

        // Fetch creator info for notifications
        let creator: { id: string; email: string; name: string | null } | null = null;
        if (campaign.creatorId) {
          const [c] = await db
            .select({ id: users.id, email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, campaign.creatorId))
            .limit(1);
          creator = c ?? null;
        }

        for (const milestone of milestones) {
          const thresholdPercent = cumulativeMap.get(milestone.phase) ?? 100;
          const thresholdAmount = Math.round(goalAmount * thresholdPercent / 100);

          if (newRaised >= thresholdAmount) {
            // Mark milestone as reached
            await db
              .update(campaignMilestones)
              .set({ status: 'reached', updatedAt: new Date() })
              .where(eq(campaignMilestones.id, milestone.id));

            // Notify creator — celebration only (no evidence request during campaign)
            if (creator) {
              await notifyCreatorMilestoneReached({
                creatorId: creator.id,
                creatorEmail: creator.email,
                creatorName: creator.name || 'Campaigner',
                campaignTitle: campaign.title,
                campaignSlug: campaign.slug,
                milestoneTitle: milestone.title,
                phaseNumber: milestone.phase,
                fundAmount: milestone.fundAmount ?? 0,
              });
            }

            // Notify admins
            await notifyAdminMilestoneReached({
              campaignTitle: campaign.title,
              campaignSlug: campaign.slug,
              milestoneTitle: milestone.title,
              phaseNumber: milestone.phase,
              fundAmount: milestone.fundAmount ?? 0,
              creatorName: creator?.name || 'Unknown',
            });

            await db.insert(auditLogs).values({
              eventType: 'milestone.reached',
              targetType: 'campaign',
              targetId: campaignId,
              severity: 'info',
              details: {
                milestoneId: milestone.id,
                phase: milestone.phase,
                thresholdPercent,
                thresholdAmount,
                raisedAmount: newRaised,
              },
            });
          }
        }
      }
    } catch (milestoneError) {
      console.error('[Webhook] Failed to check milestone thresholds:', milestoneError);
    }
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
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

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  // Find the donation
  const [donation] = await db
    .select()
    .from(donations)
    .where(eq(donations.stripePaymentId, paymentIntentId))
    .limit(1);

  if (!donation) return;

  // Idempotency: skip if already refunded
  if (donation.refunded) return;

  await db.transaction(async (tx) => {
    // Mark as refunded
    await tx
      .update(donations)
      .set({ refunded: true })
      .where(eq(donations.id, donation.id));

    // Update campaign tallies
    await tx
      .update(campaigns)
      .set({
        raisedAmount: sql`GREATEST(${campaigns.raisedAmount} - ${donation.amount}, 0)`,
        donorCount: sql`GREATEST(${campaigns.donorCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, donation.campaignId));

    // Audit log
    await tx.insert(auditLogs).values({
      eventType: 'donation.refunded',
      targetType: 'donation',
      targetId: donation.id,
      details: {
        amount: donation.amount,
        campaignId: donation.campaignId,
        stripePaymentId: paymentIntentId,
      },
      severity: 'warning',
    });
  });

  // Fetch campaign slug for revalidation
  const [campaign] = await db
    .select({ slug: campaigns.slug })
    .from(campaigns)
    .where(eq(campaigns.id, donation.campaignId))
    .limit(1);

  if (campaign) {
    revalidatePath(`/campaigns/${campaign.slug}`);
    revalidatePath('/campaigns');
  }
}
