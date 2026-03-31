import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { createOnboardingLink } from '@/lib/stripe-connect';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

/**
 * POST /api/v1/user/stripe-connect/onboarding
 * Generates a fresh Stripe onboarding link for a user whose account
 * needs to complete or resume onboarding.
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

  const [user] = await db
    .select({ stripeConnectAccountId: users.stripeConnectAccountId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.stripeConnectAccountId) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'No Stripe Connect account found. Create one first.', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  try {
    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://lastdonor.org';
    const returnUrl = `${origin}/dashboard/payout-settings?onboarding=complete`;
    const refreshUrl = `${origin}/dashboard/payout-settings?onboarding=refresh`;

    const onboardingUrl = await createOnboardingLink(
      user.stripeConnectAccountId,
      returnUrl,
      refreshUrl,
    );

    const response: ApiResponse<{ onboardingUrl: string }> = {
      ok: true,
      data: { onboardingUrl },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[POST /api/v1/user/stripe-connect/onboarding]', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate onboarding link', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
