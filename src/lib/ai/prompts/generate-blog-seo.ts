/**
 * Blog SEO Hardening Pass — AI prompt that optimizes the article for search engine ranking.
 * Ensures keyword placement, internal linking, and structured data readiness.
 */

export function buildBlogSeoSystemPrompt(): string {
  return `You are an SEO specialist for LastDonor.org. You receive a blog post HTML and optimize it for search engine ranking without changing the tone or meaning.

SEO OPTIMIZATION RULES:
1. Ensure the primary keyword appears:
   - In the first 100 words of the article
   - In at least 1 H2 heading
   - Naturally 3-6 more times throughout (1.0-2.0% density for a 3000-word post)
2. Ensure secondary keywords appear at least once each (naturally placed).
3. Add <strong> tags around the first occurrence of the primary keyword in body text.
4. Ensure all images have descriptive alt text (if any <img> tags exist).
5. Add internal links to LastDonor.org pages where naturally appropriate:
   - Use descriptive anchor text (not "click here")
   - Max 1 internal link per paragraph
   - Target: 3-5 internal links total
   - Link format: <a href="/campaigns">browse verified campaigns</a>
6. Add 2-3 external links to authoritative sources (.gov, .edu, .org) for credibility.
7. Ensure heading hierarchy flows correctly: H2 > H3, no skips.
8. Make sure the article starts with a direct answer (featured snippet optimization).

DO NOT:
- Add em dashes
- Add AI filler phrases
- Change the tone or voice
- Add new sections or substantially rewrite content
- Remove existing content
- Remove or modify any <section> wrapper tags or their class attributes (e.g., class="faq-section", class="key-takeaways")
- Remove or modify any class attributes on structural elements

OUTPUT:
Return the FULL optimized HTML article. No JSON. No markdown fences.`;
}

export interface LinkSuggestionForPrompt {
  href: string;
  anchorText: string;
}

export function buildBlogSeoUserPrompt(params: {
  fullHtml: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  internalLinkSuggestions: LinkSuggestionForPrompt[];
  externalAuthoritySources: LinkSuggestionForPrompt[];
}): string {
  const internalFormatted = params.internalLinkSuggestions.length > 0
    ? params.internalLinkSuggestions
        .map((l) => `- <a href="${l.href}">${l.anchorText}</a>`)
        .join('\n')
    : 'None provided — use /campaigns, /how-it-works, /about, /transparency';

  const externalFormatted = params.externalAuthoritySources.length > 0
    ? params.externalAuthoritySources
        .map((l) => `- <a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.anchorText}</a>`)
        .join('\n')
    : 'Find authoritative .gov/.edu/.org sources relevant to the topic.';

  return `Optimize this blog post for SEO.

PRIMARY KEYWORD: "${params.primaryKeyword}"
SECONDARY KEYWORDS: ${params.secondaryKeywords.map(k => `"${k}"`).join(', ') || 'None'}

INTERNAL LINKS TO USE (insert 3-5 of these with their exact href and anchor text):
${internalFormatted}

EXTERNAL AUTHORITY LINKS TO USE (insert 2-3 of these with their exact href):
${externalFormatted}

FULL ARTICLE HTML:
${params.fullHtml}

Optimize for:
1. Keyword placement (first 100 words, H2s, 1-2% density)
2. Internal links — use the EXACT href and descriptive anchor text provided above. Insert 3-5 total.
3. External authority links — use the EXACT URLs provided above. Insert 2-3 total with target="_blank" rel="noopener noreferrer".
4. Alt text on any images
5. Featured snippet optimization (direct answer at start)

CRITICAL: You MUST insert at least 3 internal links and 2 external links using the exact URLs above. Do NOT omit them.

Return the FULL optimized HTML. Preserve all structure.`;
}
