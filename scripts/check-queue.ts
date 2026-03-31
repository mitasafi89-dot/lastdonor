import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { db } = await import('@/db');
  const { blogTopicQueue, blogPosts } = await import('@/db/schema');
  const { desc } = await import('drizzle-orm');

  const topics = await db
    .select({
      id: blogTopicQueue.id,
      title: blogTopicQueue.title,
      status: blogTopicQueue.status,
      primaryKeyword: blogTopicQueue.primaryKeyword,
      priorityScore: blogTopicQueue.priorityScore,
      causeCategory: blogTopicQueue.causeCategory,
    })
    .from(blogTopicQueue)
    .orderBy(desc(blogTopicQueue.priorityScore));

  console.log(`\n=== Topic Queue (${topics.length} total) ===`);
  for (const t of topics) {
    console.log(`  ${t.status.padEnd(12)} | score:${t.priorityScore} | ${t.causeCategory?.padEnd(16) ?? 'n/a'.padEnd(16)} | ${t.title}`);
  }

  const posts = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      seoScore: blogPosts.seoScore,
      wordCount: blogPosts.wordCount,
      published: blogPosts.published,
      causeCategory: blogPosts.causeCategory,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.createdAt));

  console.log(`\n=== Existing Blog Posts (${posts.length}) ===`);
  for (const p of posts) {
    console.log(`  ${p.published ? 'PUB' : 'DRF'} | SEO:${p.seoScore} | ${p.wordCount}w | ${p.causeCategory?.padEnd(16) ?? 'n/a'.padEnd(16)} | ${p.slug}`);
  }

  process.exit(0);
}

main();
