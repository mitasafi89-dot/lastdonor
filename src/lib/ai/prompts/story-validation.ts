import type { StoryPattern } from './story-structures';
import { PATTERN_DEFINITIONS } from './story-structures';

// ── Story Validation ────────────────────────────────────────────────────────

export type StoryValidationResult = {
  valid: boolean;
  html: string;
  wordCount: number;
  issues: StoryIssue[];
};

export type StoryIssue = {
  type: 'word_count_low' | 'word_count_high' | 'missing_section' | 'markdown_leak' | 'missing_source_link' | 'empty_section';
  detail: string;
};

const MIN_ABSOLUTE_WORDS = 50;
const MAX_ABSOLUTE_WORDS = 400;

/** Patterns that indicate markdown leaked into the output */
const MARKDOWN_PATTERNS = [
  /\[([^\]]+)\]\(([^)]+)\)/,    // [text](url) links
  /\*\*[^*]+\*\*/,               // **bold**
  /^#{1,6}\s/m,                   // # headings
  /^```/m,                        // code fences
  /^- /m,                         // markdown list items (at line start)
];

/**
 * Count words in HTML by stripping tags.
 */
function countWords(html: string): number {
  const textOnly = html
    .replace(/<[^>]+>/g, ' ')     // strip tags
    .replace(/&[a-z]+;/gi, ' ')   // strip HTML entities
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim();

  if (textOnly.length === 0) return 0;
  return textOnly.split(' ').length;
}

/**
 * Extract section IDs from the generated HTML.
 */
function extractSectionIds(html: string): string[] {
  const regex = /data-section="([^"]+)"/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * Check if a section has meaningful content (not just empty tags).
 */
function isSectionEmpty(html: string, sectionId: string): boolean {
  const regex = new RegExp(
    `<section[^>]*data-section="${sectionId}"[^>]*>([\\s\\S]*?)</section>`,
    'i',
  );
  const match = regex.exec(html);
  if (!match) return true;

  const content = match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .trim();

  return content.length === 0;
}

/**
 * Validate a generated campaign story against structural and content rules.
 *
 * @param html - The raw HTML output from the AI
 * @param pattern - The story pattern that was requested
 * @param wordRange - The target word range { min, max }
 * @returns Validation result with issues list
 */
export function validateStory(
  html: string,
  pattern: StoryPattern,
  wordRange: { min: number; max: number },
): StoryValidationResult {
  const issues: StoryIssue[] = [];
  const wordCount = countWords(html);
  const definition = PATTERN_DEFINITIONS[pattern];

  // Word count validation (with tolerance band: 90% of min, 120% of max)
  const effectiveMin = Math.max(MIN_ABSOLUTE_WORDS, Math.floor(wordRange.min * 0.9));
  const effectiveMax = Math.min(MAX_ABSOLUTE_WORDS, Math.ceil(wordRange.max * 1.2));

  if (wordCount < effectiveMin) {
    issues.push({
      type: 'word_count_low',
      detail: `Word count ${wordCount} is below minimum ${effectiveMin} (target: ${wordRange.min}–${wordRange.max})`,
    });
  }

  if (wordCount > effectiveMax) {
    issues.push({
      type: 'word_count_high',
      detail: `Word count ${wordCount} exceeds maximum ${effectiveMax} (target: ${wordRange.min}–${wordRange.max})`,
    });
  }

  // Section structure validation
  const foundSections = extractSectionIds(html);
  const expectedSections = definition.sections.map((s) => s.id);

  for (const expected of expectedSections) {
    if (!foundSections.includes(expected)) {
      issues.push({
        type: 'missing_section',
        detail: `Missing required section: "${expected}"`,
      });
    } else if (isSectionEmpty(html, expected)) {
      issues.push({
        type: 'empty_section',
        detail: `Section "${expected}" is empty`,
      });
    }
  }

  // Markdown leak detection
  for (const mdPattern of MARKDOWN_PATTERNS) {
    if (mdPattern.test(html)) {
      issues.push({
        type: 'markdown_leak',
        detail: `Markdown syntax detected: ${mdPattern.source}`,
      });
      break; // One markdown issue is enough to flag
    }
  }

  // Source link presence
  if (!/<a\s+[^>]*href="[^"]+"/i.test(html)) {
    issues.push({
      type: 'missing_source_link',
      detail: 'No source link (<a> tag) found in story',
    });
  }

  // Issue is only non-valid if there are hard-fail issues.
  // Missing source link and markdown leaks are hard fails.
  // Word count issues are soft fails that we retry but accept on second attempt.
  const hardFails = issues.filter(
    (i) => i.type === 'missing_section' || i.type === 'empty_section' || i.type === 'markdown_leak',
  );

  return {
    valid: hardFails.length === 0,
    html,
    wordCount,
    issues,
  };
}

/**
 * Clean common AI output artifacts from generated HTML.
 * Applied before validation.
 */
export function cleanStoryHtml(raw: string): string {
  let html = raw.trim();

  // Strip code fences if the AI wrapped output in ```html ... ```
  html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Strip any leading/trailing JSON or explanation text before first <section>
  const firstSection = html.indexOf('<section');
  if (firstSection > 0) {
    html = html.substring(firstSection);
  }

  // Strip anything after the last </section>
  const lastSection = html.lastIndexOf('</section>');
  if (lastSection !== -1) {
    html = html.substring(0, lastSection + '</section>'.length);
  }

  return html.trim();
}
