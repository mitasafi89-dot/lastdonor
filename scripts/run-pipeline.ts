import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { runBlogPipeline } = await import('@/lib/blog/blog-pipeline');

  console.log('=== Starting Blog Pipeline ===');
  console.log('Time:', new Date().toISOString());
  console.log('');

  const result = await runBlogPipeline({
    maxPosts: 1,
    autoPublish: true,
    minPriorityScore: 50,
  });

  console.log('\n=== Pipeline Complete ===');
  console.log(`Topics processed: ${result.topicsProcessed}`);
  console.log(`Posts created: ${result.postsCreated}`);
  console.log(`Posts published: ${result.postsPublished}`);
  console.log(`Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\nDetails:');
  for (const d of result.details) {
    console.log(`  [${d.status}] "${d.topicTitle}" - SEO:${d.seoScore ?? 'n/a'} | ${d.wordCount ?? 'n/a'}w | slug:${d.slug ?? 'n/a'}`);
    if (d.error) console.log(`    Error: ${d.error}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Pipeline failed:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
});
