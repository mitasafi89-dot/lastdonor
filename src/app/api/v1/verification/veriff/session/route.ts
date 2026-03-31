import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, users, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { createVeriffSession } from '@/lib/veriff';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * POST /api/v1/verification/veriff/session
 * Creates a Veriff identity verification session for a campaign.
 *
 * Body: { campaignId: string }
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const { campaignId, force } = await req.json();
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'campaignId is required', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Load campaign - must be owned by current user
    const [campaign] = await db
      .select({
        id: campaigns.id,
        slug: campaigns.slug,
        creatorId: campaigns.creatorId,
        verificationStatus: campaigns.verificationStatus,
        veriffSessionId: campaigns.veriffSessionId,
        veriffSessionUrl: campaigns.veriffSessionUrl,
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

    // If session already exists, return it — unless caller explicitly requests a fresh session
    if (campaign.veriffSessionId && campaign.veriffSessionUrl && !force) {
      return NextResponse.json({
        ok: true,
        data: {
          sessionId: campaign.veriffSessionId,
          url: campaign.veriffSessionUrl,
          existing: true,
        },
      });
    }

    // Clear stale session if force-creating a new one
    if (force && campaign.veriffSessionId) {
      await db
        .update(campaigns)
        .set({
          veriffSessionId: null,
          veriffSessionUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaign.id));
    }

    // Get user's name for Veriff
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const fullName = user?.name || session.user.name || 'Unknown';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Unknown';

    // Create Veriff session
    const veriffResponse = await createVeriffSession({
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      firstName,
      lastName,
    });

    const veriffSessionId = veriffResponse.verification.id;
    const veriffSessionUrl = veriffResponse.verification.url;

    // Store session ID on campaign
    await db
      .update(campaigns)
      .set({
        veriffSessionId,
        veriffSessionUrl,
        verificationStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaign.id));

    // Audit log
    await db.insert(auditLogs).values({
      actorId: session.user.id,
      eventType: 'veriff_session_created',
      targetType: 'campaign',
      targetId: campaign.id,
      details: { veriffSessionId },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: veriffSessionId,
        url: veriffSessionUrl,
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
    console.error('[Veriff Session] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create verification session', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
