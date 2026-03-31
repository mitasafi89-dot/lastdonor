import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { db } = await import('@/db');
  const { newsItems, blogTopicQueue } = await import('@/db/schema');
  const { desc, eq, gte, sql, and } = await import('drizzle-orm');

  // 1. Count all news items
  const allNews = await db.select().from(newsItems).orderBy(desc(newsItems.fetchedAt));
  console.log(`=== News Items: ${allNews.length} total ===\n`);

  // Show recent ones
  const recent = allNews.slice(0, 15);
  for (const n of recent) {
    console.log(`  [${n.source}] "${n.title}"`);
    console.log(`    Category: ${n.category} | Score: ${n.relevanceScore} | CampaignCreated: ${n.campaignCreated}`);
    console.log(`    Fetched: ${n.fetchedAt} | Published: ${n.publishedAt}`);
    console.log(`    URL: ${n.url}`);
    console.log('');
  }

  // 2. Check for high-scoring recent news (what topic-discovery would use)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const eligibleForBlog = allNews.filter(n => 
    n.relevanceScore && n.relevanceScore >= 60 &&
    n.fetchedAt && n.fetchedAt >= sevenDaysAgo
  );
  console.log(`\n=== News eligible for blog topics (score>=60, last 7 days): ${eligibleForBlog.length} ===`);
  for (const n of eligibleForBlog.slice(0, 10)) {
    console.log(`  [Score: ${n.relevanceScore}] "${n.title}" (${n.category})`);
  }

  // 3. Check topics that came from news
  const newsTopics = await db
    .select()
    .from(blogTopicQueue)
    .where(
      // sourceNewsId is not null
      sql`${blogTopicQueue.sourceNewsId} IS NOT NULL`
    );
  console.log(`\n=== Blog topics from news: ${newsTopics.length} ===`);
  for (const t of newsTopics) {
    console.log(`  "${t.title}" | status: ${t.status} | newsHook: ${t.newsHook}`);
  }

  // 4. Check score distribution
  const scored = allNews.filter(n => n.relevanceScore !== null);
  const scoreBuckets = { '0-30': 0, '31-59': 0, '60-79': 0, '80-100': 0 };
  for (const n of scored) {
    const s = n.relevanceScore!;
    if (s <= 30) scoreBuckets['0-30']++;
    else if (s <= 59) scoreBuckets['31-59']++;
    else if (s <= 79) scoreBuckets['60-79']++;
    else scoreBuckets['80-100']++;
  }
  console.log(`\n=== Score distribution (${scored.length} scored) ===`);
  console.log(`  0-30: ${scoreBuckets['0-30']}`);
  console.log(`  31-59: ${scoreBuckets['31-59']}`);
  console.log(`  60-79: ${scoreBuckets['60-79']}`);
  console.log(`  80-100: ${scoreBuckets['80-100']}`);

  // 5. Check category distribution
  const cats: Record<string, number> = {};
  for (const n of allNews) {
    const c = n.category || 'uncategorized';
    cats[c] = (cats[c] || 0) + 1;
  }
  console.log(`\n=== Category distribution ===`);
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  process.exit(0);
}

main().catch(console.error);
