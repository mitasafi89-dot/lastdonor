import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { desc } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { db } = await import('../src/db/index');
  const { blogPosts } = await import('../src/db/schema');
  const post = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      bodyHtml: blogPosts.bodyHtml,
      coverImageUrl: blogPosts.coverImageUrl,
      seoScore: blogPosts.seoScore,
      wordCount: blogPosts.wordCount,
      primaryKeyword: blogPosts.primaryKeyword,
      secondaryKeywords: blogPosts.secondaryKeywords,
      causeCategory: blogPosts.causeCategory,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.publishedAt))
    .limit(1);

  if (!post[0]) {
    console.log('No published posts found');
    process.exit(0);
  }

  const p = post[0];
  console.log('=== META ===');
  console.log(`Title: ${p.title}`);
  console.log(`Slug: ${p.slug}`);
  console.log(`Cover: ${p.coverImageUrl}`);
  console.log(`SEO: ${p.seoScore}`);
  console.log(`Words: ${p.wordCount}`);
  console.log(`Keyword: ${p.primaryKeyword}`);
  console.log(`Secondary: ${JSON.stringify(p.secondaryKeywords)}`);
  console.log(`Category: ${p.causeCategory}`);
  console.log('\n=== BODY HTML ===');
  console.log(p.bodyHtml);
  process.exit(0);
}

main();
