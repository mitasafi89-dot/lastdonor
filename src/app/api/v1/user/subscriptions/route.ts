import { NextResponse } from 'next/server';
import { db } from '@/db';
import { donorCampaignSubscriptions, campaigns, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/user/subscriptions - List all campaign subscriptions for the current user
 */
export async function GET() {
  const requestId = randomUUID();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }

    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.email) {
      return NextResponse.json({ ok: true, data: { subscriptions: [] } });
    }

    const subs = await db
      .select({
        id: donorCampaignSubscriptions.id,
        campaignId: donorCampaignSubscriptions.campaignId,
        subscribed: donorCampaignSubscriptions.subscribed,
        createdAt: donorCampaignSubscriptions.createdAt,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
        campaignStatus: campaigns.status,
        campaignHeroImageUrl: campaigns.heroImageUrl,
        campaignRaisedAmount: campaigns.raisedAmount,
        campaignGoalAmount: campaigns.goalAmount,
      })
      .from(donorCampaignSubscriptions)
      .innerJoin(campaigns, eq(donorCampaignSubscriptions.campaignId, campaigns.id))
      .where(
        and(
          eq(donorCampaignSubscriptions.donorEmail, user.email),
          eq(donorCampaignSubscriptions.subscribed, true),
        ),
      )
      .orderBy(desc(donorCampaignSubscriptions.createdAt));

    return NextResponse.json({
      ok: true,
      data: {
        subscriptions: subs.map((s) => ({
          id: s.id,
          campaignId: s.campaignId,
          campaignTitle: s.campaignTitle,
          campaignSlug: s.campaignSlug,
          campaignStatus: s.campaignStatus,
          campaignHeroImageUrl: s.campaignHeroImageUrl,
          campaignRaisedAmount: s.campaignRaisedAmount,
          campaignGoalAmount: s.campaignGoalAmount,
          subscribedAt: s.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[GET /api/v1/user/subscriptions]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch subscriptions', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
