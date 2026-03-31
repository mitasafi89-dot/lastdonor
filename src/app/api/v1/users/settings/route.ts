import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { userPreferencesSchema } from '@/lib/validators/user';
import { randomUUID } from 'crypto';
import type { ApiError, ApiResponse } from '@/types/api';

export async function GET() {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  const [user] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    const error: ApiError = {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found', requestId },
    };
    return NextResponse.json(error, { status: 404 });
  }

  const response: ApiResponse<typeof user.preferences> = {
    ok: true,
    data: user.preferences,
  };
  return NextResponse.json(response);
}

export async function PUT(request: NextRequest) {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  const body = await request.json();
  const result = userPreferencesSchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const error: ApiError = {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstError?.message ?? 'Invalid input',
        field: firstError?.path.join('.'),
        requestId,
      },
    };
    return NextResponse.json(error, { status: 400 });
  }

  // Merge with existing preferences to preserve any unset fields
  const [existing] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const merged = {
    ...(typeof existing?.preferences === 'object' && existing.preferences !== null
      ? existing.preferences
      : {}),
    ...result.data,
  };

  await db
    .update(users)
    .set({ preferences: merged })
    .where(eq(users.id, session.user.id));

  const response: ApiResponse<typeof merged> = { ok: true, data: merged };
  return NextResponse.json(response);
}
