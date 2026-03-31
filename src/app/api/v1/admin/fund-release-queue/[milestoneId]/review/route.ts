import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignMilestones, milestoneEvidence, campaigns, users, fundReleases, auditLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { notifyMilestoneAchieved, notifyFundReleased, createAndEmail } from '@/lib/notifications';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/** Verification statuses that satisfy the identity requirement. */
const IDENTITY_VERIFIED_STATUSES = ['identity_verified', 'fully_verified'] as const;

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(5000).optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.notes && data.notes.trim().length > 0),
  { message: 'Notes are required when rejecting a milestone', path: ['notes'] },
);

/**
 * POST /api/v1/admin/fund-release-queue/[milestoneId]/review
 *
 * Admin reviews a milestone with submitted evidence.
 * HARD CONSTRAINT: Identity must be verified before approval.
 *
 * Approve flow: identity check → create fundRelease → update milestone → notify creator + donors
 * Reject flow: update milestone status → notify creator (for resubmission)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin']);
    const adminId = session.user!.id!;
    const { milestoneId } = await params;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(milestoneId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid milestone ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Parse body
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid review data', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { action, notes } = parsed.data;

    // Fetch milestone with campaign + creator info
    const milestoneRows = await db
      .select({
        milestoneId: campaignMilestones.id,
        phase: campaignMilestones.phase,
        title: campaignMilestones.title,
        status: campaignMilestones.status,
        fundAmount: campaignMilestones.fundAmount,
        fundPercentage: campaignMilestones.fundPercentage,
        campaignId: campaigns.id,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        campaignGoalAmount: campaigns.goalAmount,
        verificationStatus: campaigns.verificationStatus,
        creatorId: campaigns.creatorId,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(campaignMilestones)
      .innerJoin(campaigns, eq(campaignMilestones.campaignId, campaigns.id))
      .leftJoin(users, eq(campaigns.creatorId, users.id))
      .where(eq(campaignMilestones.id, milestoneId))
      .limit(1);

    if (milestoneRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Milestone not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const milestone = milestoneRows[0];

    // Only milestones in 'evidence_submitted' status can be reviewed
    if (milestone.status !== 'evidence_submitted') {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: `Cannot review milestone in '${milestone.status}' status. Expected 'evidence_submitted'.`, requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    if (action === 'approve') {
      // ── HARD CONSTRAINT: Identity verification required ──────────────────
      const verStatus = milestone.verificationStatus as string;
      if (!IDENTITY_VERIFIED_STATUSES.includes(verStatus as typeof IDENTITY_VERIFIED_STATUSES[number])) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'FORBIDDEN',
              message: `Cannot approve fund release: campaign creator identity is not verified (current status: '${verStatus}'). The creator must submit a government-issued ID or passport first.`,
              requestId,
            },
          } satisfies ApiError,
          { status: 403 },
        );
      }

      const fundAmount = milestone.fundAmount ?? 0;

      // Execute approval in a transaction
      await db.transaction(async (tx) => {
        // 1. Update milestone status to 'approved'
        await tx
          .update(campaignMilestones)
          .set({
            status: 'approved',
            releasedAmount: fundAmount,
            releasedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(campaignMilestones.id, milestoneId));

        // 2. Create fund release record (status: 'approved' — awaiting Stripe Connect transfer)
        await tx.insert(fundReleases).values({
          campaignId: milestone.campaignId,
          milestoneId,
          amount: fundAmount,
          status: 'approved',
          approvedBy: adminId,
          approvedAt: new Date(),
          notes: notes ?? null,
        });

        // 3. Update campaign total released amount
        await tx
          .update(campaigns)
          .set({
            totalReleasedAmount: sql`${campaigns.totalReleasedAmount} + ${fundAmount}`,
          })
          .where(eq(campaigns.id, milestone.campaignId));

        // 4. Approve all pending evidence for this milestone
        await tx
          .update(milestoneEvidence)
          .set({ status: 'approved', reviewerId: adminId, reviewedAt: new Date(), reviewerNotes: notes ?? null })
          .where(and(
            eq(milestoneEvidence.milestoneId, milestoneId),
            eq(milestoneEvidence.status, 'pending'),
          ));

        // 5. Audit log
        await tx.insert(auditLogs).values({
          eventType: 'milestone.approved',
          actorId: adminId,
          targetType: 'campaign',
          targetId: milestone.campaignId,
          severity: 'info',
          details: {
            milestoneId,
            phase: milestone.phase,
            fundAmount,
            verificationStatus: verStatus,
          },
        });
      });

      // Notifications (outside transaction — non-blocking)
      try {
        // Notify donors that milestone was achieved
        await notifyMilestoneAchieved({
          campaignId: milestone.campaignId,
          campaignTitle: milestone.campaignTitle,
          campaignSlug: milestone.campaignSlug,
          milestoneTitle: milestone.title,
          phaseNumber: milestone.phase,
        });

        // Notify creator that funds are approved for release
        if (milestone.creatorId && milestone.creatorEmail) {
          await notifyFundReleased({
            campaignerId: milestone.creatorId,
            campaignerEmail: milestone.creatorEmail,
            campaignerName: milestone.creatorName || 'Campaigner',
            campaignTitle: milestone.campaignTitle,
            campaignSlug: milestone.campaignSlug,
            phaseNumber: milestone.phase,
            amount: fundAmount,
          });
        }
      } catch (notifError) {
        console.error('[FundRelease] Failed to send approval notifications:', notifError);
      }

      return NextResponse.json({
        ok: true,
        data: {
          milestoneId,
          status: 'approved',
          fundAmount,
          message: `Phase ${milestone.phase} approved. Fund release record created.`,
        },
      });
    }

    // ── REJECT ──────────────────────────────────────────────────────────────
    await db.transaction(async (tx) => {
      await tx
        .update(campaignMilestones)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(campaignMilestones.id, milestoneId));

      // Reject all pending evidence
      await tx
        .update(milestoneEvidence)
        .set({ status: 'rejected', reviewerId: adminId, reviewedAt: new Date(), reviewerNotes: notes ?? null })
        .where(and(
          eq(milestoneEvidence.milestoneId, milestoneId),
          eq(milestoneEvidence.status, 'pending'),
        ));

      await tx.insert(auditLogs).values({
        eventType: 'milestone.rejected',
        actorId: adminId,
        targetType: 'campaign',
        targetId: milestone.campaignId,
        severity: 'warning',
        details: {
          milestoneId,
          phase: milestone.phase,
          notes,
        },
      });
    });

    // Notify creator of rejection (they can resubmit evidence)
    if (milestone.creatorId && milestone.creatorEmail) {
      try {
        await createAndEmail({
          userId: milestone.creatorId,
          type: 'milestone_rejected',
          title: `Phase ${milestone.phase} evidence rejected - "${milestone.campaignTitle}"`,
          message: notes
            ? `Your evidence for Phase ${milestone.phase} was not approved. Reviewer notes: ${notes}`
            : `Your evidence for Phase ${milestone.phase} was not approved. Please review the requirements and resubmit.`,
          link: `/dashboard/campaigns/${milestone.campaignSlug}/milestones`,
          email: {
            to: milestone.creatorEmail,
            subject: `Evidence Rejected - Phase ${milestone.phase} of "${milestone.campaignTitle}"`,
            html: `<p>Your evidence for Phase ${milestone.phase}: <strong>${milestone.title}</strong> of campaign "${milestone.campaignTitle}" was not approved.</p>${notes ? `<p><strong>Reviewer notes:</strong> ${notes}</p>` : ''}<p>You may resubmit evidence for review.</p>`,
          },
        });
      } catch (notifError) {
        console.error('[FundRelease] Failed to send rejection notification:', notifError);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        milestoneId,
        status: 'rejected',
        message: `Phase ${milestone.phase} evidence rejected. Creator can resubmit.`,
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
    console.error('[FundRelease] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
