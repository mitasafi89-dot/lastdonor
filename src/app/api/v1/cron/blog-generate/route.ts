import { NextRequest, NextResponse } from 'next/server';
import { runBlogPipeline } from '@/lib/blog/blog-pipeline';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily cron: Run the blog generation pipeline.
 * Schedule: 8:00 AM UTC daily
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Allow disabling via env
  if (process.env.BLOG_PIPELINE_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Pipeline disabled' });
  }

  try {
    const maxPosts = parseInt(process.env.BLOG_MAX_POSTS_PER_DAY ?? '1', 10);
    const autoPublish = process.env.BLOG_AUTO_PUBLISH === 'true';
    const minPriority = parseInt(process.env.BLOG_MIN_PRIORITY_SCORE ?? '50', 10);

    const result = await runBlogPipeline({
      maxPosts,
      autoPublish,
      minPriorityScore: minPriority,
    });

    await db.insert(auditLogs).values({
      eventType: 'blog_pipeline_completed',
      targetType: 'system',
      details: {
        source: 'cron',
        topicsProcessed: result.topicsProcessed,
        postsCreated: result.postsCreated,
        postsPublished: result.postsPublished,
        errors: result.errors,
      },
      severity: result.errors.length > 0 ? 'warning' : 'info',
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[blog-generate cron]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
