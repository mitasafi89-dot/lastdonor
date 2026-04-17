import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundPoolAllocations, auditLogs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const disburseSchema = z.object({
  allocationIds: z.array(z.string().uuid()).min(1).max(100),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/admin/fund-pool/disburse - Mark allocated funds as disbursed.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin']);
    const body = await request.json();
    const parsed = disburseSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: firstError.message, field: firstError.path.join('.'), requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { allocationIds, notes } = parsed.data;

    // Validate all allocations exist and are in 'allocated' status
    const allocations = await db
      .select({ id: fundPoolAllocations.id, status: fundPoolAllocations.status, amount: fundPoolAllocations.amount })
      .from(fundPoolAllocations)
      .where(inArray(fundPoolAllocations.id, allocationIds));

    if (allocations.length !== allocationIds.length) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'One or more allocation IDs not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const nonAllocated = allocations.filter(a => a.status !== 'allocated');
    if (nonAllocated.length > 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `${nonAllocated.length} allocation(s) are not in allocated status`, requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const totalDisbursed = allocations.reduce((sum, a) => sum + a.amount, 0);

    await db.transaction(async (tx) => {
      await tx
        .update(fundPoolAllocations)
        .set({
          status: 'disbursed',
          disbursedAt: new Date(),
          notes: notes ? notes : undefined,
        })
        .where(
          and(
            inArray(fundPoolAllocations.id, allocationIds),
            eq(fundPoolAllocations.status, 'allocated'),
          ),
        );

      await tx.insert(auditLogs).values({
        eventType: 'fund_pool.disbursed',
        actorId: session.user.id,
        actorRole: session.user.role,
        targetType: 'fund_pool',
        severity: 'info',
        details: {
          allocationIds,
          count: allocationIds.length,
          totalDisbursed,
          notes,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      data: { disbursed: allocationIds.length, totalDisbursed },
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
    console.error('[POST /api/v1/admin/fund-pool/disburse]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
