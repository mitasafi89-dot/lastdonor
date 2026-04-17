import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { refundBatches, refundRecords, donations, campaigns, auditLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { bulkOpSemaphore } from '@/lib/concurrency-limiter';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

type RouteParams = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/admin/refund-batches/[id] - Get batch detail with individual records.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    await requireRole(['admin']);

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid batch ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const [batch] = await db
      .select({
        id: refundBatches.id,
        campaignId: refundBatches.campaignId,
        campaignTitle: campaigns.title,
        reason: refundBatches.reason,
        totalDonations: refundBatches.totalDonations,
        totalAmount: refundBatches.totalAmount,
        refundedCount: refundBatches.refundedCount,
        failedCount: refundBatches.failedCount,
        status: refundBatches.status,
        startedAt: refundBatches.startedAt,
        completedAt: refundBatches.completedAt,
        createdAt: refundBatches.createdAt,
      })
      .from(refundBatches)
      .leftJoin(campaigns, eq(refundBatches.campaignId, campaigns.id))
      .where(eq(refundBatches.id, id))
      .limit(1);

    if (!batch) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Refund batch not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    // Fetch individual refund records with donation details
    const records = await db
      .select({
        id: refundRecords.id,
        donationId: refundRecords.donationId,
        donorEmail: donations.donorEmail,
        donorName: donations.donorName,
        amount: refundRecords.amount,
        stripeRefundId: refundRecords.stripeRefundId,
        status: refundRecords.status,
        errorMessage: refundRecords.errorMessage,
        emailSent: refundRecords.emailSent,
        processedAt: refundRecords.processedAt,
      })
      .from(refundRecords)
      .leftJoin(donations, eq(refundRecords.donationId, donations.id))
      .where(eq(refundRecords.batchId, id));

    const serializedRecords = records.map((r) => ({
      ...r,
      processedAt: r.processedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        ...batch,
        startedAt: batch.startedAt.toISOString(),
        completedAt: batch.completedAt?.toISOString() ?? null,
        createdAt: batch.createdAt.toISOString(),
        records: serializedRecords,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[GET /api/v1/admin/refund-batches/[id]]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get refund batch', requestId } } satisfies ApiError, { status: 500 });
  }
}

/**
 * PATCH /api/v1/admin/refund-batches/[id] - Retry failed refund records
 */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    const session = await requireRole(['admin']);

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid batch ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Get batch
    const [batch] = await db
      .select({ id: refundBatches.id, status: refundBatches.status, failedCount: refundBatches.failedCount, refundedCount: refundBatches.refundedCount })
      .from(refundBatches)
      .where(eq(refundBatches.id, id))
      .limit(1);

    if (!batch) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Refund batch not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    if (batch.status !== 'partial_failure') {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Only batches with partial_failure status can be retried', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Get failed records with their donation's stripePaymentId
    const failedRecords = await db
      .select({
        id: refundRecords.id,
        donationId: refundRecords.donationId,
        amount: refundRecords.amount,
        stripePaymentId: donations.stripePaymentId,
      })
      .from(refundRecords)
      .innerJoin(donations, eq(refundRecords.donationId, donations.id))
      .where(
        and(
          eq(refundRecords.batchId, id),
          eq(refundRecords.status, 'failed'),
        ),
      );

    if (failedRecords.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'No failed records to retry', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Acquire semaphore to limit concurrent bulk refund operations
    const releaseSemaphore = await bulkOpSemaphore.acquire();

    try {
      // Phase 1: Call Stripe for all retries OUTSIDE any DB transaction.
      // Collect results in memory to avoid holding connections during external I/O.
      const retryResults: Array<{
        recordId: string;
        donationId: string;
        stripeRefundId: string | null;
        errorMessage: string | null;
        status: 'completed' | 'failed';
      }> = [];

      for (const record of failedRecords) {
        if (!record.stripePaymentId) {
          retryResults.push({
            recordId: record.id,
            donationId: record.donationId,
            stripeRefundId: null,
            errorMessage: 'No Stripe payment ID on donation',
            status: 'failed',
          });
          continue;
        }

        try {
          const refund = await stripe.refunds.create({ payment_intent: record.stripePaymentId });
          retryResults.push({
            recordId: record.id,
            donationId: record.donationId,
            stripeRefundId: refund.id,
            errorMessage: null,
            status: 'completed',
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown Stripe error';
          retryResults.push({
            recordId: record.id,
            donationId: record.donationId,
            stripeRefundId: null,
            errorMessage,
            status: 'failed',
          });
        }
      }

      // Phase 2: Persist all results in a single transaction (no external I/O inside).
      const retriedOk = retryResults.filter((r) => r.status === 'completed').length;
      const retriedFail = retryResults.filter((r) => r.status === 'failed').length;

      await db.transaction(async (tx) => {
        // Update all refund records in batch
        for (const result of retryResults) {
          if (result.status === 'completed') {
            await tx.update(refundRecords).set({
              stripeRefundId: result.stripeRefundId,
              status: 'completed',
              errorMessage: null,
              processedAt: new Date(),
            }).where(eq(refundRecords.id, result.recordId));
          } else {
            await tx.update(refundRecords).set({
              errorMessage: result.errorMessage,
              processedAt: new Date(),
            }).where(eq(refundRecords.id, result.recordId));
          }
        }

        // Mark all successful donations as refunded in one UPDATE
        const refundedDonationIds = retryResults
          .filter((r) => r.status === 'completed')
          .map((r) => r.donationId);
        if (refundedDonationIds.length > 0) {
          await tx.update(donations)
            .set({ refunded: true })
            .where(sql`${donations.id} IN ${refundedDonationIds}`);
        }

        // Update batch counters
        const newRefundedCount = batch.refundedCount + retriedOk;
        const newFailedCount = batch.failedCount - retriedOk;

        await tx.update(refundBatches).set({
          refundedCount: newRefundedCount,
          failedCount: newFailedCount,
          status: newFailedCount === 0 ? 'completed' : 'partial_failure',
          completedAt: new Date(),
        }).where(eq(refundBatches.id, id));
      });

      const newFailedCount = batch.failedCount - retriedOk;

      await db.insert(auditLogs).values({
        eventType: 'refund_batch.retried',
        actorId: session.user.id,
        actorRole: 'admin',
        targetType: 'campaign',
        targetId: id,
        severity: 'info',
        details: { batchId: id, retriedOk, retriedFail, totalRetried: failedRecords.length },
      });

      return NextResponse.json({
        ok: true,
        data: {
          batchId: id,
          retriedOk,
          retriedFail,
          newStatus: newFailedCount === 0 ? 'completed' : 'partial_failure',
        },
      });
    } finally {
      releaseSemaphore();
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[PATCH /api/v1/admin/refund-batches/[id]]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retry refund batch', requestId } } satisfies ApiError, { status: 500 });
  }
}
