import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, verificationDocuments, users } from '@/db/schema';
import { eq, and, desc, asc, count, inArray } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { verificationQueueQuerySchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/admin/verification-queue
 *
 * List campaigns pending verification review.
 * Admin only. Paginated with filters.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    const { searchParams } = new URL(request.url);
    const parsed = verificationQueueQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { status, category, sortBy, sortOrder, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    // Safe ORDER BY using allowlisted column names only
    const sortColumn = campaigns[sortBy];
    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Reviewable statuses: campaigns that need admin attention
    type VerificationStatus = typeof campaigns.$inferSelect.verificationStatus;
    const reviewableStatuses: VerificationStatus[] = status
      ? [status as VerificationStatus]
      : ['documents_uploaded', 'submitted_for_review', 'identity_verified'];

    // Build conditions
    const conditions = [
      inArray(campaigns.verificationStatus, reviewableStatuses),
    ];

    if (category) {
      conditions.push(eq(campaigns.category, category as typeof campaigns.$inferInsert.category));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(campaigns)
      .where(whereClause!);

    // Get campaigns with creator info
    const items = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        category: campaigns.category,
        verificationStatus: campaigns.verificationStatus,
        verificationNotes: campaigns.verificationNotes,
        verificationReviewedAt: campaigns.verificationReviewedAt,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        creatorId: campaigns.creatorId,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.creatorId, users.id))
      .where(whereClause!)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get document counts per campaign
    const campaignIds = items.map((c) => c.id);
    let docCounts: Record<string, number> = {};

    if (campaignIds.length > 0) {
      const counts = await db
        .select({
          campaignId: verificationDocuments.campaignId,
          count: count(),
        })
        .from(verificationDocuments)
        .where(inArray(verificationDocuments.campaignId, campaignIds))
        .groupBy(verificationDocuments.campaignId);

      docCounts = Object.fromEntries(counts.map((c) => [c.campaignId, c.count]));
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      documentCount: docCounts[item.id] || 0,
    }));

    return NextResponse.json({
      ok: true,
      data: enrichedItems,
      meta: {
        total,
        page,
        limit,
        hasMore: offset + limit < total,
      },
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
    console.error('Verification queue error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
