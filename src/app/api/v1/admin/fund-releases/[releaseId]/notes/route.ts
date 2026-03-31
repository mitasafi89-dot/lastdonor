import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundReleases, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { adminNoteSchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ releaseId: string }>;
}

/**
 * POST /api/v1/admin/fund-releases/[releaseId]/notes
 *
 * Add an admin note to a fund release (stored as audit log entry).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { releaseId } = await params;

  try {
    const session = await requireRole(['admin']);

    const [release] = await db
      .select({ id: fundReleases.id, campaignId: fundReleases.campaignId, milestoneId: fundReleases.milestoneId })
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
    const parsed = adminNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    await db.insert(auditLogs).values({
      eventType: 'fund_release.note_added',
      actorId: session.user.id,
      actorRole: 'admin',
      targetType: 'fund_release',
      targetId: releaseId,
      details: {
        campaignId: release.campaignId,
        milestoneId: release.milestoneId,
        note: parsed.data.text,
      },
      severity: 'info',
    });

    return NextResponse.json({ ok: true });
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
    console.error('Fund release note error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * GET /api/v1/admin/fund-releases/[releaseId]/notes
 *
 * Returns all audit log entries for this fund release.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { releaseId } = await params;

  try {
    await requireRole(['admin']);

    const [release] = await db
      .select({ id: fundReleases.id })
      .from(fundReleases)
      .where(eq(fundReleases.id, releaseId))
      .limit(1);

    if (!release) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Fund release not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const entries = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.targetType, 'fund_release'),
          eq(auditLogs.targetId, releaseId),
        ),
      )
      .orderBy(desc(auditLogs.timestamp));

    return NextResponse.json({
      ok: true,
      data: entries.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
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
    console.error('Fund release notes GET error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
