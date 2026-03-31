/**
 * SEO Scorer — calculates a composite SEO score (0-100) for a blog post.
 * Used by the quality gate and admin dashboard.
 */

import { analyzeKeywordPlacement } from './keyword-analyzer';

export interface SeoScore {
  total: number; // 0-100
  breakdown: SeoCheckResult[];
}

export interface SeoCheckResult {
  check: string;
  passed: boolean;
  points: number; // points earned
  maxPoints: number;
  detail: string;
}

/**
 * Calculate a composite SEO score for a blog post.
 */
export function calculateSeoScore(params: {
  html: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  wordCount: number;
  targetWordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  coverImageUrl?: string | null;
}): SeoScore {
  const checks: SeoCheckResult[] = [];
  const kwAnalysis = analyzeKeywordPlacement(params.html, params.primaryKeyword);
  const keywordLower = params.primaryKeyword.toLowerCase();

  // 1. Keyword in meta title (10 points)
  const kwInTitle = params.metaTitle.toLowerCase().includes(keywordLower);
  checks.push({
    check: 'Keyword in meta title',
    passed: kwInTitle,
    points: kwInTitle ? 10 : 0,
    maxPoints: 10,
    detail: kwInTitle ? 'Primary keyword found in meta title' : 'Primary keyword missing from meta title',
  });

  // 2. Meta title length (5 points)
  const titleLenOk = params.metaTitle.length > 0 && params.metaTitle.length <= 60;
  checks.push({
    check: 'Meta title length',
    passed: titleLenOk,
    points: titleLenOk ? 5 : 0,
    maxPoints: 5,
    detail: `${params.metaTitle.length} chars (target: ≤ 60)`,
  });

  // 3. Keyword in meta description (10 points)
  const kwInDesc = params.metaDescription.toLowerCase().includes(keywordLower);
  checks.push({
    check: 'Keyword in meta description',
    passed: kwInDesc,
    points: kwInDesc ? 10 : 0,
    maxPoints: 10,
    detail: kwInDesc ? 'Primary keyword found in meta description' : 'Primary keyword missing from meta description',
  });

  // 4. Meta description length (5 points)
  const descLenOk = params.metaDescription.length > 0 && params.metaDescription.length <= 155;
  checks.push({
    check: 'Meta description length',
    passed: descLenOk,
    points: descLenOk ? 5 : 0,
    maxPoints: 5,
    detail: `${params.metaDescription.length} chars (target: ≤ 155)`,
  });

  // 5. Keyword in first 100 words (10 points)
  checks.push({
    check: 'Keyword in first 100 words',
    passed: kwAnalysis.inFirstParagraph,
    points: kwAnalysis.inFirstParagraph ? 10 : 0,
    maxPoints: 10,
    detail: kwAnalysis.inFirstParagraph ? 'Found in first 100 words' : 'Not found in first 100 words',
  });

  // 6. Keyword in at least 1 H2 (10 points)
  const kwInH2 = kwAnalysis.inHeadings > 0;
  checks.push({
    check: 'Keyword in H2 heading',
    passed: kwInH2,
    points: kwInH2 ? 10 : 0,
    maxPoints: 10,
    detail: `Found in ${kwAnalysis.inHeadings} heading(s)`,
  });

  // 7. Keyword density 1.0-2.0% (10 points)
  const densityOk = kwAnalysis.density >= 0.8 && kwAnalysis.density <= 2.5;
  checks.push({
    check: 'Keyword density',
    passed: densityOk,
    points: densityOk ? 10 : (kwAnalysis.density > 0 ? 5 : 0),
    maxPoints: 10,
    detail: `${kwAnalysis.density}% (target: 1.0-2.0%)`,
  });

  // 8. Word count (10 points)
  const wordCountRatio = params.wordCount / params.targetWordCount;
  const wordCountOk = wordCountRatio >= 0.8;
  checks.push({
    check: 'Word count',
    passed: wordCountOk,
    points: wordCountOk ? 10 : Math.round(wordCountRatio * 10),
    maxPoints: 10,
    detail: `${params.wordCount} words (target: ${params.targetWordCount})`,
  });

  // 9. Internal links (10 points)
  const hasLinks = params.internalLinks.length >= 3;
  checks.push({
    check: 'Internal links',
    passed: hasLinks,
    points: Math.min(params.internalLinks.length * 3, 10),
    maxPoints: 10,
    detail: `${params.internalLinks.length} internal links (target: ≥ 3)`,
  });

  // 10. External authority links (5 points)
  const hasExternal = params.externalLinks.length >= 2;
  checks.push({
    check: 'External authority links',
    passed: hasExternal,
    points: Math.min(params.externalLinks.length * 2, 5),
    maxPoints: 5,
    detail: `${params.externalLinks.length} external links (target: ≥ 2)`,
  });

  // 11. Cover image (5 points)
  const hasImage = !!params.coverImageUrl;
  checks.push({
    check: 'Cover image',
    passed: hasImage,
    points: hasImage ? 5 : 0,
    maxPoints: 5,
    detail: hasImage ? 'Cover image present' : 'No cover image',
  });

  // 12. Image alt text (5 points)
  const imgRegex = /<img[^>]+>/g;
  const altRegex = /alt="[^"]+"/;
  const images = params.html.match(imgRegex) || [];
  const imagesWithAlt = images.filter((img) => altRegex.test(img));
  // No free points for having zero images — inline images are expected
  const hasInlineImages = images.length > 0;
  const allHaveAlt = images.length > 0 && imagesWithAlt.length === images.length;
  checks.push({
    check: 'Image alt text',
    passed: allHaveAlt,
    points: allHaveAlt ? 5 : (hasInlineImages ? Math.round((imagesWithAlt.length / images.length) * 5) : 0),
    maxPoints: 5,
    detail: images.length === 0
      ? 'No inline images found (expected section images)'
      : `${imagesWithAlt.length}/${images.length} images have alt text`,
  });

  const total = checks.reduce((sum, c) => sum + c.points, 0);

  return { total, breakdown: checks };
}
