import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts, auditLogs } from '@/db/schema';
import { eq, desc, lt, and, or, ilike } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError, auth } from '@/lib/auth';
import { createBlogPostSchema } from '@/lib/validators/blog';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/admin/blog - list all blog posts (including unpublished)
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin', 'editor']);

    const { searchParams } = request.nextUrl;
    const cursor = searchParams.get('cursor');
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category');
    const status = searchParams.get('status'); // 'published' | 'draft'
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20),
      50,
    );

    const conditions = [];
    if (cursor) conditions.push(lt(blogPosts.id, cursor));
    if (category && ['campaign_story', 'impact_report', 'news'].includes(category)) {
      conditions.push(eq(blogPosts.category, category as 'campaign_story' | 'impact_report' | 'news'));
    }
    if (status === 'published') conditions.push(eq(blogPosts.published, true));
    if (status === 'draft') conditions.push(eq(blogPosts.published, false));
    if (search) {
      conditions.push(
        or(
          ilike(blogPosts.title, `%${search}%`),
          ilike(blogPosts.authorName, `%${search}%`),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        category: blogPosts.category,
        authorName: blogPosts.authorName,
        published: blogPosts.published,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
      })
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return NextResponse.json({
      ok: true,
      data: data.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        publishedAt: p.publishedAt?.toISOString() ?? null,
      })),
      meta: { cursor: nextCursor, hasMore },
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
    console.error('[GET /api/v1/admin/blog]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch posts', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/admin/blog - create a new blog post
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin', 'editor']);
    const session = await auth();

    const body = await request.json();
    const parsed = createBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(', '),
            requestId,
          },
        } satisfies ApiError,
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Sanitize HTML content
    const sanitizedBody = sanitizeHtml(data.bodyHtml);

    // Check slug uniqueness
    const existing = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, data.slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'CONFLICT', message: 'A blog post with this slug already exists', field: 'slug', requestId },
        } satisfies ApiError,
        { status: 409 },
      );
    }

    const [post] = await db
      .insert(blogPosts)
      .values({
        title: data.title,
        slug: data.slug,
        bodyHtml: sanitizedBody,
        excerpt: data.excerpt || null,
        coverImageUrl: data.coverImageUrl || null,
        authorName: data.authorName,
        authorBio: data.authorBio || null,
        category: data.category,
        published: data.published,
        publishedAt: data.published ? new Date() : null,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'blog.created',
      actorId: session?.user?.id ?? null,
      actorRole: (session?.user?.role as 'admin' | 'editor') ?? null,
      targetType: 'blog_post',
      targetId: post.id,
      details: { title: data.title, slug: data.slug, published: data.published },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      data: { ...post, createdAt: post.createdAt.toISOString(), publishedAt: post.publishedAt?.toISOString() ?? null },
    }, { status: 201 });
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
    console.error('[POST /api/v1/admin/blog]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create post', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
