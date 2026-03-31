import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, verificationDocuments, auditLogs, users } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { submitVerificationSchema } from '@/lib/validators/verification';
import { notifyAdminsVerificationSubmitted } from '@/lib/notifications';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/user-campaigns/[id]/verification/submit
 *
 * Submit campaign verification for admin review.
 * Transitions verification status to 'documents_uploaded'.
 * Requires at least one uploaded document.
 * Campaigner (campaign creator) only.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id: campaignId } = await params;

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        verificationStatus: campaigns.verificationStatus,
        title: campaigns.title,
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

    // Only allow submission from certain states
    const submittableStates = ['unverified', 'submitted_for_review', 'info_requested', 'rejected'];
    if (!submittableStates.includes(campaign.verificationStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: `Cannot submit verification from status: ${campaign.verificationStatus}`, requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Must have at least one document uploaded
    const docs = await db
      .select({ id: verificationDocuments.id })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.campaignId, campaignId))
      .limit(1);

    if (docs.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Upload at least one verification document before submitting', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Parse optional message
    let body: { message?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine
    }

    const parsed = submitVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Update verification status
    await db
      .update(campaigns)
      .set({
        verificationStatus: 'documents_uploaded',
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'verification_submitted',
      actorId: session.user.id,
      actorRole: session.user.role as 'donor' | 'editor' | 'admin',
      targetType: 'campaign',
      targetId: campaignId,
      details: {
        previousStatus: campaign.verificationStatus,
        newStatus: 'documents_uploaded',
        message: parsed.data.message || null,
      },
      severity: 'info',
    });

    // Notify all admins — fire-and-forget; failure must not block the response
    Promise.all([
      db.select({ docCount: count() }).from(verificationDocuments).where(eq(verificationDocuments.campaignId, campaignId)),
      db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id!)).limit(1),
    ]).then(([countRows, userRows]) => {
      const docCount = countRows[0]?.docCount ?? 0;
      const creatorName = userRows[0]?.name || session.user.name || 'Campaigner';
      return notifyAdminsVerificationSubmitted({
        campaignId,
        campaignTitle: campaign.title,
        creatorName,
        documentCount: docCount,
      });
    }).catch((e) => console.error('[submit/notify]', e));

    return NextResponse.json({
      ok: true,
      data: {
        verificationStatus: 'documents_uploaded',
        message: 'Verification submitted for review',
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
    console.error('Verification submit error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
