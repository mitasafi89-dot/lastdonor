import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { donorCampaignSubscriptions, campaigns, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { subscribeCampaignSchema } from '@/lib/validators/verification';
import { auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

type RouteParams = { params: Promise<{ slug: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/campaigns/[slug]/subscribe - Check subscription status for the current user
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { slug: idOrSlug } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: true, data: { subscribed: false } });
    }

    // Resolve user email
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.email) {
      return NextResponse.json({ ok: true, data: { subscribed: false } });
    }

    // Resolve campaign
    const condition = UUID_REGEX.test(idOrSlug)
      ? eq(campaigns.id, idOrSlug)
      : eq(campaigns.slug, idOrSlug);

    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(condition)
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const [sub] = await db
      .select({ subscribed: donorCampaignSubscriptions.subscribed })
      .from(donorCampaignSubscriptions)
      .where(
        and(
          eq(donorCampaignSubscriptions.campaignId, campaign.id),
          eq(donorCampaignSubscriptions.donorEmail, user.email),
        ),
      )
      .limit(1);

    return NextResponse.json({
      ok: true,
      data: { subscribed: sub?.subscribed === true },
    });
  } catch (error) {
    console.error('[GET /api/v1/campaigns/[slug]/subscribe]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check subscription', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/campaigns/[slug]/subscribe - Subscribe to campaign updates
 *
 * Accepts both UUID and slug for the campaign identifier.
 * Accessible by anyone (logged in or guest with email).
 * Uses upsert on (donorEmail, campaignId) unique constraint.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { slug: idOrSlug } = await params;

  try {
    const body = await request.json().catch(() => null);
    const parsed = subscribeCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // Verify campaign exists (support both UUID and slug)
    const condition = UUID_REGEX.test(idOrSlug)
      ? eq(campaigns.id, idOrSlug)
      : eq(campaigns.slug, idOrSlug);

    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(condition)
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const campaignId = campaign.id;

    // Get user ID if logged in
    const session = await auth();
    const userId = session?.user?.id ?? null;

    // Upsert subscription
    await db
      .insert(donorCampaignSubscriptions)
      .values({
        donorEmail: email,
        userId,
        campaignId: campaignId,
        subscribed: true,
      })
      .onConflictDoUpdate({
        target: [donorCampaignSubscriptions.donorEmail, donorCampaignSubscriptions.campaignId],
        set: {
          subscribed: true,
          unsubscribedAt: null,
          userId: userId ?? undefined,
        },
      });

    return NextResponse.json({ ok: true, data: { subscribed: true } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/v1/campaigns/[slug]/subscribe]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to subscribe', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/campaigns/[slug]/subscribe - Unsubscribe from campaign updates
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { slug: idOrSlug } = await params;

  try {
    const body = await request.json().catch(() => null);
    const parsed = subscribeCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Email is required', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // Resolve campaign ID from UUID or slug
    const condition = UUID_REGEX.test(idOrSlug)
      ? eq(campaigns.id, idOrSlug)
      : eq(campaigns.slug, idOrSlug);

    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(condition)
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    await db
      .update(donorCampaignSubscriptions)
      .set({
        subscribed: false,
        unsubscribedAt: new Date(),
      })
      .where(
        and(
          eq(donorCampaignSubscriptions.campaignId, campaign.id),
          eq(donorCampaignSubscriptions.donorEmail, email),
        ),
      );

    return NextResponse.json({ ok: true, data: { subscribed: false } });
  } catch (error) {
    console.error('[DELETE /api/v1/campaigns/[slug]/subscribe]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to unsubscribe', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
