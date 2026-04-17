import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundPoolAllocations, campaigns, auditLogs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const allocateSchema = z.object({
  allocationIds: z.array(z.string().uuid()).min(1).max(100),
  targetCampaignId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/admin/fund-pool/allocate - Allocate pending funds to a real campaign.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin']);
    const body = await request.json();
    const parsed = allocateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: firstError.message, field: firstError.path.join('.'), requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { allocationIds, targetCampaignId, notes } = parsed.data;

    // Validate target campaign exists and is NOT simulated
    const [targetCampaign] = await db
      .select({ id: campaigns.id, simulationFlag: campaigns.simulationFlag, title: campaigns.title })
      .from(campaigns)
      .where(eq(campaigns.id, targetCampaignId))
      .limit(1);

    if (!targetCampaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Target campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    if (targetCampaign.simulationFlag) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot allocate funds to a simulated campaign', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Validate all allocation IDs exist and are pending
    const allocations = await db
      .select({ id: fundPoolAllocations.id, status: fundPoolAllocations.status })
      .from(fundPoolAllocations)
      .where(inArray(fundPoolAllocations.id, allocationIds));

    if (allocations.length !== allocationIds.length) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'One or more allocation IDs not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const nonPending = allocations.filter(a => a.status !== 'pending');
    if (nonPending.length > 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `${nonPending.length} allocation(s) are not in pending status`, requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Update all allocations atomically
    await db.transaction(async (tx) => {
      await tx
        .update(fundPoolAllocations)
        .set({
          targetCampaignId,
          status: 'allocated',
          allocatedAt: new Date(),
          notes: notes ?? null,
        })
        .where(
          and(
            inArray(fundPoolAllocations.id, allocationIds),
            eq(fundPoolAllocations.status, 'pending'),
          ),
        );

      await tx.insert(auditLogs).values({
        eventType: 'fund_pool.allocated',
        actorId: session.user.id,
        actorRole: session.user.role,
        targetType: 'fund_pool',
        severity: 'info',
        details: {
          allocationIds,
          targetCampaignId,
          targetCampaignTitle: targetCampaign.title,
          count: allocationIds.length,
          notes,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      data: { allocated: allocationIds.length, targetCampaignId },
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
    console.error('[POST /api/v1/admin/fund-pool/allocate]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
