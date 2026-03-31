/**
 * Content Brief Generator — takes a topic from the queue and generates
 * a structured content brief using AI.
 */

import { callAI } from '@/lib/ai/call-ai';
import {
  buildBlogBriefSystemPrompt,
  buildBlogBriefUserPrompt,
  type ContentBrief,
} from '@/lib/ai/prompts/generate-blog-brief';
import { getLowCompetitionKeywords } from './keyword-bank';

/**
 * Generate a content brief for a blog topic.
 */
export async function generateContentBrief(params: {
  primaryKeyword: string;
  secondaryKeywords: string[];
  causeCategory: string;
  targetWordCount: number;
  newsHook?: string | null;
}): Promise<ContentBrief> {
  // If no secondary keywords provided, pull from keyword bank
  let secondaryKeywords = params.secondaryKeywords;
  if (secondaryKeywords.length === 0) {
    const related = getLowCompetitionKeywords(params.causeCategory);
    secondaryKeywords = related
      .filter((k) => k.keyword !== params.primaryKeyword)
      .slice(0, 3)
      .map((k) => k.keyword);
  }

  const brief = await callAI<ContentBrief>({
    systemPrompt: buildBlogBriefSystemPrompt(),
    userPrompt: buildBlogBriefUserPrompt({
      primaryKeyword: params.primaryKeyword,
      secondaryKeywords,
      causeCategory: params.causeCategory,
      targetWordCount: params.targetWordCount,
      newsHook: params.newsHook,
    }),
    parseJson: true,
    maxTokens: 8192,
    promptType: 'blog_brief',
  });

  // Validate the brief structure
  if (!brief.title || !brief.outline || brief.outline.length === 0) {
    throw new Error('Generated brief is missing required fields (title or outline)');
  }

  return brief;
}
