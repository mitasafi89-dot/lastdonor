import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { impactUpdates, campaigns, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError, ApiResponse } from '@/types/api';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/impact-updates/[id]/review
 *
 * Get full impact update details for admin review.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    await requireRole(['admin']);

    const [impactUpdate] = await db
      .select()
      .from(impactUpdates)
      .where(eq(impactUpdates.id, id))
      .limit(1);

    if (!impactUpdate) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Impact update not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const [campaign] = await db
      .select({ title: campaigns.title, slug: campaigns.slug, creatorId: campaigns.creatorId })
      .from(campaigns)
      .where(eq(campaigns.id, impactUpdate.campaignId))
      .limit(1);

    const response: ApiResponse<{ impactUpdate: typeof impactUpdate; campaign: typeof campaign }> = {
      ok: true,
      data: { impactUpdate, campaign },
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/admin/impact-updates/[id]/review
 *
 * Approve or reject an impact update.
 * Body: { action: 'approve' | 'reject', notes?: string }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    const session = await requireRole(['admin']);
    const body = await request.json();

    const { action, notes } = body as { action: string; notes?: string };

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Action must be "approve" or "reject"', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const [impactUpdate] = await db
      .select()
      .from(impactUpdates)
      .where(eq(impactUpdates.id, id))
      .limit(1);

    if (!impactUpdate) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Impact update not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    if (impactUpdate.status !== 'submitted') {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: `Cannot review impact update in status: ${impactUpdate.status}`, requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    const newStatus = action === 'approve' ? 'approved' as const : 'rejected' as const;

    const [updated] = await db
      .update(impactUpdates)
      .set({
        status: newStatus,
        reviewerId: session.user.id,
        reviewerNotes: notes ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(impactUpdates.id, id))
      .returning();

    await db.insert(auditLogs).values({
      eventType: `impact_update.${action}d`,
      actorId: session.user.id,
      actorRole: 'admin',
      targetType: 'campaign',
      targetId: impactUpdate.campaignId,
      severity: 'info',
      details: { impactUpdateId: id, action, notes },
    });

    const response: ApiResponse<typeof updated> = { ok: true, data: updated };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
