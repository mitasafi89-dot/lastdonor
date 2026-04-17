import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { createIntentSchema } from '@/lib/validators/donation';
import { stripe } from '@/lib/stripe';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const parsed = createIntentSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      const errorBody: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError.message,
          field: firstError.path.join('.'),
          requestId,
        },
      };
      return NextResponse.json(errorBody, { status: 400 });
    }

    const data = parsed.data;

    // Verify campaign exists and is in a donatable status
    const [campaign] = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, data.campaignId),
          or(
            eq(campaigns.status, 'active'),
            eq(campaigns.status, 'last_donor_zone'),
          ),
        ),
      )
      .limit(1);

    if (!campaign) {
      const errorBody: ApiError = {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found or not accepting donations',
          requestId,
        },
      };
      return NextResponse.json(errorBody, { status: 404 });
    }

    // Create Stripe PaymentIntent
    // Generate server-side idempotency key if client omits one
    const idempotencyKey = data.idempotencyKey ?? `${data.campaignId}:${data.donorEmail}:${data.amount}:${Math.floor(Date.now() / 60_000)}`;
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: data.amount,
        currency: 'usd',
        metadata: {
          campaignId: data.campaignId,
          donorName: data.donorName || 'Anonymous',
          donorEmail: data.donorEmail,
          donorLocation: data.donorLocation ?? '',
          message: data.message ?? '',
          isAnonymous: String(data.isAnonymous),
          isRecurring: String(data.isRecurring),
          subscribedToUpdates: String(data.subscribedToUpdates),
        },
      },
      { idempotencyKey },
    );

    const response: ApiResponse<{
      clientSecret: string;
      paymentIntentId: string;
      amount: number;
      campaignTitle: string;
    }> = {
      ok: true,
      data: {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: data.amount,
        campaignTitle: campaign.title,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/v1/donations/create-intent]', error);
    const errorBody: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create payment intent',
        requestId,
      },
    };
    return NextResponse.json(errorBody, { status: 500 });
  }
}
