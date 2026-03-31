import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundPoolAllocations, campaigns } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/v1/admin/fund-pool — List fund pool allocations with summary.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);
    const { searchParams } = request.nextUrl;

    const statusFilter = searchParams.get('status') ?? '';
    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);
    const cursorParam = searchParams.get('cursor');
    const offset = cursorParam ? parseInt(cursorParam, 10) : 0;

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid cursor', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Build conditions
    const conditions = [];
    if (statusFilter && ['pending', 'allocated', 'disbursed'].includes(statusFilter)) {
      conditions.push(eq(fundPoolAllocations.status, statusFilter));
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    // Fetch allocations with source campaign title
    const rows = await db
      .select({
        id: fundPoolAllocations.id,
        donationId: fundPoolAllocations.donationId,
        sourceCampaignId: fundPoolAllocations.sourceCampaignId,
        sourceCampaignTitle: campaigns.title,
        sourceCampaignSlug: campaigns.slug,
        targetCampaignId: fundPoolAllocations.targetCampaignId,
        amount: fundPoolAllocations.amount,
        status: fundPoolAllocations.status,
        notes: fundPoolAllocations.notes,
        allocatedAt: fundPoolAllocations.allocatedAt,
        disbursedAt: fundPoolAllocations.disbursedAt,
        createdAt: fundPoolAllocations.createdAt,
      })
      .from(fundPoolAllocations)
      .innerJoin(campaigns, eq(fundPoolAllocations.sourceCampaignId, campaigns.id))
      .where(whereClause)
      .orderBy(desc(fundPoolAllocations.createdAt))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);

    // Summary counts
    const [summary] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${fundPoolAllocations.status} = 'pending')::int`,
        allocated: sql<number>`count(*) filter (where ${fundPoolAllocations.status} = 'allocated')::int`,
        disbursed: sql<number>`count(*) filter (where ${fundPoolAllocations.status} = 'disbursed')::int`,
        totalPending: sql<number>`coalesce(sum(${fundPoolAllocations.amount}) filter (where ${fundPoolAllocations.status} = 'pending'), 0)::int`,
        totalAllocated: sql<number>`coalesce(sum(${fundPoolAllocations.amount}) filter (where ${fundPoolAllocations.status} = 'allocated'), 0)::int`,
        totalDisbursed: sql<number>`coalesce(sum(${fundPoolAllocations.amount}) filter (where ${fundPoolAllocations.status} = 'disbursed'), 0)::int`,
      })
      .from(fundPoolAllocations);

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        ...summary,
        cursor: hasMore ? String(offset + limit) : undefined,
        hasMore,
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
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[GET /api/v1/admin/fund-pool]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
