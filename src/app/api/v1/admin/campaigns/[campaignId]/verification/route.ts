import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, verificationDocuments, infoRequests, auditLogs, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { adminVerificationReviewSchema } from '@/lib/validators/verification';
import {
  notifyCreatorVerificationApproved,
  notifyCreatorVerificationRejected,
  notifyInfoRequest,
} from '@/lib/notifications';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ campaignId: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[campaignId]/verification
 *
 * Returns the list of verification documents for a campaign.
 * Admin only.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { campaignId } = await params;

  try {
    await requireRole(['admin']);

    const docs = await db
      .select({
        id: verificationDocuments.id,
        documentType: verificationDocuments.documentType,
        fileName: verificationDocuments.fileName,
        fileSize: verificationDocuments.fileSize,
        mimeType: verificationDocuments.mimeType,
        fileUrl: verificationDocuments.fileUrl,
        status: verificationDocuments.status,
        reviewerNotes: verificationDocuments.reviewerNotes,
        createdAt: verificationDocuments.createdAt,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.campaignId, campaignId))
      .orderBy(desc(verificationDocuments.createdAt));

    return NextResponse.json({
      ok: true,
      data: docs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
    });
  } catch (error) {
    if ((error as Error).name === 'UnauthorizedError') {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if ((error as Error).name === 'ForbiddenError') {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('Admin verification GET error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/admin/campaigns/[campaignId]/verification
 *
 * Admin approve/reject/request-info for campaign verification.
 * Actions:
 *   - approve_t1: Identity verified (Tier 1)
 *   - approve_t2: Fully verified (Tier 2)
 *   - reject: Reject verification
 *   - request_info: Request additional information from campaigner
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { campaignId } = await params;

  try {
    const session = await requireRole(['admin']);

    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        verificationStatus: campaigns.verificationStatus,
        raisedAmount: campaigns.raisedAmount,
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

    const body = await request.json();
    const parsed = adminVerificationReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { action, notes, deadline } = parsed.data;
    const now = new Date();

    // Determine new status based on action
    let newStatus: string;
    switch (action) {
      case 'approve_t1':
        newStatus = 'identity_verified';
        break;
      case 'approve_t2':
        newStatus = 'fully_verified';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'request_info':
        newStatus = 'info_requested';
        break;
    }

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      approve_t1: ['documents_uploaded', 'submitted_for_review'],
      approve_t2: ['identity_verified', 'documents_uploaded'],
      reject: ['documents_uploaded', 'submitted_for_review', 'identity_verified', 'info_requested'],
      request_info: ['documents_uploaded', 'submitted_for_review', 'identity_verified'],
    };

    if (!validTransitions[action].includes(campaign.verificationStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: `Cannot ${action} from status: ${campaign.verificationStatus}`, requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Update campaign
    const updateFields: Record<string, unknown> = {
      verificationStatus: newStatus as typeof campaigns.$inferInsert.verificationStatus,
      verificationReviewerId: session.user.id!,
      verificationReviewedAt: now,
      verificationNotes: notes || null,
      updatedAt: now,
    };

    // Lump-sum release: on full verification, release the entire raised amount
    if (action === 'approve_t2') {
      updateFields.totalReleasedAmount = campaign.raisedAmount;
    }

    await db
      .update(campaigns)
      .set(updateFields as typeof campaigns.$inferInsert)
      .where(eq(campaigns.id, campaignId));

    // If requesting info, create an info request record
    if (action === 'request_info' && campaign.creatorId) {
      await db.insert(infoRequests).values({
        campaignId,
        requestedBy: session.user.id!,
        targetUser: campaign.creatorId,
        requestType: 'verification_info',
        details: notes || 'Additional verification information required',
        deadline: new Date(deadline!),
        pauseCampaign: false,
      });
    }

    // If approved (t1 or t2), mark all pending documents as approved
    if (action === 'approve_t1' || action === 'approve_t2') {
      await db
        .update(verificationDocuments)
        .set({
          status: 'approved',
          reviewerId: session.user.id!,
          reviewedAt: now,
        })
        .where(eq(verificationDocuments.campaignId, campaignId));
    }

    // Audit log
    await db.insert(auditLogs).values({
      eventType: `verification_${action}`,
      actorId: session.user.id,
      actorRole: 'admin',
      targetType: 'campaign',
      targetId: campaignId,
      details: {
        previousStatus: campaign.verificationStatus,
        newStatus,
        notes: notes || null,
        deadline: deadline || null,
      },
      severity: action === 'reject' ? 'warning' : 'info',
    });

    // Notify creator - fire-and-forget; failure must not block the admin response
    if (campaign.creatorId) {
      db.select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, campaign.creatorId))
        .limit(1)
        .then(([creator]) => {
          if (!creator) return;
          const creatorEmail = creator.email;
          const creatorName = creator.name || 'Campaigner';

          if (action === 'approve_t1') {
            return notifyCreatorVerificationApproved({
              creatorId: campaign.creatorId!,
              creatorEmail,
              creatorName,
              campaignId,
              campaignTitle: campaign.title,
              tier: 1,
            });
          }
          if (action === 'approve_t2') {
            return notifyCreatorVerificationApproved({
              creatorId: campaign.creatorId!,
              creatorEmail,
              creatorName,
              campaignId,
              campaignTitle: campaign.title,
              tier: 2,
            });
          }
          if (action === 'reject') {
            return notifyCreatorVerificationRejected({
              creatorId: campaign.creatorId!,
              creatorEmail,
              creatorName,
              campaignId,
              campaignTitle: campaign.title,
              reason: notes || 'Your verification documents could not be approved.',
            });
          }
          if (action === 'request_info') {
            const deadlineDate = new Date(deadline!);
            return notifyInfoRequest({
              campaignerId: campaign.creatorId!,
              campaignerEmail: creatorEmail,
              campaignerName: creatorName,
              campaignId,
              campaignTitle: campaign.title,
              requestType: 'verification_info',
              details: notes || 'Additional verification information required.',
              deadline: deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            });
          }
        })
        .catch((e) => console.error('[admin/verification/notify]', e));
    }

    return NextResponse.json({
      ok: true,
      data: {
        verificationStatus: newStatus,
        action,
        reviewedAt: now.toISOString(),
      },
    });
  } catch (error) {
    if ((error as Error).name === 'UnauthorizedError') {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if ((error as Error).name === 'ForbiddenError') {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('Admin verification review error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
