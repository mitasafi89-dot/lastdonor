import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/notifications — List current user's notifications
 * Query params: ?limit=20&unreadOnly=true
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
      { status: 401 },
    );
  }

  const url = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

  const conditions = [eq(notifications.userId, session.user.id)];
  if (unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  const [items, [unreadCount]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false))),
  ]);

  return NextResponse.json({
    ok: true,
    data: { notifications: items, unreadCount: unreadCount.count },
  });
}

/**
 * PATCH /api/v1/notifications — Mark notifications as read
 * Body: { ids: string[] } or { markAllRead: true }
 */
export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
      { status: 401 },
    );
  }

  let body: { ids?: string[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  const userId = session.user.id;

  if (body.markAllRead) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return NextResponse.json({ ok: true, data: { marked: 'all' } });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    // Mark specific notifications as read — only the user's own
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = body.ids.filter((id) => UUID_REGEX.test(id)).slice(0, 100);

    for (const id of validIds) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    }

    return NextResponse.json({ ok: true, data: { marked: validIds.length } });
  }

  return NextResponse.json(
    { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Provide "ids" array or "markAllRead": true', requestId } } satisfies ApiError,
    { status: 400 },
  );
}

/**
 * DELETE /api/v1/notifications — Delete all notifications for current user
 */
export async function DELETE() {
  const requestId = randomUUID();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
      { status: 401 },
    );
  }

  await db
    .delete(notifications)
    .where(eq(notifications.userId, session.user.id));

  return NextResponse.json({ ok: true, data: { cleared: true } });
}
