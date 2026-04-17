import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { withApiHandler } from '@/lib/api-handler';
import { requireAuth, parsePagination } from '@/lib/api-helpers';
import { apiError } from '@/lib/errors';

/**
 * GET /api/v1/notifications - List current user's notifications
 * Query params: ?limit=20&unreadOnly=true
 */
export const GET = withApiHandler(async (request, { requestId, session }) => {
  const auth = requireAuth(session, requestId);
  if ('error' in auth) return auth.error;
  const userId = auth.session.user.id;

  const { limit } = parsePagination(request.nextUrl.searchParams, { defaultLimit: 20, maxLimit: 100 });
  const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true';

  const conditions = [eq(notifications.userId, userId)];
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
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
  ]);

  return NextResponse.json({
    ok: true,
    data: { notifications: items, unreadCount: unreadCount.count },
  });
});

/**
 * PATCH /api/v1/notifications - Mark notifications as read
 * Body: { ids: string[] } or { markAllRead: true }
 */
export const PATCH = withApiHandler(async (request, { requestId, session }) => {
  const auth = requireAuth(session, requestId);
  if ('error' in auth) return auth.error;
  const userId = auth.session.user.id;

  let body: { ids?: string[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', requestId);
  }

  if (body.markAllRead) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return NextResponse.json({ ok: true, data: { marked: 'all' } });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = body.ids.filter((id) => UUID_REGEX.test(id)).slice(0, 100);

    if (validIds.length > 0) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(inArray(notifications.id, validIds), eq(notifications.userId, userId)));
    }

    return NextResponse.json({ ok: true, data: { marked: validIds.length } });
  }

  return apiError('VALIDATION_ERROR', 'Provide "ids" array or "markAllRead": true.', requestId);
});

/**
 * DELETE /api/v1/notifications - Delete all notifications for current user
 */
export const DELETE = withApiHandler(async (_request, { requestId, session }) => {
  const auth = requireAuth(session, requestId);
  if ('error' in auth) return auth.error;

  await db
    .delete(notifications)
    .where(eq(notifications.userId, auth.session.user.id));

  return NextResponse.json({ ok: true, data: { cleared: true } });
});
