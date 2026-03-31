import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, verificationDocuments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/user-campaigns/[id]/verification/status
 *
 * Get verification status and documents for a campaign.
 * Campaigner (campaign creator) only.
 */
export async function GET(_request: NextRequest, { params }: Params) {
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
        verificationNotes: campaigns.verificationNotes,
        verificationReviewedAt: campaigns.verificationReviewedAt,
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

    // Only owner or admin/editor can view
    const role = session.user.role as string;
    const isOwner = campaign.creatorId === session.user.id;
    if (!isOwner && !['editor', 'admin'].includes(role)) {
      throw new ForbiddenError();
    }

    const documents = await db
      .select({
        id: verificationDocuments.id,
        documentType: verificationDocuments.documentType,
        fileName: verificationDocuments.fileName,
        fileSize: verificationDocuments.fileSize,
        mimeType: verificationDocuments.mimeType,
        description: verificationDocuments.description,
        status: verificationDocuments.status,
        reviewerNotes: verificationDocuments.reviewerNotes,
        reviewedAt: verificationDocuments.reviewedAt,
        createdAt: verificationDocuments.createdAt,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.campaignId, campaignId))
      .orderBy(desc(verificationDocuments.createdAt));

    // Don't expose file URLs to non-owners for privacy
    const docs = isOwner
      ? await db
          .select()
          .from(verificationDocuments)
          .where(eq(verificationDocuments.campaignId, campaignId))
          .orderBy(desc(verificationDocuments.createdAt))
      : documents;

    return NextResponse.json({
      ok: true,
      data: {
        verificationStatus: campaign.verificationStatus,
        reviewerNotes: campaign.verificationNotes,
        reviewedAt: campaign.verificationReviewedAt,
        documents: docs,
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
    console.error('Verification status error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
