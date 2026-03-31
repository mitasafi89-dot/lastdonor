import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignMilestones, milestoneEvidence, campaigns, users } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { notifyAdminEvidenceSubmitted } from '@/lib/notifications';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const MAX_EVIDENCE_ATTEMPTS = 5;

const submitEvidenceSchema = z.object({
  fileUrl: z.string().url().max(2048),
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.string().regex(/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/, 'Only JPEG, PNG, WebP, HEIC images or PDF files are accepted'),
  description: z.string().max(2000).optional(),
});

/**
 * POST /api/v1/campaigns/[slug]/milestones/[milestoneId]/evidence
 *
 * Submit evidence for a reached milestone. Only the campaign creator can submit.
 * Transitions milestone status from 'reached' → 'evidence_submitted'.
 * The slug param accepts a campaign UUID.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; milestoneId: string }> },
) {
  const requestId = randomUUID();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }

    const { slug: idOrSlug, milestoneId } = await params;

    // Validate milestone ID is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(milestoneId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid milestone ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Verify campaign exists and user is the creator (support both UUID and slug)
    const campaignCondition = uuidRegex.test(idOrSlug)
      ? eq(campaigns.id, idOrSlug)
      : eq(campaigns.slug, idOrSlug);

    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(campaignCondition)
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    // Evidence submission is only allowed after campaign completes.
    // During the campaign, milestones are for progress tracking only.
    if (campaign.status !== 'completed') {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Evidence can only be submitted after the campaign is fully funded. Keep sharing your campaign to reach your goal!', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    if (campaign.creatorId !== session.user.id) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Only the campaign creator can submit evidence', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }

    const campaignId = campaign.id;

    // Verify milestone exists and belongs to this campaign
    const [milestone] = await db
      .select()
      .from(campaignMilestones)
      .where(and(
        eq(campaignMilestones.id, milestoneId),
        eq(campaignMilestones.campaignId, campaignId),
      ))
      .limit(1);

    if (!milestone) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Milestone not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    // Only allow evidence submission for 'reached' or 'rejected' milestones (resubmission after rejection)
    if (milestone.status !== 'reached' && milestone.status !== 'rejected') {
      const statusMessages: Record<string, string> = {
        pending: 'This milestone has not reached its funding threshold yet',
        evidence_submitted: 'Evidence has already been submitted and is awaiting review',
        approved: 'This milestone has already been approved',
        overdue: 'This milestone is overdue and cannot accept evidence submissions',
      };
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: statusMessages[milestone.status] || 'Cannot submit evidence in current state', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Check max evidence attempts
    const [{ total }] = await db
      .select({ total: count() })
      .from(milestoneEvidence)
      .where(eq(milestoneEvidence.milestoneId, milestoneId));

    if (total >= MAX_EVIDENCE_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Maximum evidence submission attempts reached. Please contact support.', requestId } } satisfies ApiError,
        { status: 429 },
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = submitEvidenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid evidence data', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Insert evidence and update milestone status in a transaction
    const evidence = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(milestoneEvidence).values({
        milestoneId,
        campaignId,
        submittedBy: session.user!.id!,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        description: data.description ?? null,
        attemptNumber: total + 1,
      }).returning({ id: milestoneEvidence.id });

      await tx
        .update(campaignMilestones)
        .set({ status: 'evidence_submitted', updatedAt: new Date() })
        .where(eq(campaignMilestones.id, milestoneId));

      return inserted;
    });

    // Notify admins (outside transaction — don't block on notification failure)
    try {
      const [creator] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, session.user.id!))
        .limit(1);

      await notifyAdminEvidenceSubmitted({
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug,
        milestoneTitle: milestone.title,
        phaseNumber: milestone.phase,
        creatorName: creator?.name || 'Campaigner',
      });
    } catch (notifError) {
      console.error('[Evidence] Failed to send admin notification:', notifError);
    }

    return NextResponse.json({
      ok: true,
      data: { evidenceId: evidence.id, milestoneStatus: 'evidence_submitted' },
    });
  } catch (error) {
    console.error('[Evidence] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
