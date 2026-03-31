import { NextRequest, NextResponse } from 'next/server';
import { runNewsPipeline } from '@/lib/news/news-pipeline';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for AI processing

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runNewsPipeline('ingest');

    await db.insert(auditLogs).values({
      eventType: 'cron.ingest_news',
      severity: result.errors.length > 0 ? 'warning' : 'info',
      details: result,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    await db.insert(auditLogs).values({
      eventType: 'cron.ingest_news',
      severity: 'error',
      details: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
