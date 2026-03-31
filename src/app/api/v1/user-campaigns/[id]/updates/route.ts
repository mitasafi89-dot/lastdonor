import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, campaignUpdates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { ApiResponse, ApiError } from '@/types/api';

const createUpdateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  body: z.string().min(10, 'Update must be at least 10 characters').max(5000),
});

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/user-campaigns/[id]/updates — Post a progress update
 */
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const [campaign] = await db
      .select({ id: campaigns.id, slug: campaigns.slug, creatorId: campaigns.creatorId, status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Campaign not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const role = session.user.role as string;
    const isOwner = campaign.creatorId === session.user.id;
    if (!isOwner && !['editor', 'admin'].includes(role)) {
      throw new ForbiddenError();
    }

    if (campaign.status === 'archived') {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Cannot post updates to an archived campaign', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = createUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: firstError.message, field: firstError.path.join('.'), requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const bodyHtml = sanitizeHtml(
      parsed.data.body
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
        .join(''),
    );

    const [update] = await db
      .insert(campaignUpdates)
      .values({
        campaignId: id,
        title: parsed.data.title,
        bodyHtml,
        updateType: 'progress',
      })
      .returning({ id: campaignUpdates.id, title: campaignUpdates.title, createdAt: campaignUpdates.createdAt });

    revalidatePath(`/campaigns/${campaign.slug}`);

    const response: ApiResponse<typeof update> = { ok: true, data: update };
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
        { ok: false, error: { code: 'FORBIDDEN', message: 'Not your campaign', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error(`[POST /api/v1/user-campaigns/${id}/updates]`, error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to post update', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
