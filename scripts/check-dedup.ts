import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { db } = await import('@/db');
  const { blogPosts, blogTopicQueue } = await import('@/db/schema');
  const { desc, eq } = await import('drizzle-orm');

  // Show latest post details
  const posts = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      published: blogPosts.published,
      seoScore: blogPosts.seoScore,
      primaryKeyword: blogPosts.primaryKeyword,
      metaTitle: blogPosts.metaTitle,
      metaDescription: blogPosts.metaDescription,
      coverImageUrl: blogPosts.coverImageUrl,
      bodyHtml: blogPosts.bodyHtml,
      createdAt: blogPosts.createdAt,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.createdAt));

  console.log(`=== All Posts (${posts.length}) ===\n`);
  for (const p of posts) {
    const wordCount = p.bodyHtml?.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length ?? 0;
    console.log(`Title: ${p.title}`);
    console.log(`  Slug: ${p.slug}`);
    console.log(`  Published: ${p.published}`);
    console.log(`  SEO Score: ${p.seoScore}`);
    console.log(`  Primary Keyword: ${p.primaryKeyword}`);
    console.log(`  Meta Title: ${p.metaTitle}`);
    console.log(`  Meta Desc: ${p.metaDescription?.substring(0, 100)}...`);
    console.log(`  Cover Image: ${p.coverImageUrl ? 'YES' : 'NO'}`);
    console.log(`  Word Count: ~${wordCount}`);
    console.log(`  Created: ${p.createdAt}`);
    console.log('');
  }

  // Show topic queue
  const topics = await db.select().from(blogTopicQueue);
  console.log(`=== Topic Queue (${topics.length}) ===`);
  for (const t of topics) {
    console.log(`  "${t.title}" | status: ${t.status} | keyword: ${t.primaryKeyword}`);
  }

  process.exit(0);
}

main().catch(console.error);
