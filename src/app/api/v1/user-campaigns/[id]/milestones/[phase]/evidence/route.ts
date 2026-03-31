import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignMilestones, milestoneEvidence, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { notifyAdminEvidenceSubmitted } from '@/lib/notifications';
import { supabase, BUCKET_NAME, getPublicUrl } from '@/lib/supabase-storage';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export const runtime = 'nodejs';

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_EVIDENCE_ATTEMPTS = 5;
const ALLOWED_EVIDENCE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

interface Params {
  params: Promise<{ id: string; phase: string }>;
}

/**
 * POST /api/v1/user-campaigns/[id]/milestones/[phase]/evidence
 *
 * Upload evidence for a campaign milestone.
 * Campaigner only. File upload via multipart/form-data.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id: campaignId, phase: phaseStr } = await params;
  const phase = parseInt(phaseStr, 10);

  if (isNaN(phase) || phase < 1 || phase > 3) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Phase must be 1, 2, or 3', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    // Verify campaign ownership
    const [campaign] = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        creatorId: campaigns.creatorId,
        milestoneFundRelease: campaigns.milestoneFundRelease,
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

    if (!campaign.milestoneFundRelease) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Milestone-based fund release is not enabled for this campaign', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Verify milestone exists and is in a submittable state
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

    const submittableStates = ['reached', 'rejected'];
    if (!submittableStates.includes(milestone.status)) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: `Cannot submit evidence for milestone in status: ${milestone.status}`, requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // For phase 2 and 3, previous phase must be approved
    if (phase > 1) {
      const [prevMilestone] = await db
        .select({ status: campaignMilestones.status })
        .from(campaignMilestones)
        .where(
          and(
            eq(campaignMilestones.campaignId, campaignId),
            eq(campaignMilestones.phase, phase - 1),
          ),
        )
        .limit(1);

      if (!prevMilestone || prevMilestone.status !== 'approved') {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: `Phase ${phase - 1} must be approved before submitting evidence for phase ${phase}`, requestId } } satisfies ApiError,
          { status: 409 },
        );
      }
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid form data', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Support multiple files: formData.getAll('file') returns all files,
    // but also accept a single 'file' field for backward compatibility
    const files = formData.getAll('file').filter((f): f is File => f instanceof File);
    const description = formData.get('description') as string | null;

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Maximum 10 files per submission', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Validate all files before uploading any
    for (const file of files) {
      if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
        return NextResponse.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid file type for "${file.name}". Allowed: ${ALLOWED_EVIDENCE_TYPES.join(', ')}`, requestId } } satisfies ApiError,
          { status: 400 },
        );
      }

      if (file.size > MAX_EVIDENCE_SIZE) {
        return NextResponse.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: `File "${file.name}" is too large. Maximum size is 10MB per file`, requestId } } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    // Calculate attempt number
    const existingEvidence = await db
      .select({ attemptNumber: milestoneEvidence.attemptNumber })
      .from(milestoneEvidence)
      .where(eq(milestoneEvidence.milestoneId, milestone.id));

    const attemptNumber = existingEvidence.length > 0
      ? Math.max(...existingEvidence.map((e) => e.attemptNumber)) + 1
      : 1;

    if (attemptNumber > MAX_EVIDENCE_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: `Maximum ${MAX_EVIDENCE_ATTEMPTS} evidence submissions reached for this milestone. Please contact support for assistance.`, requestId } } satisfies ApiError,
        { status: 429 },
      );
    }

    // Upload all files to storage
    const uploadedFiles: Array<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string }> = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
      const storagePath = `milestone-evidence/${campaignId}/phase-${phase}/${randomUUID()}.${safeExt}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Milestone evidence upload failed for "${file.name}":`, uploadError.message);
        return NextResponse.json(
          { ok: false, error: { code: 'INTERNAL_ERROR', message: `Upload failed for "${file.name}"`, requestId } } satisfies ApiError,
          { status: 500 },
        );
      }

      uploadedFiles.push({
        fileUrl: getPublicUrl(storagePath),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    }

    // Insert all evidence records and update milestone status in a transaction
    const evidenceRows = await db.transaction(async (tx) => {
      const rows = [];
      for (const uploaded of uploadedFiles) {
        const [evidenceRow] = await tx
          .insert(milestoneEvidence)
          .values({
            milestoneId: milestone.id,
            campaignId,
            submittedBy: session.user.id!,
            fileUrl: uploaded.fileUrl,
            fileName: uploaded.fileName,
            fileSize: uploaded.fileSize,
            mimeType: uploaded.mimeType,
            description: description || null,
            attemptNumber,
          })
          .returning();
        rows.push(evidenceRow);
      }

      // Update milestone status to evidence_submitted
      await tx
        .update(campaignMilestones)
        .set({
          status: 'evidence_submitted',
          updatedAt: new Date(),
        })
        .where(eq(campaignMilestones.id, milestone.id));

      return rows;
    });

    // Notify admins (outside transaction, non-blocking)
    try {
      // Fetch creator name for notification
      const [creator] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, session.user.id!))
        .limit(1);

      await notifyAdminEvidenceSubmitted({
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug,
        milestoneTitle: milestone.title,
        phaseNumber: phase,
        creatorName: creator?.name || 'Campaigner',
      });
    } catch (notifError) {
      console.error('[EvidenceUpload] Failed to notify admins:', notifError);
    }

    return NextResponse.json({
      ok: true,
      data: {
        evidenceIds: evidenceRows.map((e) => e.id),
        fileCount: evidenceRows.length,
        status: evidenceRows[0].status,
        attemptNumber,
        milestoneStatus: 'evidence_submitted',
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
    console.error('Milestone evidence upload error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
