import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, verificationDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { supabase, BUCKET_NAME, getPublicUrl } from '@/lib/supabase-storage';
import { uploadVerificationDocumentSchema, DOCUMENT_TYPES } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export const runtime = 'nodejs';

const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB for documents
const ALLOWED_DOC_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/user-campaigns/[id]/verification/documents
 *
 * Upload a verification document for a campaign.
 * Campaigner (campaign creator) only.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id: campaignId } = await params;

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    // Verify campaign exists and user is the creator
    const [campaign] = await db
      .select({
        id: campaigns.id,
        creatorId: campaigns.creatorId,
        verificationStatus: campaigns.verificationStatus,
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

    // Only allow uploads when verification is in an uploadable state
    const uploadableStates = ['unverified', 'submitted_for_review', 'documents_uploaded', 'info_requested', 'identity_verified', 'rejected'];
    if (!uploadableStates.includes(campaign.verificationStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Cannot upload documents in current verification state', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid form data', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Validate file
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `Invalid file type. Allowed: ${ALLOWED_DOC_TYPES.join(', ')}`, requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    if (file.size > MAX_DOC_SIZE) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 10MB', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Validate metadata fields
    const documentType = formData.get('documentType') as string | null;
    const description = formData.get('description') as string | null;

    const parsed = uploadVerificationDocumentSchema.safeParse({
      documentType,
      description: description || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
    const storagePath = `verification-documents/${campaignId}/${randomUUID()}.${safeExt}`;

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
      console.error('Verification document upload failed:', uploadError.message);
      return NextResponse.json(
        { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Upload failed', requestId } } satisfies ApiError,
        { status: 500 },
      );
    }

    const fileUrl = getPublicUrl(storagePath);

    // Insert document record
    const [doc] = await db
      .insert(verificationDocuments)
      .values({
        campaignId,
        uploadedBy: session.user.id!,
        documentType: parsed.data.documentType,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        description: parsed.data.description || null,
      })
      .returning({ id: verificationDocuments.id, status: verificationDocuments.status });

    return NextResponse.json({
      ok: true,
      data: { documentId: doc.id, status: doc.status, fileUrl },
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
        { ok: false, error: { code: 'FORBIDDEN', message: 'Not authorized to upload documents for this campaign', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('Verification document upload error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
