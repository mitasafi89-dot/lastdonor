import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { ApiError } from '@/types/api';

/**
 * POST /api/v1/auth/reset-password
 * Body: { email: string, token: string, password: string }
 * Validates the token and sets a new password.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const email = (body.email as string)?.trim()?.toLowerCase();
    const token = body.token as string;
    const password = body.password as string;

    if (!email || !token || !password) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Email, token, and new password are required', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters', field: 'password', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

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
    const passwordHash = await bcrypt.hash(password, 12);

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
