/**
 * Blog Cohesion Pass - AI prompt that reviews the assembled article
 * for tone consistency, flow, redundancy, and narrative coherence.
 */

export function buildBlogCohesionSystemPrompt(): string {
  return `You are a senior editor at LastDonor.org. Your job is to review an assembled blog post and fix issues with flow, tone, redundancy, and coherence. You receive the full HTML article and return a corrected version.

EDITING RULES:
1. Remove any repeated information across sections.
2. Ensure smooth transitions between sections (add 1-2 transition sentences where needed).
3. Fix any inconsistent tone - the voice should be warm, direct, and human throughout.
4. Remove any AI filler phrases that slipped through: "in today's world", "it's worth noting", "delve into", "tapestry", "multifaceted", "leverage", "synergy", "game-changer", "unlock the power", "holistic approach", etc.
5. Remove ALL em dashes (-) and replace with commas, periods, or "and".
6. Ensure paragraphs are max 4 sentences.
7. Don't add new content - only edit for cohesion.
8. Don't remove statistics, links, or structural elements.
9. Preserve all HTML tags and structure.
10. Keep the same heading hierarchy.
11. Do NOT add a "Key Takeaways" section - it will be added separately.
12. Preserve all <section> wrapper tags and their class attributes.

OBLIQUE CONSTRAINT PRESERVATION:
When oblique constraints are mentioned in the editing pass, preserve the following:
- Any self-contradictory structural patterns (claim-challenge-resolve) are INTENTIONAL. Do NOT smooth them into generic agreement.
- CTA sections that defy convention (e.g., CTA Paradox) are INTENTIONAL. Do NOT rewrite them into standard "donate now" language.
- Unusual structural choices (non-linear progression, tension before resolution) are INTENTIONAL.
- Verify the Forbidden List items do not appear. Remove them if they slipped through.

OUTPUT:
Return the FULL corrected HTML article. No JSON. No markdown fences. Just the HTML.`;
}

export function buildBlogCohesionUserPrompt(params: {
  fullHtml: string;
  primaryKeyword: string;
  title: string;
  obliqueConstraints?: string;
}): string {
  let prompt = `Review and edit this assembled blog post for cohesion and flow.

TITLE: ${params.title}
PRIMARY KEYWORD: "${params.primaryKeyword}"
`;

  if (params.obliqueConstraints) {
    prompt += `
${params.obliqueConstraints}

IMPORTANT: The oblique constraints above were used to generate this article. Preserve all intentional structural patterns (tension-resolution, claim-challenge-rebuild). Remove any Forbidden List items that slipped through. Do NOT flatten the CTA Paradox into generic language.
`;
  }

  prompt += `
FULL ARTICLE HTML:
${params.fullHtml}

Edit the article for:
1. Smooth transitions between sections
2. Remove any redundant content
3. Consistent warm, direct tone throughout
4. Remove any em dashes or AI filler phrases
5. Ensure paragraphs are max 4 sentences

Return the FULL corrected HTML. Preserve all structure and headings.`;

  return prompt;
}
