import { db } from '@/db';
import { campaigns, auditLogs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { mapStripeStatusToVerification } from '@/lib/stripe-identity';
import { identityApprovedEmail, identityDeclinedEmail, identityResubmissionEmail } from '@/lib/email-templates';
import type Stripe from 'stripe';

/**
 * Process Stripe Identity VerificationSession webhook events.
 *
 * Called from the main Stripe webhook handler for:
 *   - identity.verification_session.verified
 *   - identity.verification_session.requires_input
 *   - identity.verification_session.canceled
 *
 * Uses metadata.campaignId to link the session back to a campaign.
 * Idempotent: skips processing if campaign is already identity_verified or fully_verified.
 */
export async function processIdentityVerificationEvent(
  session: Stripe.Identity.VerificationSession,
  eventType: string,
): Promise<void> {
  const campaignId = session.metadata?.campaignId;

  if (!campaignId) {
    console.warn(`[Identity Webhook] Missing campaignId in metadata for session ${session.id}`);
    return;
  }

  // Look up campaign by stripeVerificationId
  const [campaign] = await db
    .select({
      id: campaigns.id,
      verificationStatus: campaigns.verificationStatus,
      stripeVerificationId: campaigns.stripeVerificationId,
      creatorId: campaigns.creatorId,
      title: campaigns.title,
      slug: campaigns.slug,
    })
    .from(campaigns)
    .where(eq(campaigns.stripeVerificationId, session.id))
    .limit(1);

  if (!campaign) {
    // Fallback: try looking up by campaignId from metadata
    const [fallbackCampaign] = await db
      .select({
        id: campaigns.id,
        verificationStatus: campaigns.verificationStatus,
        stripeVerificationId: campaigns.stripeVerificationId,
        creatorId: campaigns.creatorId,
        title: campaigns.title,
        slug: campaigns.slug,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!fallbackCampaign) {
      console.warn(`[Identity Webhook] No campaign found for session ${session.id} / campaignId ${campaignId}`);
      return;
    }

    // Verify the session ID matches to prevent spoofing
    if (fallbackCampaign.stripeVerificationId && fallbackCampaign.stripeVerificationId !== session.id) {
      console.warn(`[Identity Webhook] Session ID mismatch: expected ${fallbackCampaign.stripeVerificationId}, got ${session.id}`);
      return;
    }

    // Use fallback campaign for processing
    return processVerificationDecision(fallbackCampaign, session, eventType);
  }

  // Idempotency: skip if already decided
  if (['identity_verified', 'fully_verified'].includes(campaign.verificationStatus)) {
    return;
  }

  await processVerificationDecision(campaign, session, eventType);
}

async function processVerificationDecision(
  campaign: {
    id: string;
    verificationStatus: string;
    stripeVerificationId: string | null;
    creatorId: string | null;
    title: string;
    slug: string;
  },
  session: Stripe.Identity.VerificationSession,
  eventType: string,
): Promise<void> {
  const result = mapStripeStatusToVerification(session);
  const now = new Date();

  if (!result.decided) {
    // Not a terminal state, nothing to do
    return;
  }

  // Build update fields
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
      stripeVerificationId: session.id,
      stripeStatus: session.status,
      stripeEventType: eventType,
      source: 'webhook',
    },
    severity: result.verificationStatus === 'rejected' ? 'warning' : 'info',
  });

  // Send notification email to campaign creator
  if (!campaign.creatorId) return;

  try {
    const [creator] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, campaign.creatorId))
      .limit(1);

    if (!creator) return;

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
        message: `Identity verification for "${campaign.title}" was not successful. Please try again with valid identification documents.`,
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
        message: `We need you to re-verify your identity for "${campaign.title}". Please return to your verification dashboard and try again.`,
        link: `/dashboard/campaigns/${campaign.slug}/verification`,
        email: { to: creator.email, ...emailContent },
      });
    }
  } catch (notifError) {
    // Never fail the webhook for notification errors
    console.error('[Identity Webhook] Notification error:', notifError);
  }
}
