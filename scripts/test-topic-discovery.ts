import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { discoverTopics } = await import('@/lib/blog/topic-discovery');
  const { db } = await import('@/db');
  const { blogTopicQueue } = await import('@/db/schema');
  const { desc, sql } = await import('drizzle-orm');

  console.log('=== Running Topic Discovery ===\n');
  console.log('This will discover topics from keyword bank + seasonal calendar + NEWS ITEMS...\n');

  const newTopicIds = await discoverTopics(5); // max 5 topics

  console.log(`\nDiscovered ${newTopicIds.length} new topics:\n`);

  // Show all topics, focus on news-sourced ones
  for (const id of newTopicIds) {
    const [topic] = await db
      .select()
      .from(blogTopicQueue)
      .where(sql`${blogTopicQueue.id} = ${id}`);
    
    if (topic) {
      const isFromNews = !!topic.sourceNewsId;
      console.log(`  ${isFromNews ? '📰' : '📖'} "${topic.title}"`);
      console.log(`    Keyword: ${topic.primaryKeyword}`);
      console.log(`    Category: ${topic.causeCategory}`);
      console.log(`    From news: ${isFromNews ? `YES — "${topic.newsHook}"` : 'No (keyword bank)'}`);
      console.log(`    Status: ${topic.status} | Priority: ${topic.priorityScore}`);
      console.log('');
    }
  }

  // Show full topic queue state
  const allTopics = await db.select().from(blogTopicQueue).orderBy(desc(blogTopicQueue.createdAt));
  console.log(`\n=== Full Topic Queue (${allTopics.length} total) ===`);
  for (const t of allTopics) {
    const tag = t.sourceNewsId ? '📰' : '📖';
    console.log(`  ${tag} "${t.title}" | ${t.status} | cat: ${t.causeCategory} | keyword: ${t.primaryKeyword}`);
    if (t.newsHook) console.log(`     News hook: "${t.newsHook}"`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
