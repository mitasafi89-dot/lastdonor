import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError, auth } from '@/lib/auth';
import { updateBlogPostSchema } from '@/lib/validators/blog';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/blog/[id] — get a single blog post for editing
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    await requireRole(['admin', 'editor']);

    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Blog post not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: { ...post, createdAt: post.createdAt.toISOString(), publishedAt: post.publishedAt?.toISOString() ?? null },
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
    console.error('[GET /api/v1/admin/blog/[id]]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch post', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/admin/blog/[id] — update a blog post
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    await requireRole(['admin', 'editor']);
    const session = await auth();

    const body = await request.json();
    const parsed = updateBlogPostSchema.safeParse(body);

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

    // Verify post exists
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Blog post not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existing.slug) {
      const slugConflict = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.slug, data.slug))
        .limit(1);
      if (slugConflict.length > 0) {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Slug already in use', field: 'slug', requestId } } satisfies ApiError,
          { status: 409 },
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.bodyHtml !== undefined) updateData.bodyHtml = sanitizeHtml(data.bodyHtml);
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt || null;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl || null;
    if (data.authorName !== undefined) updateData.authorName = data.authorName;
    if (data.authorBio !== undefined) updateData.authorBio = data.authorBio || null;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.published !== undefined) {
      updateData.published = data.published;
      // Set publishedAt when first published
      if (data.published && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const [updated] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'blog.updated',
      actorId: session?.user?.id ?? null,
      actorRole: (session?.user?.role as 'admin' | 'editor') ?? null,
      targetType: 'blog_post',
      targetId: id,
      details: { changes: Object.keys(data) },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      data: { ...updated, createdAt: updated.createdAt.toISOString(), publishedAt: updated.publishedAt?.toISOString() ?? null },
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
    console.error('[PATCH /api/v1/admin/blog/[id]]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update post', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/admin/blog/[id] — delete a blog post
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    await requireRole(['admin']);
    const session = await auth();

    const [existing] = await db.select({ id: blogPosts.id, title: blogPosts.title }).from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Blog post not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    await db.delete(blogPosts).where(eq(blogPosts.id, id));

    // Audit log
    await db.insert(auditLogs).values({
      eventType: 'blog.deleted',
      actorId: session?.user?.id ?? null,
      actorRole: 'admin',
      targetType: 'blog_post',
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
    console.error('[DELETE /api/v1/admin/blog/[id]]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete post', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
