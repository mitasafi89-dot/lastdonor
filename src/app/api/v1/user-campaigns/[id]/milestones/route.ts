import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignMilestones, milestoneEvidence, fundReleases, auditLogs } from '@/db/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { defineMilestonesSchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/user-campaigns/[id]/milestones
 *
 * Define 3 milestones for milestone-based fund release.
 * Must be exactly 3 phases, percentages must sum to 100.
 * Campaigner only.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id: campaignId } = await params;

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        status: campaigns.status,
        milestoneFundRelease: campaigns.milestoneFundRelease,
        goalAmount: campaigns.goalAmount,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    if (campaign.creatorId !== session.user.id) {
      throw new ForbiddenError();
    }

    // Only allow milestone definition for draft campaigns or if not yet defined
    const existingMilestones = await db
      .select({ id: campaignMilestones.id })
      .from(campaignMilestones)
      .where(eq(campaignMilestones.campaignId, campaignId))
      .limit(1);

    if (existingMilestones.length > 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Milestones already defined for this campaign', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = defineMilestonesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Insert milestones
    const milestoneRows = parsed.data.milestones.map((m) => ({
      campaignId,
      phase: m.phase,
      title: m.title,
      description: m.description,
      evidenceType: m.evidenceType,
      fundPercentage: m.fundPercentage,
      estimatedCompletion: m.estimatedCompletion ? new Date(m.estimatedCompletion) : null,
      fundAmount: Math.round(campaign.goalAmount * m.fundPercentage / 100),
    }));

    const inserted = await db
      .insert(campaignMilestones)
      .values(milestoneRows)
      .returning();

    // Enable milestone-based fund release on the campaign
    await db
      .update(campaigns)
      .set({
        milestoneFundRelease: true,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'milestones_defined',
      actorId: session.user.id,
      actorRole: session.user.role as 'donor' | 'editor' | 'admin',
      targetType: 'campaign',
      targetId: campaignId,
      details: {
        milestones: parsed.data.milestones.map((m) => ({
          phase: m.phase,
          title: m.title,
          fundPercentage: m.fundPercentage,
        })),
      },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      data: { milestones: inserted, milestoneFundRelease: true },
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
        { ok: false, error: { code: 'FORBIDDEN', message: 'Not authorized', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('Milestone definition error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * GET /api/v1/user-campaigns/[id]/milestones
 *
 * Get milestones and their evidence for a campaign.
 * Campaigner or admin.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id: campaignId } = await params;

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        milestoneFundRelease: campaigns.milestoneFundRelease,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        totalReleasedAmount: campaigns.totalReleasedAmount,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const role = session.user.role as string;
    const isOwner = campaign.creatorId === session.user.id;
    if (!isOwner && !['editor', 'admin'].includes(role)) {
      throw new ForbiddenError();
    }

    const milestones = await db
      .select()
      .from(campaignMilestones)
      .where(eq(campaignMilestones.campaignId, campaignId))
      .orderBy(asc(campaignMilestones.phase));

    // Fetch evidence and fund releases for all milestones
    const milestoneIds = milestones.map((m) => m.id);
    const [evidenceRows, releaseRows] = await Promise.all([
      milestoneIds.length > 0
        ? db
            .select({
              id: milestoneEvidence.id,
              milestoneId: milestoneEvidence.milestoneId,
              fileUrl: milestoneEvidence.fileUrl,
              fileName: milestoneEvidence.fileName,
              fileSize: milestoneEvidence.fileSize,
              mimeType: milestoneEvidence.mimeType,
              description: milestoneEvidence.description,
              status: milestoneEvidence.status,
              reviewerNotes: milestoneEvidence.reviewerNotes,
              reviewedAt: milestoneEvidence.reviewedAt,
              attemptNumber: milestoneEvidence.attemptNumber,
              createdAt: milestoneEvidence.createdAt,
            })
            .from(milestoneEvidence)
            .where(eq(milestoneEvidence.campaignId, campaignId))
            .orderBy(desc(milestoneEvidence.attemptNumber))
        : Promise.resolve([]),
      milestoneIds.length > 0
        ? db
            .select({
              id: fundReleases.id,
              milestoneId: fundReleases.milestoneId,
              amount: fundReleases.amount,
              status: fundReleases.status,
              approvedAt: fundReleases.approvedAt,
              releasedAt: fundReleases.releasedAt,
              notes: fundReleases.notes,
            })
            .from(fundReleases)
            .where(eq(fundReleases.campaignId, campaignId))
        : Promise.resolve([]),
    ]);

    // Group evidence and fund releases by milestone
    const evidenceByMilestone = new Map<string, typeof evidenceRows>();
    for (const e of evidenceRows) {
      const arr = evidenceByMilestone.get(e.milestoneId) ?? [];
      arr.push(e);
      evidenceByMilestone.set(e.milestoneId, arr);
    }

    const releaseByMilestone = new Map<string, (typeof releaseRows)[0]>();
    for (const r of releaseRows) {
      releaseByMilestone.set(r.milestoneId, r);
    }

    const enrichedMilestones = milestones.map((m) => ({
      ...m,
      evidence: evidenceByMilestone.get(m.id) ?? [],
      fundRelease: releaseByMilestone.get(m.id) ?? null,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        milestoneFundRelease: campaign.milestoneFundRelease,
        goalAmount: campaign.goalAmount,
        raisedAmount: campaign.raisedAmount,
        totalReleasedAmount: campaign.totalReleasedAmount,
        milestones: enrichedMilestones,
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
        { ok: false, error: { code: 'FORBIDDEN', message: 'Not authorized', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('Milestone get error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
