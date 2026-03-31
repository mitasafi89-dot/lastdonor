import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { donations, campaigns } from '@/db/schema';
import { eq, desc, and, gte, lte, ilike, or, sql } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * GET /api/v1/admin/donations — List all donations with filtering
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);
    const { searchParams } = request.nextUrl;

    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);
    const cursorParam = searchParams.get('cursor');
    const offset = cursorParam ? parseInt(cursorParam, 10) : 0;
    const search = searchParams.get('search')?.trim() ?? '';
    const campaignFilter = searchParams.get('campaignId') ?? '';
    const sourceFilter = searchParams.get('source') ?? '';
    const refundedFilter = searchParams.get('refunded') ?? '';
    const sinceParam = searchParams.get('since') ?? '';
    const untilParam = searchParams.get('until') ?? '';

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid cursor', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const conditions = [];

    if (search.length > 0) {
      const pattern = `%${search}%`;
      conditions.push(or(
        ilike(donations.donorName, pattern),
        ilike(donations.donorEmail, pattern),
      )!);
    }

    if (campaignFilter) {
      conditions.push(eq(donations.campaignId, campaignFilter));
    }

    if (sourceFilter === 'real' || sourceFilter === 'seed') {
      conditions.push(eq(donations.source, sourceFilter));
    }

    if (refundedFilter === 'true') {
      conditions.push(eq(donations.refunded, true));
    } else if (refundedFilter === 'false') {
      conditions.push(eq(donations.refunded, false));
    }

    if (sinceParam) {
      const since = new Date(sinceParam);
      if (!isNaN(since.getTime())) {
        conditions.push(gte(donations.createdAt, since));
      }
    }

    if (untilParam) {
      const until = new Date(untilParam);
      if (!isNaN(until.getTime())) {
        conditions.push(lte(donations.createdAt, until));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(donations)
      .where(where);

    const results = await db
      .select({
        id: donations.id,
        amount: donations.amount,
        donorName: donations.donorName,
        donorEmail: donations.donorEmail,
        donorLocation: donations.donorLocation,
        message: donations.message,
        isAnonymous: donations.isAnonymous,
        isRecurring: donations.isRecurring,
        phaseAtTime: donations.phaseAtTime,
        source: donations.source,
        refunded: donations.refunded,
        createdAt: donations.createdAt,
        campaignId: donations.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        userId: donations.userId,
      })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .where(where)
      .orderBy(desc(donations.createdAt))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? String(offset + limit) : undefined;

    // Summary stats
    const [stats] = await db
      .select({
        totalAmount: sql<number>`COALESCE(sum(${donations.amount}), 0)::int`,
        totalCount: sql<number>`count(*)::int`,
        refundedCount: sql<number>`count(*) FILTER (WHERE ${donations.refunded} = true)::int`,
        refundedAmount: sql<number>`COALESCE(sum(${donations.amount}) FILTER (WHERE ${donations.refunded} = true), 0)::int`,
      })
      .from(donations)
      .where(where);

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        cursor: nextCursor,
        hasMore,
        total: totalResult.count,
        stats,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[GET /api/v1/admin/donations]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch donations', requestId } } satisfies ApiError, { status: 500 });
  }
}
