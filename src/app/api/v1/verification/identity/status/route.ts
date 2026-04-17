import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, auditLogs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, UnauthorizedError } from '@/lib/auth';
import { getIdentityVerificationSession, mapStripeStatusToVerification } from '@/lib/stripe-identity';
import { randomUUID } from 'crypto';
import { identityApprovedEmail, identityDeclinedEmail, identityResubmissionEmail } from '@/lib/email-templates';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/verification/identity/status?campaignId=xxx
 *
 * Polls the Stripe Identity API for a session status when webhook delivery
 * is unavailable (e.g. local development). Updates the DB if a decision
 * is found.
 *
 * Returns { status, decided } with the current verification state.
 */
export async function GET(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const campaignId = req.nextUrl.searchParams.get('campaignId');
    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'campaignId is required', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Load campaign
    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        verificationStatus: campaigns.verificationStatus,
        stripeVerificationId: campaigns.stripeVerificationId,
        title: campaigns.title,
        slug: campaigns.slug,
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

    // Only the campaign owner can poll
    if (campaign.creatorId !== session.user.id) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Not authorized', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }

    // If already decided, just return the current status
    if (['identity_verified', 'fully_verified', 'rejected'].includes(campaign.verificationStatus)) {
      return NextResponse.json({
        ok: true,
        status: campaign.verificationStatus,
        decided: true,
      });
    }

    // No session to poll
    if (!campaign.stripeVerificationId) {
      return NextResponse.json({
        ok: true,
        status: campaign.verificationStatus,
        decided: false,
      });
    }

    // Poll Stripe Identity
    const stripeSession = await getIdentityVerificationSession(campaign.stripeVerificationId);

    if (!stripeSession) {
      return NextResponse.json({
        ok: true,
        status: campaign.verificationStatus,
        decided: false,
      });
    }

    const result = mapStripeStatusToVerification(stripeSession);

    if (!result.decided) {
      return NextResponse.json({
        ok: true,
        status: campaign.verificationStatus,
        decided: false,
      });
    }

    const now = new Date();

    // Update campaign verification status
    const updateFields: Record<string, unknown> = {
      verificationStatus: result.verificationStatus,
      verificationNotes: result.notes,
      updatedAt: now,
    };

    if (result.verificationStatus === 'identity_verified') {
      updateFields.verificationReviewedAt = now;
    }

    if (result.verificationStatus === 'rejected' || result.verificationStatus === 'unverified') {
      // Clear session so user can start a new one
      updateFields.stripeVerificationId = null;
      updateFields.stripeVerificationUrl = null;
    }

    await db
      .update(campaigns)
      .set(updateFields)
      .where(eq(campaigns.id, campaign.id));

    // Audit log
    await db.insert(auditLogs).values({
      actorId: campaign.creatorId,
      eventType: `identity_${result.verificationStatus === 'identity_verified' ? 'approved' : result.verificationStatus === 'rejected' ? 'declined' : 'status_changed'}`,
      targetType: 'campaign',
      targetId: campaign.id,
      details: {
        stripeVerificationId: stripeSession.id,
        stripeStatus: stripeSession.status,
        source: 'polling',
      },
      severity: result.verificationStatus === 'rejected' ? 'warning' : 'info',
    });

    // Send notification email
    if (campaign.creatorId) {
      try {
        const [creator] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, campaign.creatorId))
          .limit(1);

        if (creator) {
          const { createAndEmail } = await import('@/lib/notifications');

          if (result.verificationStatus === 'identity_verified') {
            const emailContent = identityApprovedEmail({
              campaignerName: creator.name || 'Campaigner',
              campaignTitle: campaign.title,
              campaignSlug: campaign.slug,
            });
            await createAndEmail({
              userId: campaign.creatorId,
              type: 'verification_approved',
              title: 'Identity Verified',
              message: `Your identity for "${campaign.title}" has been verified. You can now proceed with document verification.`,
              link: `/dashboard/campaigns/${campaign.slug}/verification`,
              email: { to: creator.email, ...emailContent },
            });
          } else if (result.verificationStatus === 'rejected') {
            const emailContent = identityDeclinedEmail({
              campaignerName: creator.name || 'Campaigner',
              campaignTitle: campaign.title,
              campaignSlug: campaign.slug,
              reason: result.notes,
            });
            await createAndEmail({
              userId: campaign.creatorId,
              type: 'verification_rejected',
              title: 'Identity Verification Failed',
              message: `Identity verification for "${campaign.title}" was not successful. Please try again.`,
              link: `/dashboard/campaigns/${campaign.slug}/verification`,
              email: { to: creator.email, ...emailContent },
            });
          } else if (result.verificationStatus === 'info_requested') {
            const emailContent = identityResubmissionEmail({
              campaignerName: creator.name || 'Campaigner',
              campaignTitle: campaign.title,
              campaignSlug: campaign.slug,
            });
            await createAndEmail({
              userId: campaign.creatorId,
              type: 'info_request',
              title: 'Identity Verification - Resubmission Needed',
              message: `We need you to re-verify your identity for "${campaign.title}". Please try again.`,
              link: `/dashboard/campaigns/${campaign.slug}/verification`,
              email: { to: creator.email, ...emailContent },
            });
          }
        }
      } catch (notifError) {
        console.error('[Identity Poll] Notification error:', notifError);
      }
    }

    return NextResponse.json({
      ok: true,
      status: result.verificationStatus,
      decided: true,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    console.error('[Identity Status Poll] Error:', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check verification status', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
