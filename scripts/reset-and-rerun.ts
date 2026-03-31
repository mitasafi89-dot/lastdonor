import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

/**
 * Reset the failed news-to-blog topic and re-run the pipeline.
 */
async function main() {
  const { db } = await import('@/db');
  const { blogTopicQueue } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const { runBlogPipeline } = await import('@/lib/blog/blog-pipeline');

  // Find pending topics that came from news
  const pendingTopics = await db
    .select()
    .from(blogTopicQueue)
    .where(eq(blogTopicQueue.status, 'pending'));

  console.log(`Found ${pendingTopics.length} pending topics:`);
  for (const t of pendingTopics) {
    console.log(`  [${t.id}] "${t.title}" newsHook=${t.newsHook ? 'yes' : 'no'} priority=${t.priorityScore}`);
  }

  const newsTopics = pendingTopics.filter(t => t.newsHook || t.sourceNewsId);
  console.log(`\n${newsTopics.length} are news-sourced. Running pipeline...\n`);

  // Run pipeline
  console.log('\n=== Running blog pipeline ===\n');
  const result = await runBlogPipeline({
    maxPosts: 1,
    autoPublish: true,
    minPriorityScore: 50,
  });

  console.log('\n=== Pipeline Result ===');
  console.log(`Topics processed: ${result.topicsProcessed}`);
  console.log(`Posts created: ${result.postsCreated}`);
  console.log(`Posts published: ${result.postsPublished}`);
  console.log(`Errors: ${result.errors.length}`);

  for (const detail of result.details) {
    console.log(`\n  [${detail.status}] "${detail.topicTitle}"`);
    console.log(`    SEO: ${detail.seoScore ?? 'n/a'} | Words: ${detail.wordCount ?? 'n/a'} | Slug: ${detail.slug ?? 'n/a'}`);
    if (detail.error) console.log(`    Error: ${detail.error}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
