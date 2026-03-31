/**
 * Blog Pipeline Orchestrator — the master pipeline that coordinates
 * all steps: topic selection → brief → content generation → images →
 * quality validation → save/publish.
 */

import { db } from '@/db';
import { blogTopicQueue, blogPosts, blogGenerationLogs, auditLogs } from '@/db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';
import { generateContentBrief } from './content-brief';
import { assembleArticle } from './article-assembler';
import { isDuplicateContent } from './content-dedup';
import { applyGeoOptimization, generateAuthorByline } from './geo-optimizer';
import { calculateSeoScore } from './seo-scorer';
import { generateBlogImage, getFallbackImage } from './image-generator';
import { getInternalLinkSuggestions } from './link-graph';
import { getAuthorityLinks } from './authority-links';
import {
  injectTableOfContents,
  injectSectionImages,
  injectCta,
  normalizeHtmlSpacing,
  calculateReadabilityScore,
  deduplicateKeyTakeaways,
} from './html-formatter';
import { generateSlug } from '@/lib/utils/slug';

export interface PipelineOptions {
  maxPosts?: number;
  autoPublish?: boolean;
  dryRun?: boolean;
  minPriorityScore?: number;
}

export interface PipelineResult {
  topicsProcessed: number;
  postsCreated: number;
  postsPublished: number;
  errors: string[];
  details: PipelinePostResult[];
}

export interface PipelinePostResult {
  topicId: string;
  topicTitle: string;
  postId?: string;
  slug?: string;
  seoScore?: number;
  wordCount?: number;
  status: 'success' | 'rejected_duplicate' | 'rejected_quality' | 'error';
  error?: string;
}

/**
 * Run the full blog generation pipeline.
 */
