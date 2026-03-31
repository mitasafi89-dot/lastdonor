import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@/lib/validators/user';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const BCRYPT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.errors[0];
      const response: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError?.message ?? 'Invalid input',
          field: firstError?.path.join('.'),
          requestId,
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { email, password, name } = result.data;

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      const response: ApiError = {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'An account with this email already exists.',
          requestId,
        },
      };
      return NextResponse.json(response, { status: 409 });
    }

    // Check password against HaveIBeenPwned (k-anonymity model)
    const pwned = await checkPwnedPassword(password);
    if (pwned) {
      const response: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'This password has appeared in a data breach. Please choose a different password.',
          field: 'password',
          requestId,
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        role: 'donor',
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    return NextResponse.json(
      { ok: true, data: { id: newUser.id, email: newUser.email, name: newUser.name } },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/auth/register]', error);
    const response: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed. Please try again.',
        requestId,
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * Check password against HaveIBeenPwned API using k-anonymity.
 * Hashes the password with SHA-1, sends first 5 chars as prefix,
 * checks if the suffix appears in the response.
 */
async function checkPwnedPassword(password: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      { signal: AbortSignal.timeout(3000) },
    );

    if (!response.ok) return false; // Fail open — don't block registration

    const text = await response.text();
    return text.split('\n').some((line) => line.startsWith(suffix));
  } catch {
    // Network error — fail open
    return false;
  }
}
