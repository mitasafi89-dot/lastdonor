import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, blogPosts } from '@/db/schema';
import { eq, and, or, desc, ilike } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiResponse, ApiError } from '@/types/api';
import type { CampaignCategory } from '@/types';

/**
 * GET /api/v1/search?q=<query>&category=<category>
 *
 * Unified search across campaigns and blog posts.
 * Returns results grouped by type, capped to prevent overload.
 *
 * Parameters:
 *   q         — search text (min 2 chars, max 100). Searches title,
 *               subjectName, location, subjectHometown for campaigns
 *               and title, excerpt, authorName for blog posts.
 *   category  — optional campaign category filter (e.g. "medical").
 *               When set, only campaigns of that category are returned.
 *
 * Returns:
 *   { ok: true, data: { campaigns: [...], blogPosts: [...] } }
 */

const MAX_RESULTS_PER_TYPE = 6;

const VALID_CATEGORIES: CampaignCategory[] = [
  'medical', 'memorial', 'emergency', 'charity', 'education', 'animal',
  'environment', 'business', 'community', 'competition', 'creative', 'event',
  'faith', 'family', 'sports', 'travel', 'volunteer', 'wishes',
  'military', 'veterans', 'first-responders', 'disaster', 'essential-needs',
];

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const { searchParams } = request.nextUrl;
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    const categoryParam = searchParams.get('category');

    // Validate query length
    if (rawQuery.length < 2) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query must be at least 2 characters',
          requestId,
        },
      };
      return NextResponse.json(body, { status: 400 });
    }

    if (rawQuery.length > 100) {
      const body: ApiError = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query must be at most 100 characters',
          requestId,
        },
      };
      return NextResponse.json(body, { status: 400 });
    }

    // Escape LIKE wildcards in user input to prevent pattern injection
    const escapedQuery = rawQuery.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escapedQuery}%`;

    // ── Campaign search ──
    const campaignStatusFilter = or(
      eq(campaigns.status, 'active'),
      eq(campaigns.status, 'last_donor_zone'),
    )!;

    const campaignTextFilter = or(
      ilike(campaigns.title, pattern),
      ilike(campaigns.subjectName, pattern),
      ilike(campaigns.location, pattern),
      ilike(campaigns.subjectHometown, pattern),
    )!;

    const categoryFilter = VALID_CATEGORIES.includes(categoryParam as CampaignCategory)
      ? eq(campaigns.category, categoryParam as CampaignCategory)
      : null;

    const campaignConditions = categoryFilter
      ? and(campaignStatusFilter, campaignTextFilter, categoryFilter)!
      : and(campaignStatusFilter, campaignTextFilter)!;

    // ── Blog search (build conditions before Promise.all) ──
    const blogTextFilter = or(
      ilike(blogPosts.title, pattern),
      ilike(blogPosts.excerpt, pattern),
      ilike(blogPosts.authorName, pattern),
    )!;

    const blogConditions = and(
      eq(blogPosts.published, true),
      blogTextFilter,
    )!;

    // Run both queries in parallel — they are fully independent
    const [campaignResults, blogResults] = await Promise.all([
      db
        .select({
          id: campaigns.id,
          title: campaigns.title,
          slug: campaigns.slug,
          category: campaigns.category,
          subjectName: campaigns.subjectName,
          heroImageUrl: campaigns.heroImageUrl,
          location: campaigns.location,
          raisedAmount: campaigns.raisedAmount,
          goalAmount: campaigns.goalAmount,
          status: campaigns.status,
        })
        .from(campaigns)
        .where(campaignConditions)
        .orderBy(desc(campaigns.publishedAt))
        .limit(MAX_RESULTS_PER_TYPE),

      db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          authorName: blogPosts.authorName,
          category: blogPosts.category,
          coverImageUrl: blogPosts.coverImageUrl,
        })
        .from(blogPosts)
        .where(blogConditions)
        .orderBy(desc(blogPosts.publishedAt))
        .limit(MAX_RESULTS_PER_TYPE),
    ]);

    const response: ApiResponse<{
      campaigns: typeof campaignResults;
      blogPosts: typeof blogResults;
    }> = {
      ok: true,
      data: {
        campaigns: campaignResults,
        blogPosts: blogResults,
      },
    };

    return NextResponse.json(response, {
      headers: {
        // Public edge cache — search results are not personalized
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[GET /api/v1/search]', error);
    const body: ApiError = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Search failed',
        requestId,
      },
    };
    return NextResponse.json(body, { status: 500 });
  }
}
