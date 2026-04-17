import { NextRequest, NextResponse } from 'next/server';
import { findStalePosts, queueRefreshTopics } from '@/lib/blog/content-refresh';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly cron: Find stale blog posts and queue them for refresh.
 * Schedule: Sundays at 10:00 AM UTC
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authorization' } }, { status: 401 });
  }

  try {
    const stalePosts = await findStalePosts(5);
    const queued = await queueRefreshTopics(stalePosts);

    await db.insert(auditLogs).values({
      eventType: 'blog_refresh_check',
      targetType: 'system',
      details: {
        source: 'cron',
        stalePostsFound: stalePosts.length,
        refreshTopicsQueued: queued,
        staleTitles: stalePosts.map((p) => p.title),
      },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      stalePostsFound: stalePosts.length,
      refreshTopicsQueued: queued,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[blog-refresh cron]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
