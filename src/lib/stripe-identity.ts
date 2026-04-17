import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

// ─── Types ──────────────────────────────────────────────────────────────────

export type VerificationSessionStatus =
  | 'requires_input'
  | 'processing'
  | 'verified'
  | 'canceled';

export interface CreateVerificationSessionResult {
  sessionId: string;
  clientSecret: string;
  url: string;
  status: VerificationSessionStatus;
}

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Create a Stripe Identity VerificationSession for a campaign creator.
 *
 * Uses `document` type (government ID + selfie) which is equivalent to
 * the previous flow this replaces. Stripe handles the entire ID capture,
 * liveness check, and document OCR.
 *
 * The `metadata.campaignId` field links the session back to the campaign,
 * used by the webhook handler to update verification status.
 */
export async function createIdentityVerificationSession(opts: {
  campaignId: string;
  campaignSlug: string;
}): Promise<CreateVerificationSessionResult> {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) throw new Error('NEXTAUTH_URL environment variable is required for identity verification');
  const returnUrl = `${baseUrl}/dashboard/campaigns/${opts.campaignSlug}/verification`;

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: {
      campaignId: opts.campaignId,
      campaignSlug: opts.campaignSlug,
    },
    options: {
      document: {
        require_matching_selfie: true,
      },
    },
    return_url: returnUrl,
  });

  if (!session.client_secret || !session.url) {
    throw new Error('Identity verification session could not be created. Please try again.');
  }

  return {
    sessionId: session.id,
    clientSecret: session.client_secret,
    url: session.url,
    status: session.status as VerificationSessionStatus,
  };
}

/**
 * Retrieve the current state of a Stripe Identity VerificationSession.
 * Returns null if the session does not exist (404).
 */
export async function getIdentityVerificationSession(
  sessionId: string,
): Promise<Stripe.Identity.VerificationSession | null> {
  try {
    return await stripe.identity.verificationSessions.retrieve(sessionId);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Map a Stripe Identity VerificationSession status to our internal
 * verification status values.
 *
 * Stripe statuses:
 *   requires_input  - user hasn't completed the flow yet
 *   processing      - Stripe is reviewing submitted documents
 *   verified        - identity confirmed
 *   canceled        - session was canceled (by API or expiry)
 *
 * Stripe last_error.code values (on requires_input after failure):
 *   document_expired, document_type_not_allowed, document_unverified_other,
 *   id_number_mismatch, selfie_document_missing_photo, etc.
 */
export function mapStripeStatusToVerification(
  session: Stripe.Identity.VerificationSession,
): {
  verificationStatus: string;
  notes: string;
  decided: boolean;
} {
  switch (session.status) {
    case 'verified':
      return {
        verificationStatus: 'identity_verified',
        notes: `Identity verified via Stripe Identity (session: ${session.id})`,
        decided: true,
      };

    case 'canceled':
      return {
        verificationStatus: 'unverified',
        notes: 'Identity verification session was canceled',
        decided: true,
      };

    case 'requires_input': {
      // If last_error exists, the user failed and needs to retry
      if (session.last_error) {
        const reason = session.last_error.reason || 'Document could not be verified';
        return {
          verificationStatus: 'rejected',
          notes: `Identity verification failed: ${reason} (code: ${session.last_error.code || 'unknown'})`,
          decided: true,
        };
      }
      // Otherwise the user just hasn't completed the flow yet
      return {
        verificationStatus: 'pending',
        notes: 'Awaiting identity verification completion',
        decided: false,
      };
    }

    case 'processing':
      return {
        verificationStatus: 'pending',
        notes: 'Identity verification is being processed',
        decided: false,
      };

    default:
      return {
        verificationStatus: 'pending',
        notes: `Unknown verification status: ${session.status}`,
        decided: false,
      };
  }
}
