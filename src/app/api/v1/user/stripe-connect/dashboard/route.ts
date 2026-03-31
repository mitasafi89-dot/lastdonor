import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { createDashboardLink } from '@/lib/stripe-connect';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

/**
 * POST /api/v1/user/stripe-connect/dashboard
 * Generates a Stripe Express Dashboard login link so the user
 * can view payouts, tax documents, and account details on Stripe.
 */
export async function POST() {
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
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.stripeConnectAccountId) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'No Stripe Connect account found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  // Dashboard login links require the account to have completed onboarding
  if (user.stripeConnectStatus === 'not_started' || user.stripeConnectStatus === 'onboarding_started') {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Complete Stripe onboarding first', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const dashboardUrl = await createDashboardLink(user.stripeConnectAccountId);

    const response: ApiResponse<{ dashboardUrl: string }> = {
      ok: true,
      data: { dashboardUrl },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[POST /api/v1/user/stripe-connect/dashboard]', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate dashboard link', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
