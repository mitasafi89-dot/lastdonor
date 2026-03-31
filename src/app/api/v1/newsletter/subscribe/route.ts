import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsletterSubscribers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { subscribeSchema } from '@/lib/validators/newsletter';
import { resend } from '@/lib/resend';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const result = subscribeSchema.safeParse(body);

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

    const { email, source } = result.data;

    // Check for existing subscriber
    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    if (existing) {
      if (!existing.unsubscribedAt) {
        // Already actively subscribed — idempotent success
        return NextResponse.json({ ok: true, data: { status: 'already_subscribed' } });
      }

      // Re-subscribe
      await db
        .update(newsletterSubscribers)
        .set({ unsubscribedAt: null, source: source ?? existing.source })
        .where(eq(newsletterSubscribers.id, existing.id));

      return NextResponse.json({ ok: true, data: { status: 'resubscribed' } });
    }

    // New subscriber
    await db.insert(newsletterSubscribers).values({
      email,
      source: source ?? null,
    });

    // Send welcome email
    try {
      await resend.emails.send({
        from: 'LastDonor.org <noreply@lastdonor.org>',
        to: email,
        subject: 'Welcome to LastDonor.org',
        text: `Thank you for subscribing to LastDonor.org!\n\nYou'll receive updates about campaigns making a real difference in people's lives.\n\nEvery dollar has a name behind it.\n\n— The LastDonor.org Team`,
      });
    } catch {
      // Don't fail the subscription if email fails
    }

    return NextResponse.json(
      { ok: true, data: { status: 'subscribed' } },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/v1/newsletter/subscribe]', error);
    const errResp: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Subscription failed. Please try again.',
        requestId,
      },
    };
    return NextResponse.json(errResp, { status: 500 });
  }
}
