import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  campaigns,
  campaignMilestones,
  milestoneEvidence,
  fundReleases,
  auditLogs,
  users,
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { adminMilestoneReviewSchema } from '@/lib/validators/verification';
import { notifyMilestoneAchieved, notifyFundReleased, createAndEmail } from '@/lib/notifications';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

interface Params {
  params: Promise<{ campaignId: string; phase: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[campaignId]/milestones/[phase]
 *
 * Returns milestone details and its evidence files for admin review.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { campaignId, phase: phaseStr } = await params;
  const phase = parseInt(phaseStr, 10);

  if (isNaN(phase) || phase < 1 || phase > 3) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Phase must be 1, 2, or 3', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    await requireRole(['admin']);

    const [milestone] = await db
      .select({
        id: campaignMilestones.id,
        phase: campaignMilestones.phase,
        title: campaignMilestones.title,
        description: campaignMilestones.description,
        evidenceType: campaignMilestones.evidenceType,
        fundPercentage: campaignMilestones.fundPercentage,
        fundAmount: campaignMilestones.fundAmount,
        status: campaignMilestones.status,
      })
      .from(campaignMilestones)
      .where(
        and(
          eq(campaignMilestones.campaignId, campaignId),
          eq(campaignMilestones.phase, phase),
        ),
      )
      .limit(1);

    if (!milestone) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: `Milestone phase ${phase} not found`, requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const evidence = await db
      .select({
        id: milestoneEvidence.id,
        fileName: milestoneEvidence.fileName,
        fileSize: milestoneEvidence.fileSize,
        mimeType: milestoneEvidence.mimeType,
        fileUrl: milestoneEvidence.fileUrl,
        description: milestoneEvidence.description,
        status: milestoneEvidence.status,
        reviewerNotes: milestoneEvidence.reviewerNotes,
        attemptNumber: milestoneEvidence.attemptNumber,
        createdAt: milestoneEvidence.createdAt,
      })
      .from(milestoneEvidence)
      .where(eq(milestoneEvidence.milestoneId, milestone.id))
      .orderBy(desc(milestoneEvidence.createdAt));

    return NextResponse.json({
      ok: true,
      data: {
        milestone,
        evidence: evidence.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
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
    console.error('Admin milestone evidence GET error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/admin/campaigns/[campaignId]/milestones/[phase]
 *
 * Admin approve or reject milestone evidence.
 * On approve: creates a fund release record (status: approved).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { campaignId, phase: phaseStr } = await params;
  const phase = parseInt(phaseStr, 10);

  if (isNaN(phase) || phase < 1 || phase > 3) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Phase must be 1, 2, or 3', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const session = await requireRole(['admin']);

    // Get campaign with creator info for notifications
    const [campaign] = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        verificationStatus: campaigns.verificationStatus,
        milestoneFundRelease: campaigns.milestoneFundRelease,
        raisedAmount: campaigns.raisedAmount,
        totalReleasedAmount: campaigns.totalReleasedAmount,
        creatorId: campaigns.creatorId,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(campaigns)
      .leftJoin(users, eq(campaigns.creatorId, users.id))
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const IDENTITY_VERIFIED_STATUSES = ['identity_verified', 'fully_verified'];
    if (!IDENTITY_VERIFIED_STATUSES.includes(campaign.verificationStatus as string)) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Campaign creator identity must be verified before funds can be released', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    if (!campaign.milestoneFundRelease) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Milestone-based fund release not enabled', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Get milestone
    const [milestone] = await db
      .select()
      .from(campaignMilestones)
      .where(
        and(
          eq(campaignMilestones.campaignId, campaignId),
          eq(campaignMilestones.phase, phase),
        ),
      )
      .limit(1);

    if (!milestone) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: `Milestone phase ${phase} not found`, requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    if (milestone.status !== 'evidence_submitted') {
      // Phase 1 (M1) does not require evidence — identity verification alone is sufficient
      // Allow approval when milestone has been reached but no evidence was submitted
      if (!(phase === 1 && milestone.status === 'reached')) {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: `Cannot review milestone in status: ${milestone.status}`, requestId } } satisfies ApiError,
          { status: 409 },
        );
      }
    }

    const body = await request.json();
    const parsed = adminMilestoneReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { action, notes } = parsed.data;
    const now = new Date();

    if (action === 'approve') {
      // Use the static fund amount (pre-calculated when milestones were created)
      const releaseAmount = milestone.fundAmount ?? 0;

      // Execute all DB writes in a transaction
      await db.transaction(async (tx) => {
        // Update milestone
        await tx
          .update(campaignMilestones)
          .set({
            status: 'approved',
            releasedAmount: releaseAmount,
            releasedAt: now,
            updatedAt: now,
          })
          .where(eq(campaignMilestones.id, milestone.id));

        // Mark all pending evidence for this milestone as approved
        await tx
          .update(milestoneEvidence)
          .set({
            status: 'approved',
            reviewerId: session.user.id!,
            reviewerNotes: notes || null,
            reviewedAt: now,
          })
          .where(
            and(
              eq(milestoneEvidence.milestoneId, milestone.id),
              eq(milestoneEvidence.status, 'pending'),
            ),
          );

        // Create fund release record
        await tx.insert(fundReleases).values({
          campaignId,
          milestoneId: milestone.id,
          amount: releaseAmount,
          status: 'approved',
          approvedBy: session.user.id!,
          approvedAt: now,
          notes: notes || null,
        });

        // Update campaign total released (SQL increment to avoid race condition)
        await tx
          .update(campaigns)
          .set({
            totalReleasedAmount: sql`${campaigns.totalReleasedAmount} + ${releaseAmount}`,
            updatedAt: now,
          })
          .where(eq(campaigns.id, campaignId));

        // Audit log
        await tx.insert(auditLogs).values({
          eventType: 'milestone.approved',
          actorId: session.user.id,
          actorRole: 'admin',
          targetType: 'campaign',
          targetId: campaignId,
          details: {
            phase,
            milestoneTitle: milestone.title,
            releaseAmount,
            notes: notes || null,
          },
          severity: 'info',
        });
      });

      // Notifications (outside transaction, non-blocking)
      try {
        await notifyMilestoneAchieved({
          campaignId,
          campaignTitle: campaign.title,
          campaignSlug: campaign.slug,
          milestoneTitle: milestone.title,
          phaseNumber: phase,
        });

        if (campaign.creatorId && campaign.creatorEmail) {
          await notifyFundReleased({
            campaignerId: campaign.creatorId,
            campaignerEmail: campaign.creatorEmail,
            campaignerName: campaign.creatorName || 'Campaigner',
            campaignTitle: campaign.title,
            campaignSlug: campaign.slug,
            phaseNumber: phase,
            amount: releaseAmount,
          });
        }
      } catch (notifError) {
        console.error('[MilestoneReview] Failed to send approval notifications:', notifError);
      }

      return NextResponse.json({
        ok: true,
        data: {
          milestoneStatus: 'approved',
          releaseAmount,
          phase,
        },
      });
    } else {
      // Reject - wrap in transaction
      await db.transaction(async (tx) => {
        await tx
          .update(campaignMilestones)
          .set({
            status: 'rejected',
            updatedAt: now,
          })
          .where(eq(campaignMilestones.id, milestone.id));

        // Mark pending evidence as rejected
        await tx
          .update(milestoneEvidence)
          .set({
            status: 'rejected',
            reviewerId: session.user.id!,
            reviewerNotes: notes || null,
            reviewedAt: now,
          })
          .where(
            and(
              eq(milestoneEvidence.milestoneId, milestone.id),
              eq(milestoneEvidence.status, 'pending'),
            ),
          );

        // Audit log
        await tx.insert(auditLogs).values({
          eventType: 'milestone.rejected',
          actorId: session.user.id,
          actorRole: 'admin',
          targetType: 'campaign',
          targetId: campaignId,
          details: {
            phase,
            milestoneTitle: milestone.title,
            notes: notes || null,
          },
          severity: 'warning',
        });
      });

      // Notify creator of rejection
      if (campaign.creatorId && campaign.creatorEmail) {
        try {
          await createAndEmail({
            userId: campaign.creatorId,
            type: 'milestone_rejected',
            title: `Phase ${phase} evidence rejected - "${campaign.title}"`,
            message: notes
              ? `Your evidence for Phase ${phase} was not approved. Reviewer notes: ${notes}`
              : `Your evidence for Phase ${phase} was not approved. Please review the requirements and resubmit.`,
            link: `/dashboard/campaigns/${campaign.slug}/milestones`,
            email: {
              to: campaign.creatorEmail,
              subject: `Evidence Rejected - Phase ${phase} of "${campaign.title}"`,
              html: `<p>Your evidence for Phase ${phase}: <strong>${milestone.title}</strong> of campaign "${campaign.title}" was not approved.</p>${notes ? `<p><strong>Reviewer notes:</strong> ${notes}</p>` : ''}<p>You may resubmit evidence for review.</p>`,
            },
          });
        } catch (notifError) {
          console.error('[MilestoneReview] Failed to send rejection notification:', notifError);
        }
      }

      return NextResponse.json({
        ok: true,
        data: {
          milestoneStatus: 'rejected',
          phase,
          notes: notes || null,
        },
      });
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
    console.error('Admin milestone review error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
