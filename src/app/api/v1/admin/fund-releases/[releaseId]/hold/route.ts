import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundReleases, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { holdFundReleaseSchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ releaseId: string }>;
}

/**
 * PATCH /api/v1/admin/fund-releases/[releaseId]/hold
 *
 * Toggle hold/resume on a fund release.
 * A release can only be held if in 'approved' status, and resumed from 'paused'.
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
    const parsed = holdFundReleaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { action, reason } = parsed.data;
    const now = new Date();

    if (action === 'hold') {
      if (release.status !== 'approved') {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: `Cannot hold a release in status: ${release.status}. Only approved releases can be placed on hold.`, requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .update(fundReleases)
          .set({
            status: 'paused',
            pausedBy: session.user.id!,
            pausedAt: now,
            pauseReason: reason || null,
          })
          .where(eq(fundReleases.id, releaseId));

        await tx.insert(auditLogs).values({
          eventType: 'fund_release.paused',
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

      return NextResponse.json({ ok: true, data: { status: 'paused' } });
    } else {
      // Resume
      if (release.status !== 'paused') {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: `Cannot resume a release in status: ${release.status}. Only paused releases can be resumed.`, requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .update(fundReleases)
          .set({
            status: 'approved',
            pausedBy: null,
            pausedAt: null,
            pauseReason: null,
          })
          .where(eq(fundReleases.id, releaseId));

        await tx.insert(auditLogs).values({
          eventType: 'fund_release.resumed',
          actorId: session.user.id,
          actorRole: 'admin',
          targetType: 'fund_release',
          targetId: releaseId,
          details: {
            campaignId: release.campaignId,
            milestoneId: release.milestoneId,
            amount: release.amount,
            previousReason: release.pauseReason,
          },
          severity: 'info',
        });
      });

      return NextResponse.json({ ok: true, data: { status: 'approved' } });
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
    console.error('Fund release hold error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
