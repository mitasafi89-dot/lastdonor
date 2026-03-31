import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or, desc, asc, sql, ilike, gte } from 'drizzle-orm';
import { createCampaignSchema } from '@/lib/validators/campaign';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';
import type { CampaignCategory } from '@/types';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const VALID_CATEGORIES: CampaignCategory[] = [
  'medical', 'memorial', 'emergency', 'charity', 'education', 'animal',
  'environment', 'business', 'community', 'competition', 'creative', 'event',
  'faith', 'family', 'sports', 'travel', 'volunteer', 'wishes',
  'military', 'veterans', 'first-responders', 'disaster', 'essential-needs',
];

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const { searchParams } = request.nextUrl;
    const categoryParam = searchParams.get('category');
    const sortParam = searchParams.get('sort') ?? 'newest';
    const cursorParam = searchParams.get('cursor');
    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT);

    // Cursor is an offset encoded as string
    const offset = cursorParam ? parseInt(cursorParam, 10) : 0;
    if (isNaN(offset) || offset < 0) {
      const errorBody: ApiError = {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid cursor', requestId },
      };
      return NextResponse.json(errorBody, { status: 400 });
    }

    // Build filters
    const statusParam = searchParams.get('status');
    const statusFilter = statusParam === 'completed'
      ? eq(campaigns.status, 'completed')
      : or(
          eq(campaigns.status, 'active'),
          eq(campaigns.status, 'last_donor_zone'),
        )!;

    const filterParts = [statusFilter];

    if (VALID_CATEGORIES.includes(categoryParam as CampaignCategory)) {
      filterParts.push(eq(campaigns.category, categoryParam as CampaignCategory));
    }

    // Text search across key fields
    const qParam = searchParams.get('q')?.trim().slice(0, 100);
    if (qParam) {
      const pattern = `%${qParam}%`;
      filterParts.push(
        or(
          ilike(campaigns.title, pattern),
          ilike(campaigns.subjectName, pattern),
          ilike(campaigns.location, pattern),
          ilike(campaigns.subjectHometown, pattern),
        )!,
      );
    }

    // Location-specific filter
    const locationParam = searchParams.get('location')?.trim().slice(0, 100);
    if (locationParam) {
      const locPattern = `%${locationParam}%`;
      filterParts.push(
        or(
          ilike(campaigns.location, locPattern),
          ilike(campaigns.subjectHometown, locPattern),
        )!,
      );
    }

    // Close to target: ≥90% funded
    if (searchParams.get('close_to_target') === '1') {
      filterParts.push(
        gte(
          sql`(${campaigns.raisedAmount}::float / NULLIF(${campaigns.goalAmount}, 0))`,
          0.9,
        ),
      );
    }

    const conditions = and(...filterParts)!;

    // Build ordering
    const orderBy = (() => {
      switch (sortParam) {
        case 'most_funded':
          return desc(campaigns.raisedAmount);
        case 'least_funded':
          return asc(campaigns.raisedAmount);
        case 'closing_soon':
          return desc(sql`(${campaigns.raisedAmount}::float / NULLIF(${campaigns.goalAmount}, 0))`);
        default:
          return desc(campaigns.raisedAmount);
      }
    })();

    const results = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        heroImageUrl: campaigns.heroImageUrl,
        category: campaigns.category,
        location: campaigns.location,
        subjectName: campaigns.subjectName,
        subjectHometown: campaigns.subjectHometown,
        campaignOrganizer: campaigns.campaignOrganizer,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        donorCount: campaigns.donorCount,
        publishedAt: campaigns.publishedAt,
      })
      .from(campaigns)
      .where(conditions)
      .orderBy(orderBy)
      .offset(offset)
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? String(offset + limit) : undefined;

    const response: ApiResponse<typeof data> = {
      ok: true,
      data,
      meta: { cursor: nextCursor, hasMore },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/v1/campaigns]', error);
    const body: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch campaigns',
        requestId,
      },
    };
    return NextResponse.json(body, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['editor', 'admin']);

    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

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

    // Check for slug uniqueness
    const [existing] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.slug, data.slug))
      .limit(1);

    if (existing) {
      const errorBody: ApiError = {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'A campaign with this slug already exists',
          field: 'slug',
          requestId,
        },
      };
      return NextResponse.json(errorBody, { status: 409 });
    }

    // Sanitize HTML
    const sanitizedStoryHtml = sanitizeHtml(data.storyHtml);

    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: data.title,
        slug: data.slug,
        category: data.category,
        heroImageUrl: data.heroImageUrl,
        photoCredit: data.photoCredit ?? null,
        subjectName: data.subjectName,
        subjectHometown: data.subjectHometown ?? null,
        storyHtml: sanitizedStoryHtml,
        goalAmount: data.goalAmount,
        impactTiers: data.impactTiers,
        status: data.status,
        publishedAt: data.status === 'active' ? new Date() : null,
      })
      .returning();

    // Audit log would be inserted here (Phase 3 / admin system)

    const response: ApiResponse<typeof campaign> = {
      ok: true,
      data: campaign,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const body: ApiError = {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId },
      };
      return NextResponse.json(body, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      const body: ApiError = {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId },
      };
      return NextResponse.json(body, { status: 403 });
    }
    console.error('[POST /api/v1/campaigns]', error);
    const body: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign', requestId },
    };
    return NextResponse.json(body, { status: 500 });
  }
}
