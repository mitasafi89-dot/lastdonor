import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, users, auditLogs } from '@/db/schema';
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm';
import { createUserCampaignSchema } from '@/lib/validators/user-campaign';
import { requireRole } from '@/lib/auth';
import { notifyAdminsCampaignSubmitted, notifyWelcomeCampaigner } from '@/lib/notifications';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { generateSlug } from '@/lib/utils/slug';
import { handleApiError } from '@/lib/errors';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';
import type { CampaignOrganizer } from '@/types';

/**
 * GET /api/v1/user-campaigns - List authenticated user's own campaigns
 */
export async function GET(_request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['donor', 'editor', 'admin']);
    const userId = session.user.id;

    const result = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        heroImageUrl: campaigns.heroImageUrl,
        category: campaigns.category,
        subjectName: campaigns.subjectName,
        goalAmount: campaigns.goalAmount,
        raisedAmount: campaigns.raisedAmount,
        donorCount: campaigns.donorCount,
        verificationStatus: campaigns.verificationStatus,
        createdAt: campaigns.createdAt,
        publishedAt: campaigns.publishedAt,
      })
      .from(campaigns)
      .where(eq(campaigns.creatorId, userId))
      .orderBy(desc(campaigns.createdAt));

    const response: ApiResponse<typeof result> = { ok: true, data: result };
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, requestId, {
      route: '/api/v1/user-campaigns',
      method: 'GET',
    });
  }
}

/**
 * POST /api/v1/user-campaigns - Create a new user campaign
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['donor', 'editor', 'admin']);
    const userId = session.user.id;

    // Rate limit: max 3 non-completed campaigns per user (includes drafts)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(and(
        eq(campaigns.creatorId, userId),
        inArray(campaigns.status, ['draft', 'active', 'last_donor_zone']),
      ));

    if ((countResult?.count ?? 0) >= 3) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'You can have at most 3 active campaigns', requestId } } satisfies ApiError,
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = createUserCampaignSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: firstError.message, field: firstError.path.join('.'), requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Idempotency: reject duplicate submissions with same title within 60 seconds
    const recentWindow = new Date(Date.now() - 60_000);
    const [duplicate] = await db
      .select({ id: campaigns.id, slug: campaigns.slug })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.creatorId, userId),
          eq(campaigns.title, data.title),
          gte(campaigns.createdAt, recentWindow),
        ),
      )
      .limit(1);

    if (duplicate) {
      const response: ApiResponse<typeof duplicate> = { ok: true, data: duplicate };
      return NextResponse.json(response, { status: 200 });
    }

    // Build organizer identity from authenticated user
    const RELATION_LABELS: Record<string, string> = {
      self: 'Self',
      family: 'Family member',
      friend: 'Friend',
      colleague: 'Colleague',
      community_member: 'Community member',
      organization: 'Organization representative',
      other: 'Supporter',
    };
    const organizer: CampaignOrganizer = {
      name: session.user.name ?? 'Campaign Organizer',
      relation: RELATION_LABELS[data.beneficiaryRelation] ?? 'Supporter',
      city: data.subjectHometown,
    };

    // Generate a unique slug
    let slug = generateSlug(data.title);
    if (!slug) slug = 'campaign';
    const [existing] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);

    if (existing) {
      // Append a short random suffix for uniqueness
      slug = `${slug}-${randomUUID().slice(0, 8)}`;
    }

    // Convert plain text story to basic HTML paragraphs
    const storyHtml = sanitizeHtml(
      data.story
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
        .join(''),
    );

    const [campaign] = await db.transaction(async (tx) => {
      const result = await tx
        .insert(campaigns)
        .values({
          title: data.title,
          slug,
          category: data.category,
          heroImageUrl: data.heroImageUrl,
          galleryImages: data.galleryImages ?? [],
          photoCredit: data.photoCredit ?? null,
          youtubeUrl: data.youtubeUrl ?? null,
          subjectName: data.subjectName,
          subjectHometown: data.subjectHometown,
          storyHtml,
          fundUsagePlan: data.fundUsagePlan ?? null,
          goalAmount: data.goalAmount,
          campaignOrganizer: organizer,
          status: 'active',
          simulationFlag: false,
          source: 'manual',
          creatorId: userId,
          beneficiaryRelation: data.beneficiaryRelation,
          verificationStatus: 'unverified',
          publishedAt: new Date(),
        })
        .returning({
          id: campaigns.id,
          slug: campaigns.slug,
          title: campaigns.title,
          status: campaigns.status,
        });

      // Increment user's campaigns_created counter
      await tx
        .update(users)
        .set({ campaignsCreated: sql`${users.campaignsCreated} + 1` })
        .where(eq(users.id, userId));

      return result;
    });

    // Audit log: campaign published (instant-live)
    await db.insert(auditLogs).values({
      eventType: 'campaign.published',
      actorId: userId,
      actorRole: session.user.role as 'donor' | 'editor' | 'admin',
      targetType: 'campaign',
      targetId: campaign.id,
      severity: 'info',
      details: {
        title: data.title,
        category: data.category,
        goalAmount: data.goalAmount,
        slug: campaign.slug,
      },
    });

    // Notify admins (FYI - campaign is live, no review needed)
    notifyAdminsCampaignSubmitted({
      campaignId: campaign.id,
      campaignTitle: data.title,
      creatorName: session.user.name ?? 'Unknown',
      category: data.category,
      goalAmount: data.goalAmount,
    }).catch((err) => console.error('[campaign.published] admin notification error:', err));

    // Send welcome email to campaigner (sharing focus, zero document requests)
    notifyWelcomeCampaigner({
      campaignerId: userId,
      campaignerEmail: session.user.email!,
      campaignerName: session.user.name ?? 'Campaigner',
      campaignTitle: data.title,
      campaignSlug: campaign.slug,
    }).catch((err) => console.error('[campaign.published] welcome notification error:', err));

    const response: ApiResponse<typeof campaign> = { ok: true, data: campaign };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error, requestId, {
      route: '/api/v1/user-campaigns',
      method: 'POST',
    });
  }
}
