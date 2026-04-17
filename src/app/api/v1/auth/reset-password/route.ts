import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { hashPassword } from '@/lib/password';
import type { ApiError } from '@/types/api';
import { resetPasswordApiSchema } from '@/lib/validators/user';

/**
 * POST /api/v1/auth/reset-password
 * Body: { email: string, token: string, password: string }
 * Validates the token and sets a new password.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const parsed = resetPasswordApiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { email, token, password } = parsed.data;

    // Look up the token
    const [record] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, `reset:${email}`),
          eq(verificationTokens.token, token),
        ),
      )
      .limit(1);

    if (!record) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired reset link', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Check expiration
    if (record.expires < new Date()) {
      // Clean up expired token
      await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, `reset:${email}`),
            eq(verificationTokens.token, token),
          ),
        );
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Reset link has expired. Please request a new one.', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Hash new password and update user
    const passwordHash = await hashPassword(password);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.email, email));

    // Delete the used token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, `reset:${email}`));

    return NextResponse.json({
      ok: true,
      data: { message: 'Password has been reset successfully. You can now log in.' },
    });
  } catch (error) {
    console.error('[POST /api/v1/auth/reset-password]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset password', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
