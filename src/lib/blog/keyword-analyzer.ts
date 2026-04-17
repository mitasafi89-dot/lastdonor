/**
 * Keyword Analyzer - analyzes keyword density and placement in blog content.
 */

export interface KeywordAnalysis {
  density: number; // percentage
  count: number;
  inFirstParagraph: boolean;
  inHeadings: number;
  totalWords: number;
}

/**
 * Analyze keyword density in HTML content.
 * Returns the density as a percentage.
 */
export function analyzeKeywordDensity(html: string, keyword: string): number {
  const text = htmlToText(html).toLowerCase();
  const keywordLower = keyword.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  if (totalWords === 0) return 0;

  // Count keyword occurrences (as a phrase)
  const regex = new RegExp(escapeRegex(keywordLower), 'gi');
  const matches = text.match(regex);
  const count = matches ? matches.length : 0;

  // Keyword density = (keyword count * words in keyword) / total words * 100
  const keywordWordCount = keywordLower.split(/\s+/).length;
  return Number(((count * keywordWordCount) / totalWords * 100).toFixed(2));
}

/**
 * Full keyword placement analysis for SEO scoring.
 */
export function analyzeKeywordPlacement(html: string, keyword: string): KeywordAnalysis {
  const text = htmlToText(html).toLowerCase();
  const keywordLower = keyword.toLowerCase();

  // Total words
  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Count occurrences
  const regex = new RegExp(escapeRegex(keywordLower), 'gi');
  const matches = text.match(regex);
  const count = matches ? matches.length : 0;

  // Check first paragraph (first 100 words)
  const first100 = words.slice(0, 100).join(' ');
  const inFirstParagraph = first100.includes(keywordLower);

  // Check headings
  const headingRegex = /<h[2-6][^>]*>(.*?)<\/h[2-6]>/gi;
  let headingMatch;
  let inHeadings = 0;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const headingText = headingMatch[1].replace(/<[^>]+>/g, '').toLowerCase();
    if (headingText.includes(keywordLower)) {
      inHeadings++;
    }
  }

  const keywordWordCount = keywordLower.split(/\s+/).length;
  const density = totalWords > 0
    ? Number(((count * keywordWordCount) / totalWords * 100).toFixed(2))
    : 0;

  return {
    density,
    count,
    inFirstParagraph,
    inHeadings,
    totalWords,
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
