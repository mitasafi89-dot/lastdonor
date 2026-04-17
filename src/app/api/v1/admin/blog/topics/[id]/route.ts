import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blogTopicQueue, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError, auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import { patchBlogTopicSchema } from '@/lib/validators/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/blog/topics/[id] - update topic (action: generate, reject, boost)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const requestId = randomUUID();

  try {
    await requireRole(['admin', 'editor']);
    const session = await auth();

    const body = await request.json();
    const parsed = patchBlogTopicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }
    const { action, ...updates } = parsed.data;

    // Verify topic exists
    const [topic] = await db
      .select()
      .from(blogTopicQueue)
      .where(eq(blogTopicQueue.id, id))
      .limit(1);

    if (!topic) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Topic not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    switch (action) {
      case 'generate':
        updateData.status = 'generating';
        break;
      case 'reject':
        updateData.status = 'rejected';
        updateData.rejectedReason = updates.reason || 'Rejected by admin';
        break;
      case 'boost':
        updateData.priorityScore = Math.min(topic.priorityScore + 10, 100);
        break;
      default:
        // Direct field updates
        if (updates.title) updateData.title = updates.title;
        if (updates.primaryKeyword) updateData.primaryKeyword = updates.primaryKeyword;
        if (updates.causeCategory !== undefined) updateData.causeCategory = updates.causeCategory;
        if (updates.status) updateData.status = updates.status;
        if (updates.priorityScore !== undefined) updateData.priorityScore = updates.priorityScore;
        break;
    }

    const [updated] = await db
      .update(blogTopicQueue)
      .set(updateData)
      .where(eq(blogTopicQueue.id, id))
      .returning();

    await db.insert(auditLogs).values({
      eventType: `blog_topic_${action || 'updated'}`,
      actorId: session?.user?.id,
      actorRole: session?.user?.role as 'admin' | 'editor' | undefined,
      targetType: 'blog_topic',
      targetId: id,
      details: { action, ...updateData },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[Admin Blog Topic PATCH]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update topic', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/admin/blog/topics/[id] - delete a topic
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);
    const session = await auth();

    const [existing] = await db
      .select({ id: blogTopicQueue.id, title: blogTopicQueue.title })
      .from(blogTopicQueue)
      .where(eq(blogTopicQueue.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Topic not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    await db.delete(blogTopicQueue).where(eq(blogTopicQueue.id, id));

    await db.insert(auditLogs).values({
      eventType: 'blog_topic_deleted',
      actorId: session?.user?.id,
      actorRole: 'admin',
      targetType: 'blog_topic',
      targetId: id,
      details: { title: existing.title },
      severity: 'warning',
    });

    return NextResponse.json({ ok: true, data: null });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[Admin Blog Topic DELETE]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete topic', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
