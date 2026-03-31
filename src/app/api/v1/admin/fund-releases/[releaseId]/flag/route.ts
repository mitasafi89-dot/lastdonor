import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundReleases, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { flagFundReleaseSchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ releaseId: string }>;
}

/**
 * PATCH /api/v1/admin/fund-releases/[releaseId]/flag
 *
 * Toggle audit flag on a fund release.
 * Flagging is orthogonal to release status -- it does not change the status.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { releaseId } = await params;

  try {
    const session = await requireRole(['admin']);

    const [release] = await db
      .select()
      .from(fundReleases)
      .where(eq(fundReleases.id, releaseId))
      .limit(1);

    if (!release) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Fund release not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = flagFundReleaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { action, reason } = parsed.data;
    const now = new Date();

    if (action === 'flag') {
      if (release.flaggedForAudit) {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Release is already flagged for audit', requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .update(fundReleases)
          .set({
            flaggedForAudit: true,
            flagReason: reason || null,
            flaggedBy: session.user.id!,
            flaggedAt: now,
          })
          .where(eq(fundReleases.id, releaseId));

        await tx.insert(auditLogs).values({
          eventType: 'fund_release.flagged',
          actorId: session.user.id,
          actorRole: 'admin',
          targetType: 'fund_release',
          targetId: releaseId,
          details: {
            campaignId: release.campaignId,
            milestoneId: release.milestoneId,
            amount: release.amount,
            reason: reason || null,
          },
          severity: 'warning',
        });
      });

      return NextResponse.json({ ok: true, data: { flaggedForAudit: true } });
    } else {
      // Unflag
      if (!release.flaggedForAudit) {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Release is not flagged', requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .update(fundReleases)
          .set({
            flaggedForAudit: false,
            flagReason: null,
            flaggedBy: null,
            flaggedAt: null,
          })
          .where(eq(fundReleases.id, releaseId));

        await tx.insert(auditLogs).values({
          eventType: 'fund_release.unflagged',
          actorId: session.user.id,
          actorRole: 'admin',
          targetType: 'fund_release',
          targetId: releaseId,
          details: {
            campaignId: release.campaignId,
            milestoneId: release.milestoneId,
            amount: release.amount,
            previousReason: release.flagReason,
          },
          severity: 'info',
        });
      });

      return NextResponse.json({ ok: true, data: { flaggedForAudit: false } });
    }
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
    console.error('Fund release flag error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
