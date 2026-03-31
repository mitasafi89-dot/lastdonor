import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, donations } from '@/db/schema';
import { eq, desc, lt, and, gt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

interface Params {
  params: Promise<{ slug: string }>;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { slug } = await params;

  try {
    // Find campaign by slug
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);

    if (!campaign) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Campaign not found`,
          requestId,
        },
      };
      return NextResponse.json(body, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);
    const cursor = searchParams.get('cursor');
    const afterId = searchParams.get('after');

    // Build conditions
    let conditions = eq(donations.campaignId, campaign.id);

    if (cursor) {
      conditions = and(conditions, lt(donations.id, cursor))!;
    }

    if (afterId) {
      // For polling: get donations created after the given ID
      // Since UUIDs aren't ordered, we use the created_at of the reference donation
      const [refDonation] = await db
        .select({ createdAt: donations.createdAt })
        .from(donations)
        .where(eq(donations.id, afterId))
        .limit(1);

      if (refDonation) {
        conditions = and(
          eq(donations.campaignId, campaign.id),
          gt(donations.createdAt, refDonation.createdAt),
        )!;
      }
    }

    const results = await db
      .select({
        id: donations.id,
        donorName: donations.donorName,
        donorLocation: donations.donorLocation,
        amount: donations.amount,
        message: donations.message,
        isAnonymous: donations.isAnonymous,
        createdAt: donations.createdAt,
      })
      .from(donations)
      .where(conditions)
      .orderBy(desc(donations.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? data[data.length - 1].id : undefined;

    // Map anonymous donations
    const mappedData = data.map((d) => ({
      ...d,
      donorName: d.isAnonymous ? 'Anonymous' : d.donorName,
      donorLocation: d.isAnonymous ? null : d.donorLocation,
    }));

    const response: ApiResponse<typeof mappedData> = {
      ok: true,
      data: mappedData,
      meta: { cursor: nextCursor, hasMore },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[GET /api/v1/campaigns/${slug}/donors]`, error);
    const body: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch donors', requestId },
    };
    return NextResponse.json(body, { status: 500 });
  }
}
