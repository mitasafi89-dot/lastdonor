/**
 * Content Brief Generator - takes a topic from the queue and generates
 * a structured content brief using AI, enhanced with oblique constraints.
 */

import { callAI } from '@/lib/ai/call-ai';
import {
  buildBlogBriefSystemPrompt,
  buildBlogBriefUserPrompt,
  type ContentBrief,
} from '@/lib/ai/prompts/generate-blog-brief';
import { getLowCompetitionKeywords } from './keyword-bank';
import { generateObliqueBrief, formatObliqueConstraints, type ObliqueBrief } from './oblique-engine';
import { pipelineLog, pipelineWarn } from '@/lib/server-logger';

/**
 * Generate a content brief for a blog topic, with oblique constraints.
 */
export async function generateContentBrief(params: {
  primaryKeyword: string;
  secondaryKeywords: string[];
  causeCategory: string;
  targetWordCount: number;
  newsHook?: string | null;
}): Promise<ContentBrief & { obliqueBrief?: ObliqueBrief }> {
  // If no secondary keywords provided, pull from keyword bank
  let secondaryKeywords = params.secondaryKeywords;
  if (secondaryKeywords.length === 0) {
    const related = getLowCompetitionKeywords(params.causeCategory);
    secondaryKeywords = related
      .filter((k) => k.keyword !== params.primaryKeyword)
      .slice(0, 3)
      .map((k) => k.keyword);
  }

  // Generate oblique constraints first
  let obliqueBrief: ObliqueBrief | undefined;
  let obliqueConstraintsText: string | undefined;
  try {
    obliqueBrief = await generateObliqueBrief({
      primaryKeyword: params.primaryKeyword,
      causeCategory: params.causeCategory,
      newsHook: params.newsHook,
    });
    obliqueConstraintsText = formatObliqueConstraints(obliqueBrief);
    pipelineLog('content-brief', `Oblique brief generated (seed: "${obliqueBrief.seedWord}", law: "${obliqueBrief.primalLaw.slice(0, 60)}...")`);
  } catch (error) {
    // Non-fatal: fall back to standard brief generation if oblique engine fails
    pipelineWarn('content-brief', `Oblique engine failed, using standard brief: ${error instanceof Error ? error.message : String(error)}`);
  }

  const brief = await callAI<ContentBrief>({
    systemPrompt: buildBlogBriefSystemPrompt(),
    userPrompt: buildBlogBriefUserPrompt({
      primaryKeyword: params.primaryKeyword,
      secondaryKeywords,
      causeCategory: params.causeCategory,
      targetWordCount: params.targetWordCount,
      newsHook: params.newsHook,
      obliqueConstraints: obliqueConstraintsText,
    }),
    parseJson: true,
    maxTokens: 8192,
    promptType: 'blog_brief',
  });

  // Validate the brief structure
  if (!brief.title || !brief.outline || brief.outline.length === 0) {
    throw new Error('Generated brief is missing required fields (title or outline)');
  }

  // Attach oblique constraints text to the brief for downstream passes
  if (obliqueConstraintsText) {
    brief.obliqueConstraints = obliqueConstraintsText;
  }

  return { ...brief, obliqueBrief };
}
