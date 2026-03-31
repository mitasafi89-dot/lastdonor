import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, auditLogs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, UnauthorizedError } from '@/lib/auth';
import { getVeriffDecision } from '@/lib/veriff';
import { randomUUID } from 'crypto';
import { veriffApprovedEmail, veriffDeclinedEmail, veriffResubmissionEmail } from '@/lib/email-templates';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/verification/veriff/decision?campaignId=xxx
 *
 * Polls the Veriff API for a session decision when webhook delivery
 * is unavailable (e.g. local development). Updates the DB if a new
 * decision is found.
 *
 * Returns { status, verification } with the current verification state.
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
        veriffSessionId: campaigns.veriffSessionId,
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
    if (!campaign.veriffSessionId) {
      return NextResponse.json({
        ok: true,
        status: campaign.verificationStatus,
        decided: false,
      });
    }

    // Poll Veriff
    const decision = await getVeriffDecision(campaign.veriffSessionId);

    if (!decision || !decision.verification) {
      return NextResponse.json({
        ok: true,
        status: campaign.verificationStatus,
        decided: false,
      });
    }

    const { verification } = decision;
    const now = new Date();

    // Process the decision (mirrors webhook handler logic)
    switch (verification.status) {
      case 'approved': {
        await db
          .update(campaigns)
          .set({
            verificationStatus: 'identity_verified',
            verificationNotes: `Identity verified via Veriff (code: ${verification.code})`,
            verificationReviewedAt: now,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaign.id));

        await db.insert(auditLogs).values({
          actorId: campaign.creatorId,
          eventType: 'veriff_identity_approved',
          targetType: 'campaign',
          targetId: campaign.id,
          details: {
            veriffSessionId: verification.id,
            veriffCode: verification.code,
            source: 'polling',
          },
          severity: 'info',
        });

        // Notify campaign creator
        if (campaign.creatorId) {
          try {
            const [creator] = await db
              .select({ email: users.email, name: users.name })
              .from(users)
              .where(eq(users.id, campaign.creatorId))
              .limit(1);

            if (creator) {
              const { createAndEmail } = await import('@/lib/notifications');
              const emailContent = veriffApprovedEmail({
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
            }
          } catch (notifError) {
            console.error('[Veriff Poll] Notification error:', notifError);
          }
        }

        return NextResponse.json({
          ok: true,
          status: 'identity_verified',
          decided: true,
        });
      }

      case 'declined': {
        await db
          .update(campaigns)
          .set({
            verificationStatus: 'rejected',
            verificationNotes: `Identity verification declined by Veriff: ${verification.reason || 'No reason provided'} (code: ${verification.code})`,
            verificationReviewedAt: now,
            veriffSessionId: null,
            veriffSessionUrl: null,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaign.id));

        await db.insert(auditLogs).values({
          actorId: campaign.creatorId,
          eventType: 'veriff_identity_declined',
          targetType: 'campaign',
          targetId: campaign.id,
          details: {
            veriffSessionId: verification.id,
            veriffCode: verification.code,
            reason: verification.reason,
            source: 'polling',
          },
          severity: 'warning',
        });

        if (campaign.creatorId) {
          try {
            const [creator] = await db
              .select({ email: users.email, name: users.name })
              .from(users)
              .where(eq(users.id, campaign.creatorId))
              .limit(1);

            if (creator) {
              const { createAndEmail } = await import('@/lib/notifications');
              const emailContent = veriffDeclinedEmail({
                campaignerName: creator.name || 'Campaigner',
                campaignTitle: campaign.title,
                campaignSlug: campaign.slug,
                reason: verification.reason || 'The submitted documents could not be verified.',
              });
              await createAndEmail({
                userId: campaign.creatorId,
                type: 'verification_rejected',
                title: 'Identity Verification Failed',
                message: `Identity verification for "${campaign.title}" was not successful. Please try again.`,
                link: `/dashboard/campaigns/${campaign.slug}/verification`,
                email: { to: creator.email, ...emailContent },
              });
            }
          } catch (notifError) {
            console.error('[Veriff Poll] Notification error:', notifError);
          }
        }

        return NextResponse.json({
          ok: true,
          status: 'rejected',
          decided: true,
        });
      }

      case 'resubmission_requested': {
        await db
          .update(campaigns)
          .set({
            verificationStatus: 'info_requested',
            verificationNotes: `Veriff requested resubmission: ${verification.reason || 'Additional documents needed'}`,
            veriffSessionId: null,
            veriffSessionUrl: null,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaign.id));

        await db.insert(auditLogs).values({
          actorId: campaign.creatorId,
          eventType: 'veriff_resubmission_requested',
          targetType: 'campaign',
          targetId: campaign.id,
          details: {
            veriffSessionId: verification.id,
            reason: verification.reason,
            source: 'polling',
          },
          severity: 'info',
        });

        if (campaign.creatorId) {
          try {
            const [creator] = await db
              .select({ email: users.email, name: users.name })
              .from(users)
              .where(eq(users.id, campaign.creatorId))
              .limit(1);

            if (creator) {
              const { createAndEmail } = await import('@/lib/notifications');
              const emailContent = veriffResubmissionEmail({
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
          } catch (notifError) {
            console.error('[Veriff Poll] Notification error:', notifError);
          }
        }

        return NextResponse.json({
          ok: true,
          status: 'info_requested',
          decided: true,
        });
      }

      case 'expired':
      case 'abandoned': {
        await db
          .update(campaigns)
          .set({
            veriffSessionId: null,
            veriffSessionUrl: null,
            verificationStatus: campaign.verificationStatus === 'pending' ? 'unverified' : campaign.verificationStatus,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaign.id));

        return NextResponse.json({
          ok: true,
          status: campaign.verificationStatus === 'pending' ? 'unverified' : campaign.verificationStatus,
          decided: true,
        });
      }

      default: {
        // Unknown status from Veriff, treat as not-yet-decided
        return NextResponse.json({
          ok: true,
          status: campaign.verificationStatus,
          decided: false,
        });
      }
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    console.error('[Veriff Decision Poll] Error:', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check verification status', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
