import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignMessages, auditLogs, notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import type { ApiResponse, ApiError } from '@/types/api';

interface Params {
  params: Promise<{ campaignId: string; messageId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ACTIONS = ['flag', 'hide', 'unhide'] as const;
type ModerationAction = (typeof VALID_ACTIONS)[number];

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin', 'editor']);
    const { campaignId, messageId } = await params;

    if (!UUID_RE.test(campaignId) || !UUID_RE.test(messageId)) {
      const body: ApiError = {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format', requestId },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const rawBody = await request.json();
    const action = rawBody?.action as string;

    if (!VALID_ACTIONS.includes(action as ModerationAction)) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
          requestId,
        },
      };
      return NextResponse.json(body, { status: 400 });
    }

    // Verify message exists and belongs to campaign
    const [existing] = await db
      .select({ id: campaignMessages.id, userId: campaignMessages.userId })
      .from(campaignMessages)
      .where(eq(campaignMessages.id, messageId))
      .limit(1);

    if (!existing) {
      const body: ApiError = {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Message not found', requestId },
      };
      return NextResponse.json(body, { status: 404 });
    }

    // Build update
    const updates: { flagged?: boolean; hidden?: boolean } = {};
    if (action === 'flag') updates.flagged = true;
    if (action === 'hide') {
      updates.hidden = true;
      updates.flagged = true;
    }
    if (action === 'unhide') {
      updates.hidden = false;
      updates.flagged = false;
    }

    await db
      .update(campaignMessages)
      .set(updates)
      .where(eq(campaignMessages.id, messageId));

    // Audit log
    await db.insert(auditLogs).values({
      eventType: `message.${action}`,
      actorId: session.user.id,
      actorRole: session.user.role,
      targetType: 'message',
      targetId: messageId,
      severity: 'info',
      details: { campaignId, action },
    });

    // If hiding, notify the message author (if they have a user account)
    if (action === 'hide' && existing.userId) {
      await db.insert(notifications).values({
        userId: existing.userId,
        type: 'message_flagged',
        title: 'Message Hidden',
        message: 'One of your messages has been hidden by a moderator.',
        link: `/campaigns/${campaignId}`,
      });
    }

    const body: ApiResponse<{ action: string }> = {
      ok: true,
      data: { action },
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    const body: ApiError = {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId },
    };
    return NextResponse.json(body, { status: 500 });
  }
}
