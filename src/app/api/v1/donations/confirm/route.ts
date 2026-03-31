import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { handlePaymentSuccess } from '@/app/api/v1/donations/webhook/route';

/**
 * POST /api/v1/donations/confirm
 *
 * Client-initiated donation confirmation. Called immediately after
 * stripe.confirmPayment succeeds so that the donation is recorded
 * without waiting for the async Stripe webhook.
 *
 * The webhook remains the durable backup — both paths are fully
 * idempotent (unique constraint on stripe_payment_id + onConflictDoNothing).
 *
 * Security:
 *  - The client sends only the paymentIntentId.
 *  - The server retrieves the PaymentIntent from the Stripe API,
 *    so all data is authoritative — nothing is trusted from the client.
 *  - Processing is idempotent — duplicate calls are harmless.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const paymentIntentId = body?.paymentIntentId;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing paymentIntentId' },
        { status: 400 },
      );
    }

    // Retrieve the authoritative PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { ok: false, error: 'Payment not yet succeeded' },
        { status: 422 },
      );
    }

    // Process the donation (idempotent — safe if webhook also fires)
    await handlePaymentSuccess(paymentIntent);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/v1/donations/confirm] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to confirm donation' },
      { status: 500 },
    );
  }
}
