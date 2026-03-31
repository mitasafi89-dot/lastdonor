import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const VALID_CATEGORIES = ['campaign_story', 'impact_report', 'news'] as const;
type BlogCategory = (typeof VALID_CATEGORIES)[number];

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const { searchParams } = request.nextUrl;
    const categoryParam = searchParams.get('category');
    const cursor = searchParams.get('cursor');
    const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(
      Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam),
      MAX_LIMIT,
    );

    const categoryFilter = VALID_CATEGORIES.includes(categoryParam as BlogCategory)
      ? eq(blogPosts.category, categoryParam as BlogCategory)
      : null;

    const publishedFilter = eq(blogPosts.published, true);
    const conditions = categoryFilter
      ? and(publishedFilter, categoryFilter)
      : publishedFilter;

    let query = db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        excerpt: blogPosts.excerpt,
        coverImageUrl: blogPosts.coverImageUrl,
        authorName: blogPosts.authorName,
        category: blogPosts.category,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(
        cursor
          ? and(conditions, lt(blogPosts.id, cursor))
          : conditions,
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit + 1);

    const results = await query;
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    const response: ApiResponse<typeof data> = {
      ok: true,
      data,
      meta: {
        cursor: nextCursor,
        hasMore,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/v1/blog]', error);
    const response: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch blog posts',
        requestId,
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
