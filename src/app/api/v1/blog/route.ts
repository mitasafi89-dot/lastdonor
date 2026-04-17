import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { withApiHandler } from '@/lib/api-handler';
import { parsePagination } from '@/lib/api-helpers';

const VALID_CATEGORIES = ['campaign_story', 'impact_report', 'news'] as const;
type BlogCategory = (typeof VALID_CATEGORIES)[number];

export const GET = withApiHandler(async (request) => {
  const { searchParams } = request.nextUrl;
  const categoryParam = searchParams.get('category');
  const cursor = searchParams.get('cursor');
  const { limit } = parsePagination(searchParams, { defaultLimit: 10 });

  const categoryFilter = VALID_CATEGORIES.includes(categoryParam as BlogCategory)
    ? eq(blogPosts.category, categoryParam as BlogCategory)
    : null;

  const publishedFilter = eq(blogPosts.published, true);
  const conditions = categoryFilter
    ? and(publishedFilter, categoryFilter)
    : publishedFilter;

  const results = await db
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

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return NextResponse.json(
    { ok: true, data, meta: { cursor: nextCursor, hasMore } },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}, { skipAuth: true });
