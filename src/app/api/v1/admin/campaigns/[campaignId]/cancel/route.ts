import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { campaigns, donations, auditLogs, refundBatches, refundRecords, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { cancelCampaignSchema } from '@/lib/validators/verification';
import { notifyBulkRefundCompleted } from '@/lib/notifications';
import { campaignCancelledRefundEmail } from '@/lib/email-templates';
import { findSimilarCampaigns } from '@/lib/utils/similar-campaigns';
import { resend } from '@/lib/resend';
import { stripe } from '@/lib/stripe';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import type { CampaignStatus, CampaignCategory, UserRole } from '@/types';

const FROM_ADDRESS = 'LastDonor.org <noreply@lastdonor.org>';

type RouteParams = { params: Promise<{ campaignId: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Statuses that can transition to "cancelled". */
const CANCELLABLE: CampaignStatus[] = ['active', 'last_donor_zone', 'paused', 'under_review', 'suspended', 'draft'];

/**
 * POST /api/v1/admin/campaigns/[campaignId]/cancel
 *
 * Cancels a campaign permanently. Optionally triggers a bulk refund of all
 * un-refunded real donations via Stripe. The refund batch runs inline
 * (one by one) to keep Stripe rate limits in check.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { campaignId } = await params;

  try {
    const session = await requireRole(['admin']);

    if (!UUID_REGEX.test(campaignId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid campaign ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = cancelCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { reason, notes, notifyDonors, refundAll } = parsed.data;

    const [campaign] = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        category: campaigns.category,
        location: campaigns.location,
        raisedAmount: campaigns.raisedAmount,
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

    if (!CANCELLABLE.includes(campaign.status as CampaignStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `Cannot cancel a campaign with status "${campaign.status}".`, requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Mark as cancelled
    await db.update(campaigns).set({
      status: 'cancelled',
      cancellationReason: reason,
      cancellationNotes: notes ?? null,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(campaigns.id, campaignId));

    await db.insert(auditLogs).values({
      eventType: 'campaign.cancelled',
      actorId: session.user?.id ?? null,
      actorRole: session.user?.role as UserRole,
      targetType: 'campaign',
      targetId: campaignId,
      severity: 'critical',
      details: { title: campaign.title, previousStatus: campaign.status, reason, notes, refundAll, notifyDonors },
    });

    let refundSummary: { totalDonors: number; totalAmount: number; failedCount: number } | null = null;

    // Process bulk refund if requested
    if (refundAll) {
      refundSummary = await processBulkRefund({
        campaignId,
        campaignTitle: campaign.title,
        campaignCategory: campaign.category as CampaignCategory,
        campaignLocation: campaign.location,
        adminId: session.user?.id ?? '',
        reason,
      });
    }

    revalidatePath(`/campaigns/${campaign.slug}`);
    return NextResponse.json({
      ok: true,
      data: {
        id: campaignId,
        status: 'cancelled',
        refund: refundSummary,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[POST /api/v1/admin/campaigns/[campaignId]/cancel]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel campaign', requestId } } satisfies ApiError, { status: 500 });
  }
}

// ─── Bulk Refund Engine ─────────────────────────────────────────────────────

async function processBulkRefund(p: {
  campaignId: string;
  campaignTitle: string;
  campaignCategory: CampaignCategory;
  campaignLocation: string | null;
  adminId: string;
  reason: string;
}): Promise<{ totalDonors: number; totalAmount: number; failedCount: number }> {
  // Fetch all un-refunded real donations
  const eligibleDonations = await db
    .select({
      id: donations.id,
      amount: donations.amount,
      stripePaymentId: donations.stripePaymentId,
      donorEmail: donations.donorEmail,
      donorName: donations.donorName,
    })
    .from(donations)
    .where(
      and(
        eq(donations.campaignId, p.campaignId),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  if (eligibleDonations.length === 0) {
    return { totalDonors: 0, totalAmount: 0, failedCount: 0 };
  }

  const totalAmount = eligibleDonations.reduce((sum, d) => sum + d.amount, 0);

  // Create refund batch record
  const [batch] = await db.insert(refundBatches).values({
    campaignId: p.campaignId,
    initiatedBy: p.adminId,
    reason: p.reason,
    totalDonations: eligibleDonations.length,
    totalAmount,
  }).returning({ id: refundBatches.id });

  let refundedCount = 0;
  let failedCount = 0;

  for (const donation of eligibleDonations) {
    let stripeRefundId: string | null = null;
    let errorMessage: string | null = null;
    let status: 'completed' | 'failed' = 'completed';

    if (donation.stripePaymentId) {
      try {
        const refund = await stripe.refunds.create({ payment_intent: donation.stripePaymentId });
        stripeRefundId = refund.id;
      } catch (err: unknown) {
        errorMessage = err instanceof Error ? err.message : 'Unknown Stripe error';
        status = 'failed';
        console.error(`[bulk-refund] Failed to refund donation ${donation.id}:`, errorMessage);
      }
    }

    // Record individual refund result
    await db.insert(refundRecords).values({
      batchId: batch.id,
      donationId: donation.id,
      amount: donation.amount,
      stripeRefundId,
      status,
      errorMessage,
      processedAt: new Date(),
    });

    if (status === 'completed') {
      // Mark donation as refunded
      await db.update(donations).set({ refunded: true }).where(eq(donations.id, donation.id));
      refundedCount++;
    } else {
      failedCount++;
    }
  }

  // Update batch totals
  await db.update(refundBatches).set({
    refundedCount,
    failedCount,
    status: failedCount === 0 ? 'completed' : 'partial_failure',
    completedAt: new Date(),
  }).where(eq(refundBatches.id, batch.id));

  // Since campaign is cancelled with full refund, zero out amounts
  if (refundedCount > 0) {
    await db.update(campaigns).set({
      raisedAmount: 0,
      donorCount: 0,
      updatedAt: new Date(),
    }).where(eq(campaigns.id, p.campaignId));
  }

  // Send per-donor refund notification emails with similar campaign recommendations
  sendDonorRefundEmails({
    eligibleDonations,
    campaignTitle: p.campaignTitle,
    campaignCategory: p.campaignCategory,
    campaignLocation: p.campaignLocation,
    campaignId: p.campaignId,
    reason: p.reason,
  }).catch((err) => console.error('[bulk-refund] donor email error:', err));

  // Notify admins asynchronously
  notifyBulkRefundCompleted({
    campaignId: p.campaignId,
    campaignTitle: p.campaignTitle,
    totalDonors: refundedCount + failedCount,
    totalAmount,
    failedCount,
  }).catch((err) => console.error('[bulk-refund] notification error:', err));

  return { totalDonors: eligibleDonations.length, totalAmount, failedCount };
}

// ─── Per-Donor Refund Email Sender ──────────────────────────────────────────

const CANCELLATION_REASON_MESSAGES: Record<string, string> = {
  identity_fraud: 'After thorough review, our verification team found that the campaigner could not be verified.',
  fabricated_story: 'After thorough review, our verification team found that the campaign story could not be verified with authentic supporting documents.',
  document_forgery: 'After thorough review, our verification team found that the submitted documents were not authentic.',
  campaigner_non_responsive: 'The campaigner did not provide the required evidence within the deadline.',
  duplicate_campaign: 'This campaign was identified as a duplicate of an existing campaign.',
  legal_compliance: 'This campaign was cancelled following a compliance review.',
  campaigner_requested: 'The campaign organizer requested the cancellation of this campaign.',
  terms_violation: 'This campaign was cancelled due to a violation of our platform terms.',
};

async function sendDonorRefundEmails(p: {
  eligibleDonations: Array<{ id: string; amount: number; donorEmail: string; donorName: string }>;
  campaignTitle: string;
  campaignCategory: CampaignCategory;
  campaignLocation: string | null;
  campaignId: string;
  reason: string;
}) {
  // Fetch similar campaigns once for all emails
  const similarCampaigns = await findSimilarCampaigns({
    excludeId: p.campaignId,
    category: p.campaignCategory,
    location: p.campaignLocation,
    limit: 3,
  });

  const reasonMessage = CANCELLATION_REASON_MESSAGES[p.reason] ?? p.reason;

  // Deduplicate by email — send one email per unique donor email
  const seen = new Set<string>();
  for (const donation of p.eligibleDonations) {
    if (seen.has(donation.donorEmail)) continue;
    seen.add(donation.donorEmail);

    const { subject, html } = campaignCancelledRefundEmail({
      donorName: donation.donorName || 'Donor',
      campaignTitle: p.campaignTitle,
      donationAmount: donation.amount,
      cancellationReason: reasonMessage,
      similarCampaigns: similarCampaigns.map((c) => ({
        title: c.title,
        slug: c.slug,
        raised: c.raised,
        goal: c.goal,
      })),
    });

    try {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: donation.donorEmail,
        subject,
        html,
      });
    } catch (err) {
      console.error(`[bulk-refund] Failed to email ${donation.donorEmail}:`, err);
    }
  }
}
