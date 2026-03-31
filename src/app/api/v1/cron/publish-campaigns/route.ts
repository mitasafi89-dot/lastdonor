import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsItems, campaigns, auditLogs } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { publishCampaignFromNewsItem } from '@/lib/news/campaign-publisher';
import type { StoryPattern } from '@/lib/ai/prompts/story-structures';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find high-scoring news items that haven't created campaigns yet
    // Balance: max 2 military out of 5 slots (40%)
    const MILITARY_SOURCES = ['DVIDS', 'Defense.gov', 'Stars and Stripes', 'Military Times'];

    const allCandidates = await db
      .select()
      .from(newsItems)
      .where(
        and(
          eq(newsItems.campaignCreated, false),
          gte(newsItems.relevanceScore, 70),
        ),
      )
      .orderBy(desc(newsItems.relevanceScore))
      .limit(20);

    const military = allCandidates.filter(
      (i) => MILITARY_SOURCES.includes(i.source) || i.category === 'military',
    );
    const other = allCandidates.filter(
      (i) => !MILITARY_SOURCES.includes(i.source) && i.category !== 'military',
    );

    // Take up to 2 military, fill rest with others, max 5 total
    const qualifiedItems = [
      ...military.slice(0, 2),
      ...other.slice(0, 3),
    ].slice(0, 5);

    let published = 0;
    const errors: string[] = [];

    // Shared state across the batch for anti-repetition
    const recentStoryPatterns: StoryPattern[] = [];

    const recentCampaigns = await db
      .select({ title: campaigns.title })
      .from(campaigns)
      .orderBy(desc(campaigns.publishedAt))
      .limit(15);
    const recentTitles = recentCampaigns.map((c) => c.title);

    for (const item of qualifiedItems) {
      try {
        const result = await publishCampaignFromNewsItem(item.id, {
          recentStoryPatterns,
          recentTitles,
          auditEventType: 'campaign.auto_published',
        });

        if (result.ok) {
          published++;
        } else {
          // ALREADY_CREATED and DUPLICATE_SUBJECT are expected dedup outcomes, not errors
          if (result.error.code !== 'ALREADY_CREATED' && result.error.code !== 'DUPLICATE_SUBJECT') {
            errors.push(`${item.title}: ${result.error.message}`);
          }
        }
      } catch (error) {
        errors.push(`Publish error for "${item.title}": ${String(error)}`);
      }
    }

    await db.insert(auditLogs).values({
      eventType: 'cron.publish_campaigns',
      severity: errors.length > 0 ? 'warning' : 'info',
      details: { qualifiedItems: qualifiedItems.length, published, errors },
    });

    return NextResponse.json({
      ok: true,
      data: { qualifiedItems: qualifiedItems.length, published, errors },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
