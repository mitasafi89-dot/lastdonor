import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { campaigns, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { suspendCampaignSchema } from '@/lib/validators/verification';
import { notifyCampaignSuspended } from '@/lib/notifications';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import type { CampaignStatus, UserRole } from '@/types';

type RouteParams = { params: Promise<{ campaignId: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Statuses that can be suspended. */
const SUSPENDABLE: CampaignStatus[] = ['active', 'last_donor_zone', 'paused', 'under_review'];

/**
 * POST /api/v1/admin/campaigns/[campaignId]/suspend
 *
 * Suspends a campaign pending investigation.
 * Notifies subscribed donors that funds are secured.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { campaignId } = await params;

  try {
    const session = await requireRole(['admin']);

    if (!UUID_REGEX.test(campaignId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid campaign ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = suspendCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { reason, internalNotes } = parsed.data;

    const [campaign] = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
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

    if (!SUSPENDABLE.includes(campaign.status as CampaignStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `Cannot suspend a campaign with status "${campaign.status}".`, requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    await db.update(campaigns).set({
      status: 'suspended',
      suspendedAt: new Date(),
      suspendedReason: reason,
      updatedAt: new Date(),
    }).where(eq(campaigns.id, campaignId));

    await db.insert(auditLogs).values({
      eventType: 'campaign.suspended',
      actorId: session.user?.id ?? null,
      actorRole: session.user?.role as UserRole,
      targetType: 'campaign',
      targetId: campaignId,
      severity: 'critical',
      details: { title: campaign.title, previousStatus: campaign.status, reason, internalNotes },
    });

    notifyCampaignSuspended({
      campaignId,
      campaignTitle: campaign.title,
      campaignSlug: campaign.slug ?? '',
    }).catch((err) => console.error('[campaign.suspended] notification error:', err));

    revalidatePath(`/campaigns/${campaign.slug}`);
    return NextResponse.json({ ok: true, data: { id: campaignId, status: 'suspended' } });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[POST /api/v1/admin/campaigns/[campaignId]/suspend]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to suspend campaign', requestId } } satisfies ApiError, { status: 500 });
  }
}
