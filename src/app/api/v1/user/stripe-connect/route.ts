import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { createConnectAccountSchema } from '@/lib/validators/payout';
import {
  createExpressAccount,
  createOnboardingLink,
  getAccountStatus,
  isConnectAvailable,
} from '@/lib/stripe-connect';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

/**
 * GET /api/v1/user/stripe-connect
 * Returns the current user's Stripe Connect account status and info.
 */
export async function GET() {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId } } satisfies ApiError,
      { status: 401 },
    );
  }

  const [user] = await db
    .select({
      stripeConnectAccountId: users.stripeConnectAccountId,
      stripeConnectStatus: users.stripeConnectStatus,
      stripeConnectOnboardedAt: users.stripeConnectOnboardedAt,
      payoutCurrency: users.payoutCurrency,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'User not found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  // If user has a Connect account, fetch live status from Stripe
  let liveStatus = null;
  if (user.stripeConnectAccountId) {
    try {
      liveStatus = await getAccountStatus(user.stripeConnectAccountId);
    } catch (err) {
      console.error('[GET /api/v1/user/stripe-connect] Stripe fetch error:', err);
    }
  }

  const data = {
    hasAccount: !!user.stripeConnectAccountId,
    status: user.stripeConnectStatus,
    onboardedAt: user.stripeConnectOnboardedAt,
    payoutCurrency: user.payoutCurrency,
    ...(liveStatus && {
      liveStatus: liveStatus.status,
      chargesEnabled: liveStatus.chargesEnabled,
      payoutsEnabled: liveStatus.payoutsEnabled,
      requiresAction: liveStatus.currentlyDue.length > 0 || !!liveStatus.disabledReason,
    }),
  };

  const response: ApiResponse<typeof data> = { ok: true, data };
  return NextResponse.json(response);
}

/**
 * POST /api/v1/user/stripe-connect
 * Creates a Stripe Express connected account and returns the onboarding URL.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId } } satisfies ApiError,
      { status: 401 },
    );
  }

  // Check if user already has a Connect account
  const [existing] = await db
    .select({ stripeConnectAccountId: users.stripeConnectAccountId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (existing?.stripeConnectAccountId) {
    return NextResponse.json(
      { ok: false, error: { code: 'CONFLICT', message: 'Stripe Connect account already exists', requestId } } satisfies ApiError,
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = createConnectAccountSchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: firstError.message, field: firstError.path.join('.'), requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    // Fail fast if Stripe Connect is not enabled on this platform
    const connectAvailable = await isConnectAvailable();
    if (!connectAvailable) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'CONNECT_NOT_ENABLED' as const,
            message: 'Stripe Connect has not been activated on this platform. The platform administrator needs to complete the Connect platform profile in the Stripe Dashboard.',
            requestId,
          },
        } satisfies ApiError,
        { status: 503 },
      );
    }

    // Create the Express account
    const account = await createExpressAccount(
      session.user.id,
      session.user.email!,
      parsed.data.country,
    );
    // Store on user
    await db
      .update(users)
      .set({
        stripeConnectAccountId: account.id,
        stripeConnectStatus: 'onboarding_started',
      })
      .where(eq(users.id, session.user.id));

    // Generate onboarding link
    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://lastdonor.org';
    const returnUrl = `${origin}/dashboard/payout-settings?onboarding=complete`;
    const refreshUrl = `${origin}/dashboard/payout-settings?onboarding=refresh`;

    const onboardingUrl = await createOnboardingLink(account.id, returnUrl, refreshUrl);

    const data = {
      accountId: account.id,
      onboardingUrl,
    };

    const response: ApiResponse<typeof data> = { ok: true, data };
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error('[POST /api/v1/user/stripe-connect]', err);

    // Surface actionable Stripe errors to the client
    let message = 'Failed to create Stripe Connect account';
    let code: ApiError['error']['code'] = 'INTERNAL_ERROR';
    if (err instanceof Error && 'type' in err) {
      const stripeErr = err as { type: string; message: string; code?: string };
      if (
        stripeErr.message?.includes('signed up for Connect') ||
        stripeErr.message?.includes('Connect platform profile') ||
        stripeErr.message?.includes('not have access to the Accounts resource')
      ) {
        code = 'CONNECT_NOT_ENABLED';
        message = 'Stripe Connect has not been activated on this platform. The platform administrator needs to complete the Connect platform profile in the Stripe Dashboard.';
        console.error(
          '[POST /api/v1/user/stripe-connect] Stripe Connect not enabled.',
          'Go to https://dashboard.stripe.com/settings/connect to complete the platform profile.',
        );
      } else if (stripeErr.type === 'StripeAuthenticationError') {
        message = 'Payment service configuration error. Please contact support.';
      } else if (stripeErr.code === 'country_unsupported') {
        message = 'Stripe Connect is not available in your country yet.';
      }
    }

    return NextResponse.json(
      { ok: false, error: { code, message, requestId } } satisfies ApiError,
      { status: code === 'CONNECT_NOT_ENABLED' ? 503 : 500 },
    );
  }
}
