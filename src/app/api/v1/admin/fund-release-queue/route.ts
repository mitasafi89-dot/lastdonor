import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignMilestones, milestoneEvidence, users } from '@/db/schema';
import { eq, and, desc, sql, count, inArray } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { fundReleaseQueueQuerySchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/admin/fund-release-queue
 *
 * List milestones with evidence awaiting admin review.
 * Admin only. Paginated.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    const { searchParams } = new URL(request.url);
    const parsed = fundReleaseQueueQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    // Default: show milestones with submitted evidence
    type MilestoneStatus = 'pending' | 'evidence_submitted' | 'approved' | 'rejected' | 'overdue';
    const milestoneStatus: MilestoneStatus = (status || 'evidence_submitted') as MilestoneStatus;

    // Count total
    const [{ total }] = await db
      .select({ total: count() })
      .from(campaignMilestones)
      .where(eq(campaignMilestones.status, milestoneStatus));

    // Get milestones with campaign info
    const items = await db
      .select({
        milestoneId: campaignMilestones.id,
        phase: campaignMilestones.phase,
        title: campaignMilestones.title,
        description: campaignMilestones.description,
        evidenceType: campaignMilestones.evidenceType,
        fundPercentage: campaignMilestones.fundPercentage,
        fundAmount: campaignMilestones.fundAmount,
        milestoneStatus: campaignMilestones.status,
        estimatedCompletion: campaignMilestones.estimatedCompletion,
        milestoneCreatedAt: campaignMilestones.createdAt,
        campaignId: campaigns.id,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        campaignStatus: campaigns.status,
        campaignGoalAmount: campaigns.goalAmount,
        campaignRaisedAmount: campaigns.raisedAmount,
        campaignTotalReleased: campaigns.totalReleasedAmount,
        verificationStatus: campaigns.verificationStatus,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(campaignMilestones)
      .innerJoin(campaigns, eq(campaignMilestones.campaignId, campaigns.id))
      .leftJoin(users, eq(campaigns.creatorId, users.id))
      .where(eq(campaignMilestones.status, milestoneStatus))
      .orderBy(desc(campaignMilestones.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get evidence counts and latest evidence for each milestone
    const milestoneIds = items.map((m) => m.milestoneId);
    let evidenceByMilestone: Record<string, { count: number; latestAt: string | null }> = {};

    if (milestoneIds.length > 0) {
      const evidenceCounts = await db
        .select({
          milestoneId: milestoneEvidence.milestoneId,
          count: count(),
          latestAt: sql<string>`MAX(${milestoneEvidence.createdAt})`,
        })
        .from(milestoneEvidence)
        .where(inArray(milestoneEvidence.milestoneId, milestoneIds))
        .groupBy(milestoneEvidence.milestoneId);

      evidenceByMilestone = Object.fromEntries(
        evidenceCounts.map((e) => [e.milestoneId, { count: e.count, latestAt: e.latestAt }]),
      );
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      evidenceCount: evidenceByMilestone[item.milestoneId]?.count || 0,
      latestEvidenceAt: evidenceByMilestone[item.milestoneId]?.latestAt || null,
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
    console.error('Fund release queue error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
