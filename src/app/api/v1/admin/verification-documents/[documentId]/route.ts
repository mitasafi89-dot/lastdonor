import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verificationDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import { verificationDocReviewSchema } from '@/lib/validators/admin';

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * PATCH /api/v1/admin/verification-documents/[documentId]
 *
 * Admin approve or reject an individual verification document.
 * Body: { action: 'approve' | 'reject', notes?: string }
 *
 * - `notes` is required when action is `reject`.
 * - Updates the document status, reviewerId, reviewerNotes, reviewedAt.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { documentId } = await params;

  try {
    const session = await requireRole(['admin']);

    const body = await request.json();
    const parsed = verificationDocReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }
    const { action, notes } = parsed.data;

    const [doc] = await db
      .select({ id: verificationDocuments.id, status: verificationDocuments.status })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Document not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const now = new Date();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db
      .update(verificationDocuments)
      .set({
        status: newStatus,
        reviewerId: session.user.id!,
        reviewerNotes: notes || null,
        reviewedAt: now,
      })
      .where(eq(verificationDocuments.id, documentId));

    return NextResponse.json({
      ok: true,
      data: {
        id: documentId,
        status: newStatus,
        reviewerNotes: notes || null,
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
    console.error('Admin document review error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
