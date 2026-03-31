import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabase, BUCKET_NAME, validateFile, getPublicUrl } from '@/lib/supabase-storage';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export const runtime = 'nodejs';

/**
 * POST /api/v1/campaign-photos
 *
 * Upload a campaign hero image. Any authenticated user can upload.
 * Files are stored in Supabase Storage under the `campaign-photos/` folder.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Sign in to upload a photo', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

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

  const validationError = validateFile(file);
  if (validationError) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: validationError, requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
  const fileName = `campaign-photos/${randomUUID()}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    console.error('Campaign photo upload failed:', uploadError.message);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Upload failed', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }

  const publicUrl = getPublicUrl(fileName);

  return NextResponse.json({
    ok: true,
    data: { url: publicUrl },
  });
}
