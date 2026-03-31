import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';
import type { BlogPost } from '@/types';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const requestId = randomUUID();
  const { slug } = await params;

  try {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, true)))
      .limit(1);

    if (!post) {
      const response: ApiError = {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Blog post not found',
          requestId,
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<BlogPost> = {
      ok: true,
      data: post,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/v1/blog/[slug]]', error);
    const response: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch blog post',
        requestId,
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
