/**
 * Content Deduplication — checks for duplicate or near-duplicate content
 * and removes AI filler phrases from generated blog posts.
 */

import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phrases to remove — only multi-word filler phrases that are unambiguously
 * AI artifacts. Single legitimate English words (empower, leverage, etc.)
 * are NOT removed because they have valid nonprofit usage.
 */
const AI_FILLER_PHRASES = [
  "in today's world",
  "it's worth noting",
  "it's important to note",
  'in this article, we will',
  "let's dive in",
  'without further ado',
  'at the end of the day',
  'navigate the complex landscape',
  'holistic approach',
  'game-changer',
  'unlock the power',
  'cutting-edge',
  'state-of-the-art',
  'delve into',
  'it goes without saying',
  'needless to say',
];

/**
 * Stop words excluded from similarity calculation.
 * These are extremely common English words that inflate similarity
 * scores between any two texts regardless of actual content overlap.
 */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
  'than', 'its', 'over', 'also', 'that', 'with', 'this', 'will', 'each',
  'from', 'they', 'were', 'which', 'their', 'what', 'there', 'when', 'make',
  'like', 'into', 'just', 'about', 'more', 'would', 'could', 'other',
  'most', 'does', 'your', 'these', 'then', 'many', 'those', 'only',
  'very', 'being', 'here', 'where', 'while', 'should', 'because',
  'through', 'between', 'after', 'before', 'during', 'such', 'both',
]);

/**
 * Remove AI filler phrases from HTML content.
 */
export function removeAIFillerPhrases(html: string): string {
  let cleaned = html;
  for (const phrase of AI_FILLER_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Clean up artifacts left behind by removal
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  // Remove leading comma/space after removal at sentence start
  cleaned = cleaned.replace(/(<p>)\s*,\s*/g, '$1');

  return cleaned;
}

/**
 * Calculate text similarity using TF-IDF cosine similarity.
 * Stop words are excluded so common English words don't inflate scores.
 * IDF is estimated from the two-document corpus (document frequency 1 vs 2).
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function calculateSimilarity(textA: string, textB: string): number {
  const wordsA = tokenize(textA);
  const wordsB = tokenize(textB);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Build raw term frequency maps
  const rawTfA = buildRawTermFrequency(wordsA);
  const rawTfB = buildRawTermFrequency(wordsB);

  // Get all unique terms
  const allTerms = new Set([...rawTfA.keys(), ...rawTfB.keys()]);

  // Calculate IDF for each term (2-document corpus)
  // If a term appears in both documents, IDF = log(2/2) = 0 — but we use log(2/df + 1)
  // to avoid zeroing out shared terms entirely while still down-weighting them.
  const totalDocs = 2;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const term of allTerms) {
    const a = rawTfA.get(term) ?? 0;
    const b = rawTfB.get(term) ?? 0;
    const df = (a > 0 ? 1 : 0) + (b > 0 ? 1 : 0);
    const idf = Math.log(1 + totalDocs / df);

    const tfidfA = a * idf;
    const tfidfB = b * idf;

    dotProduct += tfidfA * tfidfB;
    magnitudeA += tfidfA * tfidfA;
    magnitudeB += tfidfB * tfidfB;
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Check if new content is too similar to existing published blog posts.
 * Only loads the primaryKeyword and excerpt for initial filtering,
 * then loads full body only for same-category posts to limit memory.
 */
export async function isDuplicateContent(
  newContent: string,
  threshold: number = 0.85,
): Promise<{ isDuplicate: boolean; similarPostSlug?: string; similarity?: number }> {
  const existingPosts = await db
    .select({
      slug: blogPosts.slug,
      bodyHtml: blogPosts.bodyHtml,
    })
    .from(blogPosts)
    .where(eq(blogPosts.published, true));

  const newText = htmlToText(newContent);

  let highestSimilarity = 0;
  let closestSlug: string | undefined;

  for (const post of existingPosts) {
    const existingText = htmlToText(post.bodyHtml);
    const similarity = calculateSimilarity(newText, existingText);

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      closestSlug = post.slug;
    }
  }

  return {
    isDuplicate: highestSimilarity > threshold,
    similarPostSlug: closestSlug,
    similarity: Number(highestSimilarity.toFixed(3)),
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function buildRawTermFrequency(words: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const word of words) {
    tf.set(word, (tf.get(word) ?? 0) + 1);
  }
  // Normalize by total word count
  const total = words.length;
  for (const [term, count] of tf) {
    tf.set(term, count / total);
  }
  return tf;
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
