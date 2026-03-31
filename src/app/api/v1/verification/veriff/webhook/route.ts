import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, auditLogs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateWebhookSignature, type VeriffDecisionWebhook } from '@/lib/veriff';
import { veriffApprovedEmail, veriffDeclinedEmail, veriffResubmissionEmail } from '@/lib/email-templates';

/**
 * POST /api/v1/verification/veriff/webhook
 *
 * Veriff decision webhook handler.
 * Validates HMAC-SHA256 signature, processes verification decisions,
 * and updates campaign verification status accordingly.
 *
 * Must respond 200 within 5000ms. Veriff uses at-least-once delivery,
 * so this handler is idempotent.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hmac-signature');

    // Validate HMAC signature
    if (!signature || !validateWebhookSignature(rawBody, signature)) {
      console.error('[Veriff Webhook] Invalid HMAC signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: VeriffDecisionWebhook = JSON.parse(rawBody);
    const { verification } = payload;
    const campaignId = payload.vendorData;

    if (!campaignId || !verification?.id) {
      console.error('[Veriff Webhook] Missing vendorData or verification ID');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Look up campaign by veriffSessionId
    const [campaign] = await db
      .select({
        id: campaigns.id,
        verificationStatus: campaigns.verificationStatus,
        veriffSessionId: campaigns.veriffSessionId,
        creatorId: campaigns.creatorId,
        title: campaigns.title,
        slug: campaigns.slug,
      })
      .from(campaigns)
      .where(eq(campaigns.veriffSessionId, verification.id))
      .limit(1);

    if (!campaign) {
      // Could be a duplicate or stale webhook - log and respond 200
      console.warn(`[Veriff Webhook] No campaign found for session ${verification.id}`);
      return NextResponse.json({ ok: true });
    }

    // Idempotency: if already identity_verified or fully_verified, skip processing
    if (['identity_verified', 'fully_verified'].includes(campaign.verificationStatus)) {
      return NextResponse.json({ ok: true });
    }

    const now = new Date();

    switch (verification.status) {
      case 'approved': {
        // Identity verified by Veriff - transition to identity_verified
        await db
          .update(campaigns)
          .set({
            verificationStatus: 'identity_verified',
            verificationNotes: `Identity verified via Veriff (code: ${verification.code})`,
            verificationReviewedAt: now,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaign.id));

        // Audit log
        await db.insert(auditLogs).values({
          actorId: campaign.creatorId,
          eventType: 'veriff_identity_approved',
          targetType: 'campaign',
          targetId: campaign.id,
          details: {
            veriffSessionId: verification.id,
            veriffCode: verification.code,
            personFirstName: verification.person?.firstName,
            personLastName: verification.person?.lastName,
            documentType: verification.document?.type,
            documentCountry: verification.document?.country,
          },
          severity: 'info',
        });

        // Send notification to campaign creator
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
            // Don't fail the webhook for notification errors
            console.error('[Veriff Webhook] Notification error:', notifError);
          }
        }
        break;
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
            reasonCode: verification.reasonCode,
          },
          severity: 'warning',
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
                message: `Identity verification for "${campaign.title}" was not successful. Please try again with valid identification documents.`,
                link: `/dashboard/campaigns/${campaign.slug}/verification`,
                email: { to: creator.email, ...emailContent },
              });
            }
          } catch (notifError) {
            console.error('[Veriff Webhook] Notification error:', notifError);
          }
        }
        break;
      }

      case 'resubmission_requested': {
        // Clear session so user can start a new one
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
                message: `We need you to re-verify your identity for "${campaign.title}". Please return to your verification dashboard and try again.`,
                link: `/dashboard/campaigns/${campaign.slug}/verification`,
                email: { to: creator.email, ...emailContent },
              });
            }
          } catch (notifError) {
            console.error('[Veriff Webhook] Notification error:', notifError);
          }
        }
        break;
      }

      case 'expired':
      case 'abandoned': {
        // Clear session so user can start fresh
        await db
          .update(campaigns)
          .set({
            veriffSessionId: null,
            veriffSessionUrl: null,
            verificationStatus: campaign.verificationStatus === 'pending' ? 'unverified' : campaign.verificationStatus,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaign.id));

        await db.insert(auditLogs).values({
          actorId: campaign.creatorId,
          eventType: `veriff_session_${verification.status}`,
          targetType: 'campaign',
          targetId: campaign.id,
          details: { veriffSessionId: verification.id },
          severity: 'info',
        });
        break;
      }

      case 'review': {
        // Veriff is manually reviewing - just log it
        await db.insert(auditLogs).values({
          actorId: campaign.creatorId,
          eventType: 'veriff_manual_review',
          targetType: 'campaign',
          targetId: campaign.id,
          details: { veriffSessionId: verification.id },
          severity: 'info',
        });
        break;
      }
    }

    // Must respond 200 within 5000ms
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Veriff Webhook] Unhandled error:', error);
    // Return 200 to prevent Veriff retries for unrecoverable errors
    // but log extensively for debugging
    return NextResponse.json({ ok: true });
  }
}
