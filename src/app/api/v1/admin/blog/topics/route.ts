import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blogTopicQueue, auditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError, auth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/admin/blog/topics — list topic queue
 */
export async function GET() {
  const requestId = randomUUID();

  try {
    await requireRole(['admin', 'editor']);

    const topics = await db
      .select({
        id: blogTopicQueue.id,
        title: blogTopicQueue.title,
        slug: blogTopicQueue.slug,
        primaryKeyword: blogTopicQueue.primaryKeyword,
        causeCategory: blogTopicQueue.causeCategory,
        priorityScore: blogTopicQueue.priorityScore,
        seasonalBoost: blogTopicQueue.seasonalBoost,
        status: blogTopicQueue.status,
        newsHook: blogTopicQueue.newsHook,
        createdAt: blogTopicQueue.createdAt,
        generatedPostId: blogTopicQueue.generatedPostId,
      })
      .from(blogTopicQueue)
      .orderBy(desc(blogTopicQueue.priorityScore))
      .limit(200);

    return NextResponse.json({
      ok: true,
      data: topics.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
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
    console.error('[Admin Blog Topics GET]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load topics', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/admin/blog/topics — add a manual topic
 */
export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin', 'editor']);
    const session = await auth();

    const body = await request.json();
    const { title, primaryKeyword, causeCategory, targetWordCount } = body;

    if (!title || !primaryKeyword) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Title and primary keyword are required', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

    // Check for duplicate slug
    const existing = await db
      .select({ id: blogTopicQueue.id })
      .from(blogTopicQueue)
      .where(eq(blogTopicQueue.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'A topic with this slug already exists', requestId } } satisfies ApiError,
        { status: 409 },
      );
    }

    const [topic] = await db
      .insert(blogTopicQueue)
      .values({
        title,
        slug,
        primaryKeyword,
        causeCategory: causeCategory || null,
        targetWordCount: targetWordCount || 3000,
        priorityScore: 60, // Manual topics get a slight boost
        status: 'pending',
      })
      .returning();

    await db.insert(auditLogs).values({
      eventType: 'blog_topic_created',
      actorId: session?.user?.id,
      actorRole: session?.user?.role as 'admin' | 'editor' | undefined,
      targetType: 'blog_topic',
      targetId: topic.id,
      details: { title, primaryKeyword, source: 'manual' },
      severity: 'info',
    });

    return NextResponse.json({ ok: true, data: topic }, { status: 201 });
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
    console.error('[Admin Blog Topics POST]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create topic', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
