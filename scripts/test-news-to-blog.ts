import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

/**
 * Test the news-to-blog pipeline end-to-end:
 * 1. Find the highest-scoring recent news item
 * 2. Create a blog topic from it (simulating what topic-discovery does)
 * 3. Run the blog pipeline on that topic
 */
async function main() {
  const { db } = await import('@/db');
  const { newsItems, blogTopicQueue } = await import('@/db/schema');
  const { desc, gte, and, eq, sql } = await import('drizzle-orm');
  const { generateSlug } = await import('@/lib/utils/slug');
  const { runBlogPipeline } = await import('@/lib/blog/blog-pipeline');

  // Step 1: Find best news items from the last 7 days
  console.log('=== Step 1: Finding best recent news items ===\n');
  
  const recentNews = await db
    .select()
    .from(newsItems)
    .where(
      and(
        gte(newsItems.relevanceScore, 70),
        gte(newsItems.fetchedAt, sql`now() - interval '7 days'`),
      ),
    )
    .orderBy(desc(newsItems.relevanceScore))
    .limit(10);

  for (const n of recentNews) {
    console.log(`  [Score: ${n.relevanceScore}] [${n.category}] "${n.title}"`);
    console.log(`    ${n.source} — ${n.url}`);
    console.log('');
  }

  if (recentNews.length === 0) {
    console.log('No high-scoring recent news found. Run the news pipeline first.');
    process.exit(1);
  }

  // Step 2: Pick the best one and create a blog topic
  // Filter for news items that haven't already been used for blog topics
  let selectedNews = null;
  for (const news of recentNews) {
    if (!news.category) continue;
    const existing = await db
      .select({ id: blogTopicQueue.id })
      .from(blogTopicQueue)
      .where(eq(blogTopicQueue.sourceNewsId, news.id))
      .limit(1);
    if (existing.length === 0) {
      selectedNews = news;
      break;
    }
  }

  if (!selectedNews) {
    console.log('All high-scoring news items already have blog topics.');
    process.exit(1);
  }

  console.log(`\n=== Step 2: Creating blog topic from news ===`);
  console.log(`  Selected: "${selectedNews.title}" (${selectedNews.category}, score: ${selectedNews.relevanceScore})`);

  // Create a news-inspired blog topic with a better title than the generic template
  const topicTitle = buildNewsTopicTitle(selectedNews.title, selectedNews.category!);
  const slug = generateSlug(topicTitle);
  const keyword = getCategoryKeyword(selectedNews.category!);

  console.log(`  Topic title: "${topicTitle}"`);
  console.log(`  Keyword: "${keyword}"`);
  console.log(`  Slug: ${slug}`);

  // Check slug uniqueness
  const existingSlug = await db
    .select({ id: blogTopicQueue.id })
    .from(blogTopicQueue)
    .where(eq(blogTopicQueue.slug, slug))
    .limit(1);
  
  if (existingSlug.length > 0) {
    console.log('  Slug already exists, aborting.');
    process.exit(1);
  }

  const [inserted] = await db
    .insert(blogTopicQueue)
    .values({
      title: topicTitle,
      slug,
      primaryKeyword: keyword,
      secondaryKeywords: [],
      searchIntent: 'informational',
      targetWordCount: 2500,
      causeCategory: selectedNews.category!,
      priorityScore: 80, // Higher priority for news-inspired content
      seasonalBoost: 0,
      newsHook: selectedNews.title,
      sourceNewsId: selectedNews.id,
      status: 'pending',
    })
    .returning({ id: blogTopicQueue.id });

  console.log(`  Created topic ID: ${inserted.id}\n`);

  // Step 3: Run the blog pipeline targeting this topic
  console.log('=== Step 3: Running blog pipeline on news topic ===\n');

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

/**
 * Build a search-friendly topic title from a news headline.
 * Instead of the generic "keyword: What Recent Events Mean for Donors",
 * create a title that references the news but targets a search keyword.
 */
function buildNewsTopicTitle(newsTitle: string, category: string): string {
  const categoryTitles: Record<string, string> = {
    memorial: 'How Communities Rally to Help Families After Sudden Loss',
    medical: 'When Medical Emergencies Strike: How to Help Families in Crisis',
    disaster: 'Disaster Relief: How You Can Help Affected Families Right Now',
    military: 'Supporting Military Families When Tragedy Strikes',
    'first-responders': 'Honoring Fallen First Responders: How Communities Step Up',
    'essential-needs': 'Food Insecurity and Financial Crisis: How to Help Families in Need',
    community: 'Community Support After Tragedy: How to Help Victims and Families',
    veterans: 'How to Support Veterans Facing Hardship',
    emergency: 'Emergency Relief: How to Help When Disaster Strikes',
    charity: 'Charitable Giving in Times of Crisis: How to Make Your Donation Count',
  };

  return categoryTitles[category] || `How to Help: What ${newsTitle.split(':')[0]} Means for Communities`;
}

/**
 * Get a primary keyword for a news category.
 */
function getCategoryKeyword(category: string): string {
  const keywords: Record<string, string> = {
    memorial: 'how to help a grieving family',
    medical: 'help with medical bills',
    disaster: 'how to help disaster victims',
    military: 'support military families',
    'first-responders': 'support first responder families',
    'essential-needs': 'help families in financial crisis',
    community: 'help community after tragedy',
    veterans: 'help homeless veterans',
    emergency: 'emergency relief donations',
    charity: 'where to donate in a crisis',
  };

  return keywords[category] || 'how to help families in need';
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
