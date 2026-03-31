import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, donations, campaignUpdates } from '@/db/schema';
import { publicCampaignSelect } from '@/db/public-select';
import { eq, and, or, desc } from 'drizzle-orm';
import { updateCampaignSchema } from '@/lib/validators/campaign';
import { requireRole, auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { slug } = await params;

  try {
    const [campaign] = await db
      .select(publicCampaignSelect)
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
          message: `Campaign with slug "${slug}" not found`,
          requestId,
        },
      };
      return NextResponse.json(body, { status: 404 });
    }

    // Fetch recent donors (last 10)
    const recentDonors = await db
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
      .where(eq(donations.campaignId, campaign.id))
      .orderBy(desc(donations.createdAt))
      .limit(10);

    // Fetch updates
    const updates = await db
      .select({
        id: campaignUpdates.id,
        title: campaignUpdates.title,
        bodyHtml: campaignUpdates.bodyHtml,
        imageUrl: campaignUpdates.imageUrl,
        createdAt: campaignUpdates.createdAt,
      })
      .from(campaignUpdates)
      .where(eq(campaignUpdates.campaignId, campaign.id))
      .orderBy(desc(campaignUpdates.createdAt));

    // Map anonymous donors
    const mappedDonors = recentDonors.map((d) => ({
      ...d,
      donorName: d.isAnonymous ? 'Anonymous' : d.donorName,
      donorLocation: d.isAnonymous ? null : d.donorLocation,
    }));

    const response: ApiResponse = {
      ok: true,
      data: {
        ...campaign,
        recentDonors: mappedDonors,
        updates,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[GET /api/v1/campaigns/${slug}]`, error);
    const body: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaign', requestId },
    };
    return NextResponse.json(body, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { slug: idOrSlug } = await params;

  try {
    // Allow editors/admins, OR the campaign's own creator
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const body = await request.json();
    const parsed = updateCampaignSchema.safeParse(body);

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

    // Look up by UUID or slug
    const condition = UUID_REGEX.test(idOrSlug)
      ? eq(campaigns.id, idOrSlug)
      : eq(campaigns.slug, idOrSlug);

    const [existing] = await db
      .select({ id: campaigns.id, slug: campaigns.slug, creatorId: campaigns.creatorId })
      .from(campaigns)
      .where(condition)
      .limit(1);

    if (!existing) {
      const errBody: ApiError = {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId },
      };
      return NextResponse.json(errBody, { status: 404 });
    }

    // Authorization: must be editor/admin OR the campaign's creator
    const role = session.user.role as string;
    const isOwner = existing.creatorId === session.user.id;
    if (!['editor', 'admin'].includes(role) && !isOwner) {
      throw new ForbiddenError();
    }

    const data = parsed.data;

    // Campaign owners can only update a subset of fields
    if (isOwner && !['editor', 'admin'].includes(role)) {
      const ownerAllowed = ['title', 'heroImageUrl', 'photoCredit', 'subjectName', 'subjectHometown', 'storyHtml', 'impactTiers'] as const;
      const disallowed = Object.keys(data).filter((k) => !(ownerAllowed as readonly string[]).includes(k));
      if (disallowed.length > 0) {
        const errorBody: ApiError = {
          ok: false,
          error: { code: 'FORBIDDEN', message: `Campaign owners cannot update: ${disallowed.join(', ')}`, requestId },
        };
        return NextResponse.json(errorBody, { status: 403 });
      }
    }

    // If slug changed, check uniqueness
    if (data.slug && data.slug !== existing.slug) {
      const [conflict] = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.slug, data.slug))
        .limit(1);

      if (conflict) {
        const errorBody: ApiError = {
          ok: false,
          error: { code: 'CONFLICT', message: 'Slug already in use', field: 'slug', requestId },
        };
        return NextResponse.json(errorBody, { status: 409 });
      }
    }

    // Build update values
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };

    if (data.title !== undefined) updateValues.title = data.title;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.category !== undefined) updateValues.category = data.category;
    if (data.heroImageUrl !== undefined) updateValues.heroImageUrl = data.heroImageUrl;
    if (data.photoCredit !== undefined) updateValues.photoCredit = data.photoCredit;
    if (data.subjectName !== undefined) updateValues.subjectName = data.subjectName;
    if (data.subjectHometown !== undefined) updateValues.subjectHometown = data.subjectHometown;
    if (data.storyHtml !== undefined) updateValues.storyHtml = sanitizeHtml(data.storyHtml);
    if (data.goalAmount !== undefined) updateValues.goalAmount = data.goalAmount;
    if (data.impactTiers !== undefined) updateValues.impactTiers = data.impactTiers;
    if (data.status !== undefined) {
      updateValues.status = data.status;
      if (data.status === 'active') {
        updateValues.publishedAt = new Date();
      }
    }

    const [updated] = await db
      .update(campaigns)
      .set(updateValues)
      .where(eq(campaigns.id, existing.id))
      .returning();

    // ISR revalidation
    revalidatePath(`/campaigns/${updated.slug}`);
    revalidatePath('/campaigns');

    const response: ApiResponse<typeof updated> = { ok: true, data: updated };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const errBody: ApiError = {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId },
      };
      return NextResponse.json(errBody, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      const errBody: ApiError = {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId },
      };
      return NextResponse.json(errBody, { status: 403 });
    }
    console.error(`[PUT /api/v1/campaigns/${idOrSlug}]`, error);
    const errBody: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update campaign', requestId },
    };
    return NextResponse.json(errBody, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { slug: idOrSlug } = await params;

  try {
    await requireRole(['admin']);

    // Look up by UUID or slug
    const condition = UUID_REGEX.test(idOrSlug)
      ? eq(campaigns.id, idOrSlug)
      : eq(campaigns.slug, idOrSlug);

    const [existing] = await db
      .select({ id: campaigns.id, status: campaigns.status, slug: campaigns.slug })
      .from(campaigns)
      .where(condition)
      .limit(1);

    if (!existing) {
      const errBody: ApiError = {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId },
      };
      return NextResponse.json(errBody, { status: 404 });
    }

    // Can only soft-delete draft or completed campaigns
    if (!['draft', 'completed'].includes(existing.status)) {
      const errBody: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Can only archive campaigns in draft or completed status',
          requestId,
        },
      };
      return NextResponse.json(errBody, { status: 400 });
    }

    await db
      .update(campaigns)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(campaigns.id, existing.id));

    // ISR revalidation
    revalidatePath(`/campaigns/${existing.slug}`);
    revalidatePath('/campaigns');

    return NextResponse.json({ ok: true, data: null });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const errBody: ApiError = {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId },
      };
      return NextResponse.json(errBody, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      const errBody: ApiError = {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId },
      };
      return NextResponse.json(errBody, { status: 403 });
    }
    console.error(`[DELETE /api/v1/campaigns/${idOrSlug}]`, error);
    const errBody: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete campaign', requestId },
    };
    return NextResponse.json(errBody, { status: 500 });
  }
}
