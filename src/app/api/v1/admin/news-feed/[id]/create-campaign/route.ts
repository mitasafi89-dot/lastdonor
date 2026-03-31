import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { publishCampaignFromNewsItem } from '@/lib/news/campaign-publisher';
import type { ApiError } from '@/types/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await publishCampaignFromNewsItem(id, {
      auditEventType: 'campaign.admin_published',
    });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        ALREADY_CREATED: 409,
        NO_CATEGORY: 422,
        INVALID_ENTITY: 422,
        DUPLICATE_SUBJECT: 409,
        STORY_FAILED: 502,
        INTERNAL_ERROR: 500,
      };

      const error: ApiError = {
        ok: false,
        error: {
          code: result.error.code === 'ALREADY_CREATED' || result.error.code === 'DUPLICATE_SUBJECT'
            ? 'CONFLICT'
            : result.error.code === 'NOT_FOUND'
              ? 'NOT_FOUND'
              : result.error.code === 'NO_CATEGORY' || result.error.code === 'INVALID_ENTITY'
                ? 'VALIDATION_ERROR'
                : 'INTERNAL_ERROR',
          message: result.error.message,
          requestId,
        },
      };

      return NextResponse.json(error, { status: statusMap[result.error.code] ?? 500 });
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
    });
  } catch (error) {
    const apiError: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
    };
    return NextResponse.json(apiError, { status: 500 });
  }
}
