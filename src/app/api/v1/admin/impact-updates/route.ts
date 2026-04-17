import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { impactUpdates, campaigns } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError, ApiResponse } from '@/types/api';

/**
 * GET /api/v1/admin/impact-updates
 *
 * List all impact updates for admin review.
 */
export async function GET(_request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    const rows = await db
      .select({
        id: impactUpdates.id,
        campaignId: impactUpdates.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        title: impactUpdates.title,
        status: impactUpdates.status,
        submittedAt: impactUpdates.submittedAt,
        dueDate: impactUpdates.dueDate,
        reviewedAt: impactUpdates.reviewedAt,
        reminderCount: impactUpdates.reminderCount,
      })
      .from(impactUpdates)
      .innerJoin(campaigns, eq(impactUpdates.campaignId, campaigns.id))
      .orderBy(desc(impactUpdates.createdAt))
      .limit(200);

    const response: ApiResponse<typeof rows> = { ok: true, data: rows };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
