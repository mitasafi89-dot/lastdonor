import { db } from '../src/db/index';
import { newsItems } from '../src/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

async function main() {
  const items = await db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      source: newsItems.source,
      category: newsItems.category,
      relevanceScore: newsItems.relevanceScore,
      campaignCreated: newsItems.campaignCreated,
      imageUrl: newsItems.imageUrl,
      url: newsItems.url,
    })
    .from(newsItems)
    .where(and(eq(newsItems.campaignCreated, false), gte(newsItems.relevanceScore, 70)))
    .orderBy(desc(newsItems.relevanceScore))
    .limit(10);

  console.log('Publishable news items (score>=70, campaignCreated=false):');
  for (const item of items) {
    console.log(`  [${item.relevanceScore}] ${item.category} | ${item.source} | ${item.title}`);
    console.log(`       ID: ${item.id}`);
    console.log(`       Image: ${item.imageUrl ?? '(none)'}`);
  }
  console.log(`\nTotal: ${items.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
