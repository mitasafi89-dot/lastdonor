/**
 * Blog Refresh Prompt — AI prompt for refreshing outdated blog content.
 * Used by the weekly content refresh cron job.
 */

export function buildBlogRefreshSystemPrompt(): string {
  return `You are a content editor at LastDonor.org. Your job is to refresh an existing blog post with updated information while preserving its structure and voice.

REFRESH RULES:
1. Update any statistics that reference a specific year (add current year data).
2. Add current-year references to the title if appropriate (e.g., "in 2026").
3. Update any outdated costs, averages, or data points with the latest available.
4. Add 1-2 new paragraphs or tips if the topic has evolved since publication.
5. Ensure all links still make sense contextually.
6. Preserve the original tone, structure, and heading hierarchy.
7. Do NOT rewrite sections that don't need updating.
8. Keep the warm, human voice. No em dashes. No AI filler phrases.

OUTPUT:
Return the FULL updated HTML article. No JSON. No markdown fences.`;
}

export function buildBlogRefreshUserPrompt(params: {
  currentHtml: string;
  title: string;
  primaryKeyword: string;
  publishedAt: string;
  refreshReason: string;
}): string {
  return `Refresh this blog post with updated information.

TITLE: ${params.title}
PRIMARY KEYWORD: "${params.primaryKeyword}"
ORIGINALLY PUBLISHED: ${params.publishedAt}
REFRESH REASON: ${params.refreshReason}

CURRENT ARTICLE HTML:
${params.currentHtml}

Update the article with:
1. Current-year statistics and data
2. Any new developments in this topic area
3. Fresh examples or tips
4. Updated year references in content

Return the FULL updated HTML. Keep the same structure and voice.`;
}
