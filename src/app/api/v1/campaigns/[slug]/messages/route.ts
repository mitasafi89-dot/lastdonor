import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignMessages, users } from '@/db/schema';
import { publicMessageSelect } from '@/db/public-select';
import { eq, and, desc, gte, sql, or, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { messageSchema } from '@/lib/validators/message';
import type { ApiResponse, ApiError } from '@/types/api';

interface Params {
  params: Promise<{ slug: string }>;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const RATE_LIMIT_PER_DAY = 5;

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { slug } = await params;

  try {
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.slug, slug),
          or(
            eq(campaigns.status, 'active'),
            eq(campaigns.status, 'last_donor_zone'),
            eq(campaigns.status, 'completed'),
          ),
        ),
      )
      .limit(1);

    if (!campaign) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
          requestId,
        },
      };
      return NextResponse.json(body, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const cursorParam = parseInt(searchParams.get('cursor') ?? '0', 10);
    const cursor = isNaN(cursorParam) || cursorParam < 0 ? 0 : cursorParam;
    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);

    const messages = await db
      .select(publicMessageSelect)
      .from(campaignMessages)
      .where(
        and(
          eq(campaignMessages.campaignId, campaign.id),
          eq(campaignMessages.hidden, false),
        ),
      )
      .orderBy(desc(campaignMessages.createdAt))
      .offset(cursor)
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const data = messages.slice(0, limit).map((m) => ({
      ...m,
      donorName: m.isAnonymous ? 'Anonymous' : m.donorName,
      donorLocation: m.isAnonymous ? null : m.donorLocation,
    }));

    const body: ApiResponse<typeof data> = {
      ok: true,
      data,
      meta: { cursor: hasMore ? String(cursor + limit) : undefined, hasMore },
    };
    return NextResponse.json(body);
  } catch {
    const body: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId },
    };
    return NextResponse.json(body, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { slug } = await params;

  try {
    const session = await auth();
    if (!session?.user) {
      const body: ApiError = {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId },
      };
      return NextResponse.json(body, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = messageSchema.safeParse(rawBody);
    if (!parsed.success) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          requestId,
        },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const [campaign] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);

    if (!campaign || !['active', 'last_donor_zone', 'completed'].includes(campaign.status)) {
      const body: ApiError = {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId },
      };
      return NextResponse.json(body, { status: 404 });
    }

    // Rate limiting: 5 messages per user per campaign per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignMessages)
      .where(
        and(
          eq(campaignMessages.campaignId, campaign.id),
          eq(campaignMessages.userId, session.user.id),
          gte(campaignMessages.createdAt, oneDayAgo),
        ),
      );

    if (recentCount.count >= RATE_LIMIT_PER_DAY) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Maximum 5 messages per campaign per day.',
          requestId,
        },
      };
      return NextResponse.json(body, { status: 429 });
    }

    // Look up user profile for name/location
    const [userProfile] = await db
      .select({ name: users.name, location: users.location })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const donorName = parsed.data.isAnonymous
      ? 'Anonymous'
      : (userProfile?.name ?? 'Donor');
    const donorLocation = parsed.data.isAnonymous
      ? null
      : (userProfile?.location ?? null);

    const [message] = await db
      .insert(campaignMessages)
      .values({
        campaignId: campaign.id,
        userId: session.user.id,
        donorName,
        donorLocation,
        message: parsed.data.message,
        isAnonymous: parsed.data.isAnonymous,
      })
      .returning({ id: campaignMessages.id, createdAt: campaignMessages.createdAt });

    const body: ApiResponse<{ id: string; createdAt: Date }> = {
      ok: true,
      data: { id: message.id, createdAt: message.createdAt },
    };
    return NextResponse.json(body, { status: 201 });
  } catch {
    const body: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId },
    };
    return NextResponse.json(body, { status: 500 });
  }
}
