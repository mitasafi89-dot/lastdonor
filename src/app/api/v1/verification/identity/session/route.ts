import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { createIdentityVerificationSession } from '@/lib/stripe-identity';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import { identitySessionSchema } from '@/lib/validators/admin';

/**
 * POST /api/v1/verification/identity/session
 * Creates a Stripe Identity verification session for a campaign.
 *
 * Body: { campaignId: string, force?: boolean }
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = identitySessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }
    const { campaignId, force } = parsed.data;

    // Load campaign - must be owned by current user
    const [campaign] = await db
      .select({
        id: campaigns.id,
        slug: campaigns.slug,
        creatorId: campaigns.creatorId,
        verificationStatus: campaigns.verificationStatus,
        stripeVerificationId: campaigns.stripeVerificationId,
        stripeVerificationUrl: campaigns.stripeVerificationUrl,
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
      throw new ForbiddenError();
    }

    // Only allow session creation for campaigns that haven't completed identity verification
    const allowedStatuses = ['unverified', 'pending', 'documents_uploaded', 'info_requested', 'rejected'];
    if (!allowedStatuses.includes(campaign.verificationStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Identity verification already completed or in progress', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // If session already exists, return it - unless caller explicitly requests a fresh session
    if (campaign.stripeVerificationId && campaign.stripeVerificationUrl && !force) {
      return NextResponse.json({
        ok: true,
        data: {
          sessionId: campaign.stripeVerificationId,
          url: campaign.stripeVerificationUrl,
          existing: true,
        },
      });
    }

    // Clear stale session if force-creating a new one
    if (force && campaign.stripeVerificationId) {
      await db
        .update(campaigns)
        .set({
          stripeVerificationId: null,
          stripeVerificationUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaign.id));
    }

    // Create Stripe Identity session
    const result = await createIdentityVerificationSession({
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
    });

    // Store session ID on campaign
    await db
      .update(campaigns)
      .set({
        stripeVerificationId: result.sessionId,
        stripeVerificationUrl: result.url,
        verificationStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaign.id));

    // Audit log
    await db.insert(auditLogs).values({
      actorId: session.user.id,
      eventType: 'identity_session_created',
      targetType: 'campaign',
      targetId: campaign.id,
      details: { stripeVerificationId: result.sessionId },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: result.sessionId,
        url: result.url,
        existing: false,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Not authorized', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[Identity Session] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create verification session', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
