/**
 * GEO Optimizer — Generative Engine Optimization for AI/LLM citation readiness.
 * Ensures content is structured for extraction by ChatGPT, Perplexity, Gemini, etc.
 */

/**
 * Apply GEO optimization patterns to blog HTML.
 * Ensures content is structured for AI extraction and citation.
 */
export function applyGeoOptimization(html: string): string {
  let optimized = html;

  // 1. Ensure H2 sections start with a direct answer sentence
  //    (This is best enforced at the prompt level, but we verify structure here)

  // 2. Add semantic markers for key takeaways
  optimized = optimized.replace(
    /<section class="key-takeaways">/g,
    '<section class="key-takeaways" role="complementary" aria-label="Key Takeaways">',
  );

  // 3. Ensure FAQ section has proper semantic markup
  optimized = optimized.replace(
    /<section class="faq-section">/g,
    '<section class="faq-section" role="complementary" aria-label="Frequently Asked Questions">',
  );

  // 4. Ensure blockquotes are properly attributed
  // (Leave this for the content generation prompts)

  // 5. Ensure tables have proper structure for AI extraction
  optimized = optimized.replace(
    /<table(?![\s>])/g,
    '<table ',
  );

  return optimized;
}

/**
 * Generate the E-E-A-T author byline HTML with schema.org Person microdata.
 * Injected into bodyHtml so search-engine crawlers see structured authorship.
 */
export function generateAuthorByline(): string {
  return `<div class="author-byline" itemscope itemtype="https://schema.org/Person">
<p>By <span itemprop="name">LastDonor Editorial Team</span></p>
<p itemprop="description">The LastDonor.org editorial team creates research-backed content to help donors make informed giving decisions. Every article is reviewed for accuracy and grounded in real campaign data.</p>
<p><a href="/editorial-standards">Read our editorial standards</a></p>
</div>`;
}

/**
 * Build enhanced Article JSON-LD structured data for a blog post.
 */
export function buildArticleJsonLd(params: {
  title: string;
  description: string;
  slug: string;
  coverImageUrl?: string | null;
  publishedAt: string;
  updatedAt?: string;
  wordCount: number;
  category: string;
  keywords: string[];
  faqData?: Array<{ question: string; answer: string }>;
}): object[] {
  const baseUrl = 'https://lastdonor.org';

  const articleSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.title,
    description: params.description,
    image: params.coverImageUrl
      ? {
          '@type': 'ImageObject',
          url: params.coverImageUrl.startsWith('http')
            ? params.coverImageUrl
            : `${baseUrl}${params.coverImageUrl}`,
          width: 1200,
          height: 630,
        }
      : undefined,
    datePublished: params.publishedAt,
    dateModified: params.updatedAt ?? params.publishedAt,
    author: {
      '@type': 'Person',
      name: 'LastDonor Editorial Team',
      url: `${baseUrl}/about`,
      jobTitle: 'Content Team',
      worksFor: {
        '@type': 'Organization',
        name: 'LastDonor.org',
        url: baseUrl,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'LastDonor.org',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${params.slug}`,
    },
    wordCount: params.wordCount,
    articleSection: params.category,
    keywords: params.keywords,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
  };

  const schemas: object[] = [articleSchema];

  // Add BreadcrumbList
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: params.title },
    ],
  });

  // Add FAQPage schema if FAQ data exists
  if (params.faqData && params.faqData.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: params.faqData.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return schemas;
}
