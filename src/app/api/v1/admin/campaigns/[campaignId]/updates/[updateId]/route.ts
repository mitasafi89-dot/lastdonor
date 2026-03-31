import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignUpdates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  params: Promise<{ campaignId: string; updateId: string }>;
}

/**
 * DELETE /api/v1/admin/campaigns/[campaignId]/updates/[updateId]
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { campaignId, updateId } = await params;

  try {
    await requireRole(['admin']);

    if (!UUID_REGEX.test(campaignId) || !UUID_REGEX.test(updateId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Verify update exists and belongs to campaign
    const [existing] = await db
      .select({ id: campaignUpdates.id })
      .from(campaignUpdates)
      .where(eq(campaignUpdates.id, updateId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Update not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    await db.delete(campaignUpdates).where(eq(campaignUpdates.id, updateId));

    // Revalidate public campaign page
    const [campaign] = await db
      .select({ slug: campaigns.slug })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaign) {
      revalidatePath(`/campaigns/${campaign.slug}`);
    }
    revalidatePath(`/admin/campaigns/${campaignId}`);

    return NextResponse.json({ ok: true, data: null });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error(`[DELETE /api/v1/admin/campaigns/${campaignId}/updates/${updateId}]`, error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete update', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
