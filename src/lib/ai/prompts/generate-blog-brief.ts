/**
 * Generate Blog Brief - AI prompt that creates a comprehensive content brief
 * for a blog post, including outline, target audience, and SEO directives.
 */

export interface ContentBrief {
  title: string;
  metaTitle: string;
  metaDescription: string;
  targetAudience: string;
  searchIntent: string;
  outline: OutlineSection[];
  faqQuestions: string[];
  internalLinkSuggestions: string[];
  toneDirective: string;
  keyTakeaways: string[];
  /** Oblique constraints injected by the oblique engine (optional for backward compat) */
  obliqueConstraints?: string;
}

export interface OutlineSection {
  heading: string;
  headingLevel: 2 | 3;
  keyPoints: string[];
  targetWords: number;
  includeStats: boolean;
}

export function buildBlogBriefSystemPrompt(): string {
  return `You are a senior content strategist for LastDonor.org, a 0% platform-fee crowdfunding site for individuals in crisis. You create detailed blog content briefs that guide article writing. You approach every brief with oblique, first-principles thinking, never defaulting to template patterns.

BRAND VOICE:
- Warm, direct, and human. Never corporate or robotic.
- Write like a trusted friend who happens to know a lot about helping people.
- No em dashes. No AI filler phrases. No "it's worth noting" or "let's dive in."
- Specific and practical. Every tip should be actionable.
- Empathetic without being exploitative. Focus on solutions, not suffering.

SEO/AEO REQUIREMENTS:
- The primary keyword MUST appear in the meta title, H1, first 100 words, and meta description.
- Meta title must be < 60 characters.
- Meta description must be < 155 characters with a clear CTA.
- At least 1 H2 must contain the primary keyword.
- Plan for 5-8 FAQ entries targeting long-tail questions and AI engine citation.
- Plan for "Key Takeaways" section at the end.
- Every FAQ answer must be self-contained and quotable by AI assistants (Perplexity, ChatGPT, Gemini).
- Structure content so AI engines can extract definitive answers, not just summaries.

OBLIQUE BRIEF PRINCIPLES:
When oblique constraints are provided, they OVERRIDE generic patterns:
- The Primal Law defines WHY this content exists. Every section must serve it.
- Inversion Constraints are non-negotiable structural rules. Plan sections around them.
- The Oblique Structural Rule must be reflected in at least 1 section's design.
- The CTA Paradox shapes the "How to Help" section. Do NOT default to "donate now."
- The Forbidden List items must not appear anywhere in the outline or key points.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "title": "The H1 heading (includes primary keyword naturally)",
  "metaTitle": "SEO title < 60 chars (includes primary keyword)",
  "metaDescription": "Meta description < 155 chars with CTA",
  "targetAudience": "Who this article helps",
  "searchIntent": "informational|transactional|commercial",
  "outline": [
    {
      "heading": "Section heading (H2 or H3)",
      "headingLevel": 2,
      "keyPoints": ["Point to cover", "Another point"],
      "targetWords": 350,
      "includeStats": true
    }
  ],
  "faqQuestions": ["Question 1?", "Question 2?"],
  "internalLinkSuggestions": ["/campaigns", "/how-it-works", "/about"],
  "toneDirective": "Brief tone guidance for the writer",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"]
}`;
}

export function buildBlogBriefUserPrompt(params: {
  primaryKeyword: string;
  secondaryKeywords: string[];
  causeCategory: string;
  targetWordCount: number;
  newsHook?: string | null;
  obliqueConstraints?: string;
}): string {
  const { primaryKeyword, secondaryKeywords, causeCategory, targetWordCount, newsHook, obliqueConstraints } = params;

  let prompt = `Create a comprehensive content brief for a blog post.

PRIMARY KEYWORD: "${primaryKeyword}"
SECONDARY KEYWORDS: ${secondaryKeywords.length > 0 ? secondaryKeywords.map(k => `"${k}"`).join(', ') : 'None specified'}
CAUSE CATEGORY: ${causeCategory}
TARGET WORD COUNT: ${targetWordCount} words
`;

  if (newsHook) {
    prompt += `
NEWS HOOK: This post is inspired by recent news: "${newsHook}"
Weave this current event naturally into the content as a timely reference.
`;
  }

  if (obliqueConstraints) {
    prompt += `
${obliqueConstraints}

IMPORTANT: The oblique constraints above are NOT suggestions. They are structural requirements.
- Design your outline sections to satisfy the Inversion Constraints.
- At least 1 section must implement the Oblique Structural Rule.
- The "How to Help" section must embody the CTA Paradox (not a generic donation pitch).
- Nothing in the Forbidden List may appear in headings, key points, or takeaways.
- The Primal Law should be the invisible backbone of every section.
`;
  }

  prompt += `
REQUIREMENTS:
1. Plan 6-8 H2 sections, each 250-400 words
2. The first section must directly answer the primary keyword query
3. Include at least 2 sections with statistics or data
4. Plan a "How to Help" or "What You Can Do" action section
5. Plan a FAQ section with 5-8 questions (targeting PAA/long-tail queries)
6. Plan a "Key Takeaways" concluding section
7. Suggest 3+ internal links to LastDonor.org pages (/campaigns, /how-it-works, /about, /transparency, /blog/*)
8. Every section should provide genuine value - no filler

Return ONLY the JSON object, no markdown code fences.`;

  return prompt;
}
