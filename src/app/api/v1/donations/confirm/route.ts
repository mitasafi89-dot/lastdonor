import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { processPaymentSuccess } from '@/lib/services/payment-service';

/**
 * POST /api/v1/donations/confirm
 *
 * Client-initiated donation confirmation. Called immediately after
 * stripe.confirmPayment succeeds so that the donation is recorded
 * without waiting for the async Stripe webhook.
 *
 * The webhook remains the durable backup - both paths are fully
 * idempotent (unique constraint on stripe_payment_id + onConflictDoNothing).
 *
 * Security:
 *  - The client sends only the paymentIntentId.
 *  - The server retrieves the PaymentIntent from the Stripe API,
 *    so all data is authoritative - nothing is trusted from the client.
 *  - Processing is idempotent - duplicate calls are harmless.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body?.sessionId;
    let paymentIntentId = body?.paymentIntentId;

    // If a Checkout Session ID was provided, retrieve the underlying PaymentIntent
    let sessionAmount: number | null = null;
    if (sessionId && typeof sessionId === 'string') {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      sessionAmount = session.amount_total;
      if (typeof session.payment_intent === 'string') {
        paymentIntentId = session.payment_intent;
      } else if (session.payment_intent?.id) {
        paymentIntentId = session.payment_intent.id;
      }
    }

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      // No PI yet (e.g. async payment method). Return session amount for display;
      // the webhook will handle donation recording when the PI settles.
      if (sessionAmount && sessionAmount > 0) {
        return NextResponse.json({ ok: true, amount: sessionAmount });
      }
      return NextResponse.json(
        { ok: false, error: 'Missing paymentIntentId or sessionId' },
        { status: 400 },
      );
    }

    // Retrieve the authoritative PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Process the donation immediately (idempotent - safe if webhook also fires)
      await processPaymentSuccess(paymentIntent);
    }
    // else: PI is still processing - webhook will handle it. Return amount for display.

    return NextResponse.json({
      ok: true,
      amount: paymentIntent.amount ?? sessionAmount,
    });
  } catch (error) {
    console.error('[POST /api/v1/donations/confirm] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to confirm donation' },
      { status: 500 },
    );
  }
}