export async function runBlogPipeline(
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const {
    maxPosts = 1,
    autoPublish = false,
    dryRun = false,
    minPriorityScore = 50,
  } = options;

  const result: PipelineResult = {
    topicsProcessed: 0,
    postsCreated: 0,
    postsPublished: 0,
    errors: [],
    details: [],
  };

  // Step 0: Recover any topics stuck in 'generating' for over 30 minutes
  // This happens when a previous pipeline run crashed or was killed mid-generation.
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
  const stuckTopics = await db
    .update(blogTopicQueue)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(
      and(
        eq(blogTopicQueue.status, 'generating'),
        lt(blogTopicQueue.updatedAt, staleThreshold),
      ),
    )
    .returning({ id: blogTopicQueue.id, title: blogTopicQueue.title });

  if (stuckTopics.length > 0) {
    console.log(`  [pipeline] Recovered ${stuckTopics.length} stuck topic(s): ${stuckTopics.map((t) => t.title).join(', ')}`);
  }

  // Step 1: Select top-priority topics
  const topics = await db
    .select()
    .from(blogTopicQueue)
    .where(eq(blogTopicQueue.status, 'pending'))
    .orderBy(desc(blogTopicQueue.priorityScore))
    .limit(maxPosts);

  if (topics.length === 0) {
    result.errors.push('No pending topics in queue');
    return result;
  }

  for (const topic of topics) {
    if (topic.priorityScore < minPriorityScore) {
      result.errors.push(`Topic "${topic.title}" score ${topic.priorityScore} below minimum ${minPriorityScore}`);
      continue;
    }

    const postResult: PipelinePostResult = {
      topicId: topic.id,
      topicTitle: topic.title,
      status: 'success',
    };

    try {
      // Mark topic as generating
      await db
        .update(blogTopicQueue)
        .set({ status: 'generating', updatedAt: new Date() })
        .where(eq(blogTopicQueue.id, topic.id));

      result.topicsProcessed++;
      const topicStartMs = Date.now();

      // Step 2: Generate Content Brief
      console.log(`  [pipeline] Step 2: Generating content brief for "${topic.primaryKeyword}"...`);
      const briefStartMs = Date.now();
      await logPipelineStep(topic.id, 'brief_started');

      const secondaryKeywords = Array.isArray(topic.secondaryKeywords)
        ? (topic.secondaryKeywords as string[])
        : [];

      const brief = await generateContentBrief({
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords,
        causeCategory: topic.causeCategory ?? 'community',
        targetWordCount: topic.targetWordCount,
        newsHook: topic.newsHook,
      });

      // Store the brief and outline
      await db
        .update(blogTopicQueue)
        .set({
          contentBrief: brief as unknown as Record<string, unknown>,
          outline: brief.outline as unknown as Record<string, unknown>[],
          updatedAt: new Date(),
        })
        .where(eq(blogTopicQueue.id, topic.id));

      await logPipelineStep(topic.id, 'brief_generated');
      console.log(`  [pipeline] Brief generated in ${((Date.now() - briefStartMs) / 1000).toFixed(1)}s`);

      // Step 2b: Resolve internal link suggestions from the link graph (DB-driven)
      const causeCategory = topic.causeCategory ?? 'community';
      const linkSuggestions = await getInternalLinkSuggestions({
        causeCategory,
        primaryKeyword: topic.primaryKeyword,
      });
      const internalLinkSuggestions = linkSuggestions.map((l) => ({
        href: l.href,
        anchorText: l.anchorText,
      }));

      // Step 2c: Get curated external authority links for this category
      const authorityLinks = getAuthorityLinks(causeCategory);
      const externalAuthoritySources = authorityLinks.map((l) => ({
        href: l.url,
        anchorText: l.anchorText,
      }));

      // Step 3: Generate Full Article
      console.log('  [pipeline] Step 3: Generating full article (multi-pass)...');
      const articleStartMs = Date.now();
      await logPipelineStep(topic.id, 'content_started');

      const article = await assembleArticle(brief, {
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords,
        causeCategory,
        internalLinkSuggestions,
        externalAuthoritySources,
      });

      await logPipelineStep(topic.id, 'content_generated');
      console.log(`  [pipeline] Article assembled in ${((Date.now() - articleStartMs) / 1000).toFixed(1)}s (${article.wordCount} words)`);

      // Step 4: Deduplication Check
      console.log('  [pipeline] Step 4: Running deduplication check...');
      const dupCheck = await isDuplicateContent(article.bodyHtml);
      console.log(`  [pipeline] Dedup result: isDuplicate=${dupCheck.isDuplicate}${dupCheck.similarity ? `, similarity=${dupCheck.similarity}` : ''}${dupCheck.similarPostSlug ? `, closestPost=${dupCheck.similarPostSlug}` : ''}`);
      if (dupCheck.isDuplicate) {
        await db
          .update(blogTopicQueue)
          .set({ status: 'stale', updatedAt: new Date() })
          .where(eq(blogTopicQueue.id, topic.id));

        await logPipelineStep(topic.id, 'rejected_duplicate', {
          similarPost: dupCheck.similarPostSlug,
          similarity: dupCheck.similarity,
        });

        postResult.status = 'rejected_duplicate';
        postResult.error = `Too similar to existing post: ${dupCheck.similarPostSlug}`;
        result.details.push(postResult);
        continue;
      }

      // Step 5: Image Generation (hero + section images)
      console.log('  [pipeline] Step 5: Generating images...');
      const imageStartMs = Date.now();
      await logPipelineStep(topic.id, 'images_started');

      let coverImageUrl: string | null = null;
      const heroImage = await generateBlogImage({
        type: 'hero',
        blogTitle: brief.title,
        causeCategory,
        slug: topic.slug,
      });

      if (heroImage) {
        coverImageUrl = heroImage.url;
      } else {
        const fallback = getFallbackImage(causeCategory);
        coverImageUrl = fallback.url;
      }

      // Generate section images (2-3) for inline placement
      const sectionImages: import('./image-generator').BlogImageResult[] = [];
      const h2Headings = (article.bodyHtml.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [])
        .map((tag) => tag.replace(/<[^>]+>/g, '').trim());
      // Pick every 2nd H2 heading starting from index 1 (skip the first)
      const targetSections = h2Headings.filter((_, i) => i > 0 && i % 2 === 0).slice(0, 3);

      for (let si = 0; si < targetSections.length; si++) {
        const heading = targetSections[si]!;
        const sectionImg = await generateBlogImage({
          type: 'section',
          blogTitle: brief.title,
          sectionHeading: heading,
          causeCategory,
          slug: topic.slug,
          sectionIndex: si,
        });
        if (sectionImg) {
          sectionImages.push(sectionImg);
        } else {
          sectionImages.push(getFallbackImage(causeCategory, 'section'));
        }
      }

      await logPipelineStep(topic.id, 'images_generated', {
        heroGenerated: !!heroImage,
        sectionImagesGenerated: sectionImages.length,
      });
      console.log(`  [pipeline] Images generated in ${((Date.now() - imageStartMs) / 1000).toFixed(1)}s`);

      // Step 6: Apply GEO Optimization
      let optimizedHtml = applyGeoOptimization(article.bodyHtml);

      // Step 6b: Post-processing pipeline
      optimizedHtml = deduplicateKeyTakeaways(optimizedHtml);
      optimizedHtml = injectSectionImages(optimizedHtml, sectionImages);
      optimizedHtml = injectCta(optimizedHtml, causeCategory);
      optimizedHtml = injectTableOfContents(optimizedHtml);
      optimizedHtml += generateAuthorByline();
      optimizedHtml = normalizeHtmlSpacing(optimizedHtml);

      // Calculate readability
      const readabilityScore = calculateReadabilityScore(optimizedHtml);

      // Step 7: Quality Validation
      console.log('  [pipeline] Step 7: Validating quality...');
      await logPipelineStep(topic.id, 'validation_started');

      const seoScore = calculateSeoScore({
        html: optimizedHtml,
        metaTitle: brief.metaTitle,
        metaDescription: brief.metaDescription,
        primaryKeyword: topic.primaryKeyword,
        wordCount: article.wordCount,
        targetWordCount: topic.targetWordCount,
        internalLinks: article.internalLinks,
        externalLinks: article.externalLinks,
        coverImageUrl,
      });

      postResult.seoScore = seoScore.total;
      postResult.wordCount = article.wordCount;

      // Reject if SEO score is too low
      if (seoScore.total < 50) {
        await db
          .update(blogTopicQueue)
          .set({ status: 'rejected', rejectedReason: `SEO score too low: ${seoScore.total}`, updatedAt: new Date() })
          .where(eq(blogTopicQueue.id, topic.id));

        await logPipelineStep(topic.id, 'rejected_quality', { seoScore: seoScore.total });

        postResult.status = 'rejected_quality';
        postResult.error = `SEO score ${seoScore.total} below minimum 50`;
        result.details.push(postResult);
        continue;
      }

      await logPipelineStep(topic.id, 'validated');

      // Step 8: Save to database
      if (dryRun) {
        postResult.status = 'success';
        result.details.push(postResult);
        continue;
      }

      await logPipelineStep(topic.id, 'saving');

      const postSlug = generateSlug(brief.title);
      const shouldPublish = autoPublish && seoScore.total >= 70;

      const [newPost] = await db
        .insert(blogPosts)
        .values({
          title: brief.title,
          slug: postSlug,
          bodyHtml: optimizedHtml,
          excerpt: brief.metaDescription,
          coverImageUrl,
          authorName: 'LastDonor Editorial Team',
          authorBio: 'The LastDonor.org editorial team creates research-backed content to help donors make informed giving decisions.',
          category: 'news',
          published: shouldPublish,
          publishedAt: shouldPublish ? new Date() : null,
          source: 'ai_generated',
          metaTitle: brief.metaTitle,
          metaDescription: brief.metaDescription,
          primaryKeyword: topic.primaryKeyword,
          secondaryKeywords,
          seoScore: seoScore.total,
          wordCount: article.wordCount,
          readabilityScore,
          internalLinks: article.internalLinks,
          externalLinks: article.externalLinks,
          faqData: article.faqData,
          topicId: topic.id,
          causeCategory,
        })
        .returning();

      // Update topic with generated post reference
      await db
        .update(blogTopicQueue)
        .set({
          status: shouldPublish ? 'published' : 'generated',
          generatedPostId: newPost.id,
          updatedAt: new Date(),
        })
        .where(eq(blogTopicQueue.id, topic.id));

      // Log to audit
      await db.insert(auditLogs).values({
        eventType: shouldPublish ? 'blog_post_published' : 'blog_post_drafted',
        targetType: 'blog_post',
        targetId: newPost.id,
        details: {
          title: brief.title,
          seoScore: seoScore.total,
          wordCount: article.wordCount,
          source: 'ai_pipeline',
        },
        severity: 'info',
      });

      await logPipelineStep(topic.id, shouldPublish ? 'published' : 'drafted', { postId: newPost.id });

      postResult.postId = newPost.id;
      postResult.slug = postSlug;
      result.postsCreated++;
      if (shouldPublish) result.postsPublished++;
      console.log(`  [pipeline] Topic completed in ${((Date.now() - topicStartMs) / 1000).toFixed(1)}s — SEO:${seoScore.total} | ${article.wordCount}w`);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      postResult.status = 'error';
      postResult.error = errMsg;
      result.errors.push(`Topic "${topic.title}": ${errMsg}`);

      // Reset topic status back to pending on error
      await db
        .update(blogTopicQueue)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(eq(blogTopicQueue.id, topic.id));

      await logPipelineStep(topic.id, 'error', { error: errMsg });
    }

    result.details.push(postResult);
  }

  return result;
}

async function logPipelineStep(
  topicId: string,
  step: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const isError = step === 'error' || step.startsWith('rejected');
    await db.insert(blogGenerationLogs).values({
      topicId,
      step,
      success: !isError,
      errorMessage: isError ? (metadata?.error as string) ?? null : null,
      metadata: metadata ?? {},
    });
  } catch {
    // Non-critical: don't fail the pipeline if logging fails
  }
}
