import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsletterSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;

    if (!email) {
      const error: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          field: 'email',
          requestId,
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    const [subscriber] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    if (!subscriber) {
      // Return success even if not found (don't reveal subscriber status)
      return NextResponse.json({ ok: true, data: { status: 'unsubscribed' } });
    }

    if (subscriber.unsubscribedAt) {
      return NextResponse.json({ ok: true, data: { status: 'already_unsubscribed' } });
    }

    await db
      .update(newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.id, subscriber.id));

    return NextResponse.json({ ok: true, data: { status: 'unsubscribed' } });
  } catch (error) {
    console.error('[POST /api/v1/newsletter/unsubscribe]', error);
    const errResp: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unsubscribe failed. Please try again.',
        requestId,
      },
    };
    return NextResponse.json(errResp, { status: 500 });
  }
}
