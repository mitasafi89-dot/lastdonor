/**
 * Article Assembler — orchestrates multi-pass content generation.
 * 1. Generates each section independently
 * 2. Runs a cohesion pass to smooth transitions and remove redundancy
 * 3. Runs an SEO hardening pass for keyword optimization
 * 4. Generates FAQ section
 * 5. Assembles the final HTML
 */

import { callAI } from '@/lib/ai/call-ai';
import {
  buildBlogSectionSystemPrompt,
  buildBlogSectionUserPrompt,
} from '@/lib/ai/prompts/generate-blog-section';
import {
  buildBlogCohesionSystemPrompt,
  buildBlogCohesionUserPrompt,
} from '@/lib/ai/prompts/generate-blog-cohesion';
import {
  buildBlogSeoSystemPrompt,
  buildBlogSeoUserPrompt,
  type LinkSuggestionForPrompt,
} from '@/lib/ai/prompts/generate-blog-seo';
import {
  buildBlogFaqSystemPrompt,
  buildBlogFaqUserPrompt,
  type FaqEntry,
} from '@/lib/ai/prompts/generate-blog-faq';
import type { ContentBrief } from '@/lib/ai/prompts/generate-blog-brief';
import { analyzeKeywordDensity } from './keyword-analyzer';
import { removeAIFillerPhrases } from './content-dedup';

export interface AssembledArticle {
  bodyHtml: string;
  wordCount: number;
  faqData: FaqEntry[];
  internalLinks: string[];
  externalLinks: string[];
  keywordDensity: number;
}

/**
 * Assemble a complete blog article from a content brief.
 */
export async function assembleArticle(
  brief: ContentBrief,
  params: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    causeCategory: string;
    internalLinkSuggestions?: LinkSuggestionForPrompt[];
    externalAuthoritySources?: LinkSuggestionForPrompt[];
  },
): Promise<AssembledArticle> {
  // ─── Pass 1: Generate each section independently ──────────────────────
  const sectionHtmlParts: string[] = [];

  for (let sIdx = 0; sIdx < brief.outline.length; sIdx++) {
    const section = brief.outline[sIdx];
    console.log(`  [assembler] Section ${sIdx + 1}/${brief.outline.length}: "${section.heading}"...`);
    const sectionStartMs = Date.now();

    const sectionHtml = await callAI<string>({
      systemPrompt: buildBlogSectionSystemPrompt(),
      userPrompt: buildBlogSectionUserPrompt({
        sectionHeading: section.heading,
        headingLevel: section.headingLevel,
        keyPoints: section.keyPoints,
        targetWords: section.targetWords,
        primaryKeyword: params.primaryKeyword,
        includeStats: section.includeStats,
        previousSections: sectionHtmlParts.slice(-2), // Last 2 sections for context
        causeCategory: params.causeCategory,
      }),
      parseJson: false,
      maxTokens: 8192,
      promptType: 'blog_section',
    });
    console.log(`  [assembler]   → ${((Date.now() - sectionStartMs) / 1000).toFixed(1)}s`);

    sectionHtmlParts.push(sectionHtml);
  }

  // ─── Generate FAQ section ─────────────────────────────────────────────
  console.log('  [assembler] Generating FAQ section...');
  let faqData: FaqEntry[] = [];
  if (brief.faqQuestions && brief.faqQuestions.length > 0) {
    faqData = await callAI<FaqEntry[]>({
      systemPrompt: buildBlogFaqSystemPrompt(),
      userPrompt: buildBlogFaqUserPrompt({
        title: brief.title,
        primaryKeyword: params.primaryKeyword,
        faqQuestions: brief.faqQuestions,
        causeCategory: params.causeCategory,
      }),
      parseJson: true,
      maxTokens: 8192,
      promptType: 'blog_faq',
    });
  }

  // Build FAQ HTML
  const faqHtml = faqData.length > 0
    ? `<section class="faq-section">
<h2>Frequently Asked Questions</h2>
${faqData.map((faq) => `<h3>${escapeHtml(faq.question)}</h3>
<p>${escapeHtml(faq.answer)}</p>`).join('\n')}
</section>`
    : '';

  // Build key takeaways HTML
  const takeawaysHtml = brief.keyTakeaways && brief.keyTakeaways.length > 0
    ? `<section class="key-takeaways">
<h2>Key Takeaways</h2>
<ul>
${brief.keyTakeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join('\n')}
</ul>
</section>`
    : '';

  // ─── Assemble full article ────────────────────────────────────────────
  let fullHtml = [
    ...sectionHtmlParts,
    faqHtml,
    takeawaysHtml,
  ].filter(Boolean).join('\n\n');

  // ─── Pass 2: Cohesion pass ────────────────────────────────────────────
  console.log('  [assembler] Running cohesion pass...');
  fullHtml = await callAI<string>({
    systemPrompt: buildBlogCohesionSystemPrompt(),
    userPrompt: buildBlogCohesionUserPrompt({
      fullHtml,
      primaryKeyword: params.primaryKeyword,
      title: brief.title,
    }),
    parseJson: false,
    maxTokens: 16384,
    promptType: 'blog_cohesion',
  });

  // ─── Pass 3: SEO hardening ───────────────────────────────────────────
  console.log('  [assembler] Running SEO hardening pass...');
  fullHtml = await callAI<string>({
    systemPrompt: buildBlogSeoSystemPrompt(),
    userPrompt: buildBlogSeoUserPrompt({
      fullHtml,
      primaryKeyword: params.primaryKeyword,
      secondaryKeywords: params.secondaryKeywords,
      internalLinkSuggestions: params.internalLinkSuggestions ?? brief.internalLinkSuggestions.map((href) => ({ href, anchorText: href })),
      externalAuthoritySources: params.externalAuthoritySources ?? [],
    }),
    parseJson: false,
    maxTokens: 16384,
    promptType: 'blog_seo',
  });

  // ─── Post-processing ─────────────────────────────────────────────────

  // Remove any remaining AI filler phrases
  fullHtml = removeAIFillerPhrases(fullHtml);

  // Remove em dashes
  fullHtml = fullHtml.replace(/—/g, ',');

  // Analyze keyword density
  const density = analyzeKeywordDensity(fullHtml, params.primaryKeyword);

  // Extract links from the HTML
  const internalLinks = extractLinks(fullHtml, true);
  const externalLinks = extractLinks(fullHtml, false);

  // Count words
  const wordCount = countWords(fullHtml);

  return {
    bodyHtml: fullHtml,
    wordCount,
    faqData,
    internalLinks,
    externalLinks,
    keywordDensity: density,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(Boolean).length;
}

function extractLinks(html: string, internal: boolean): string[] {
  const linkRegex = /href="([^"]+)"/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const isInternal = href.startsWith('/') || href.includes('lastdonor.org');
    if (internal === isInternal) {
      links.push(href);
    }
  }

  return [...new Set(links)];
}
