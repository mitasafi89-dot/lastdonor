import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase, BUCKET_NAME, validateFile, getPublicUrl } from '@/lib/supabase-storage';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin', 'editor']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin or editor access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
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

  const folder = (formData.get('folder') as string) || 'uploads';
  const safeFolderName = folder.replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
  const fileName = `${safeFolderName}/${randomUUID()}.${safeExt}`;

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
    console.error('Upload failed:', uploadError.message);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Upload failed', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }

  const publicUrl = getPublicUrl(fileName);

  return NextResponse.json({
    ok: true,
    data: { url: publicUrl, path: fileName },
  });
}
