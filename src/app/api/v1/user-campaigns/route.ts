import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignMilestones, users, auditLogs } from '@/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { createUserCampaignSchema } from '@/lib/validators/user-campaign';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { notifyAdminsCampaignSubmitted, notifyWelcomeCampaigner } from '@/lib/notifications';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { generateSlug } from '@/lib/utils/slug';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';
import type { CampaignOrganizer } from '@/types';

/**
 * GET /api/v1/user-campaigns — List authenticated user's own campaigns
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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    console.error('[GET /api/v1/user-campaigns]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaigns', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/user-campaigns — Create a new user campaign
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

    // Evidence types are auto-assigned per phase:
    // Phase 1: written update, Phase 2: photo + update, Phase 3: photo + receipts optional
    const PHASE_EVIDENCE_TYPES: Record<number, string> = {
      1: 'document',
      2: 'photo',
      3: 'photo',
    };

    const [campaign] = await db.transaction(async (tx) => {
      const result = await tx
        .insert(campaigns)
        .values({
          title: data.title,
          slug,
          category: data.category,
          heroImageUrl: data.heroImageUrl,
          photoCredit: data.photoCredit ?? null,
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
          milestoneFundRelease: true,
          publishedAt: new Date(),
        })
        .returning({
          id: campaigns.id,
          slug: campaigns.slug,
          title: campaigns.title,
          status: campaigns.status,
        });

      // Insert milestones for milestone-based fund release
      const milestoneRows = data.milestones.map((m, index) => ({
        campaignId: result[0].id,
        phase: index + 1,
        title: m.title,
        description: m.description,
        evidenceType: PHASE_EVIDENCE_TYPES[index + 1],
        fundPercentage: m.fundPercentage,
        fundAmount: Math.round(data.goalAmount * m.fundPercentage / 100),
      }));

      await tx.insert(campaignMilestones).values(milestoneRows);

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

    // Notify admins (FYI — campaign is live, no review needed)
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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[POST /api/v1/user-campaigns]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
