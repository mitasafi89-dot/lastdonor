import { NextRequest, NextResponse } from 'next/server';
import { discoverTopics } from '@/lib/blog/topic-discovery';
import { rescoreAllTopics } from '@/lib/blog/topic-scorer';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily cron: Discover new blog topics and rescore existing ones.
 * Schedule: 6:00 AM UTC daily
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Discover new topics from keyword bank + seasonal calendar + news
    const newTopics = await discoverTopics(3);

    // Step 2: Rescore all pending topics with latest seasonal data
    const rescored = await rescoreAllTopics();

    await db.insert(auditLogs).values({
      eventType: 'blog_topics_discovered',
      targetType: 'system',
      details: {
        source: 'cron',
        newTopicsCount: newTopics.length,
        newTopicIds: newTopics,
        rescoredCount: rescored.length,
      },
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      newTopics: newTopics.length,
      rescored: rescored.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[blog-topics cron]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
