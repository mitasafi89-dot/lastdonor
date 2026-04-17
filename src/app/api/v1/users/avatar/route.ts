import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { supabase, BUCKET_NAME, validateFile, getPublicUrl } from '@/lib/supabase-storage';
import { randomUUID } from 'crypto';
import type { ApiError, ApiResponse } from '@/types/api';

export const runtime = 'nodejs';

/**
 * POST /api/v1/users/avatar
 *
 * Upload or replace the authenticated user's avatar.
 * Accepts multipart form data with a single `file` field.
 * Stores under `avatars/{userId}/{uuid}.{ext}` in Supabase Storage,
 * then updates the user's avatarUrl in the database.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Sign in to upload an avatar', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid form data', requestId },
      } satisfies ApiError,
      { status: 400 },
    );
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'No file provided', requestId },
      } satisfies ApiError,
      { status: 400 },
    );
  }

  const validationError = validateFile(file);
  if (validationError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: validationError, requestId },
      } satisfies ApiError,
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
  const storagePath = `avatars/${userId}/${randomUUID()}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Delete old avatar files for this user (best-effort cleanup)
  try {
    const { data: existing } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`avatars/${userId}`);
    if (existing && existing.length > 0) {
      const paths = existing.map((f) => `avatars/${userId}/${f.name}`);
      await supabase.storage.from(BUCKET_NAME).remove(paths);
    }
  } catch {
    // Non-critical: old files remain in storage
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    console.error('Avatar upload failed:', uploadError.message);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Upload failed', requestId },
      } satisfies ApiError,
      { status: 500 },
    );
  }

  const publicUrl = getPublicUrl(storagePath);

  const [updated] = await db
    .update(users)
    .set({ avatarUrl: publicUrl })
    .where(eq(users.id, userId))
    .returning({ id: users.id, avatarUrl: users.avatarUrl });

  const response: ApiResponse<{ url: string }> = {
    ok: true,
    data: { url: updated.avatarUrl ?? publicUrl },
  };
  return NextResponse.json(response);
}

/**
 * DELETE /api/v1/users/avatar
 *
 * Remove the authenticated user's avatar.
 * Deletes files from Supabase Storage and clears avatarUrl in the database.
 */
export async function DELETE() {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  const userId = session.user.id;

  // Remove files from storage
  try {
    const { data: existing } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`avatars/${userId}`);
    if (existing && existing.length > 0) {
      const paths = existing.map((f) => `avatars/${userId}/${f.name}`);
      await supabase.storage.from(BUCKET_NAME).remove(paths);
    }
  } catch {
    // Non-critical: files may remain in storage
  }

  await db
    .update(users)
    .set({ avatarUrl: null })
    .where(eq(users.id, userId));

  const response: ApiResponse<null> = { ok: true, data: null };
  return NextResponse.json(response);
}
