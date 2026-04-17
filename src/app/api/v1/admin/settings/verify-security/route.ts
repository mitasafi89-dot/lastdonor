import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createSecurityToken } from '@/lib/crypto.server';
import type { ApiError } from '@/types/api';

// In-memory rate limiter for security verification: 5 attempts per 15 minutes per user
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = failedAttempts.get(userId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - entry.windowStart) };
  }
  return { allowed: true, retryAfterMs: 0 };
}

function recordFailedAttempt(userId: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(userId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    failedAttempts.set(userId, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(userId: string): void {
  failedAttempts.delete(userId);
}

/** POST: Verify the admin's security answer. Returns a short-lived token on success. */
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

  let body: { answer?: string };
  try {
    body = await request.json();
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', requestId },
    };
    return NextResponse.json(error, { status: 400 });
  }

  // Rate limit check - must happen after auth but before any answer verification
  const rateCheck = checkRateLimit(session.user.id);
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
    const error: ApiError = {
      ok: false,
      error: { code: 'RATE_LIMITED', message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minutes.`, requestId },
    };
    return NextResponse.json(error, { status: 429, headers: { 'Retry-After': String(retryAfterSec) } });
  }

  const { answer } = body;
  if (!answer || answer.trim().length === 0) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Answer is required', requestId, field: 'answer' },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const [user] = await db
    .select({
      securityQuestion: users.securityQuestion,
      securityAnswerHash: users.securityAnswerHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.securityQuestion || !user?.securityAnswerHash) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'No security question configured. Set one before updating environment keys.', requestId },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const normalizedAnswer = answer.trim().toLowerCase();
  const isCorrect = await bcrypt.compare(normalizedAnswer, user.securityAnswerHash);

  if (!isCorrect) {
    recordFailedAttempt(session.user.id);
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Security answer is incorrect', requestId, field: 'answer' },
    };
    return NextResponse.json(error, { status: 400 });
  }

  clearAttempts(session.user.id);
  const { token, expiresAt } = createSecurityToken(session.user.id);

  return NextResponse.json({
    ok: true,
    data: { token, expiresAt },
  });
}
