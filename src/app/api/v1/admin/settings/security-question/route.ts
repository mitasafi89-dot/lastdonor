import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

const BCRYPT_ROUNDS = 12;

/** GET: Check if the current admin has a security question set. */
export async function GET() {
  const requestId = randomUUID();

  let session;
  try {
    session = await requireRole(['admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  const [user] = await db
    .select({ securityQuestion: users.securityQuestion })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    ok: true,
    data: {
      hasSecurityQuestion: !!user?.securityQuestion,
      question: user?.securityQuestion ?? null,
    },
  });
}

/** POST: Set or update the admin's security question + answer. */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  let session;
  try {
    session = await requireRole(['admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  let body: { question?: string; answer?: string; currentPassword?: string };
  try {
    body = await request.json();
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', requestId },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const { question, answer, currentPassword } = body;

  if (!question || question.trim().length < 5) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Security question must be at least 5 characters', requestId, field: 'question' },
    };
    return NextResponse.json(error, { status: 400 });
  }

  if (!answer || answer.trim().length < 2) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Security answer must be at least 2 characters', requestId, field: 'answer' },
    };
    return NextResponse.json(error, { status: 400 });
  }

  if (!currentPassword) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Current password is required to set a security question', requestId, field: 'currentPassword' },
    };
    return NextResponse.json(error, { status: 400 });
  }

  // Verify current password before allowing security question change
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.passwordHash) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Account does not have a password set', requestId },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordValid) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Current password is incorrect', requestId, field: 'currentPassword' },
    };
    return NextResponse.json(error, { status: 400 });
  }

  // Hash the security answer (case-insensitive: normalize to lowercase)
  const normalizedAnswer = answer.trim().toLowerCase();
  const answerHash = await bcrypt.hash(normalizedAnswer, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({
      securityQuestion: question.trim(),
      securityAnswerHash: answerHash,
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({
    ok: true,
    data: { message: 'Security question updated successfully' },
  });
}
