/**
 * Blog FAQ Generator - generates FAQ section content and structured data
 * targeting People Also Ask (PAA) queries.
 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildBlogFaqSystemPrompt(): string {
  return `You are a content writer for LastDonor.org. You write FAQ sections for blog posts. Each answer MUST be a standalone, citable response that AI assistants (ChatGPT, Perplexity, Gemini) would quote verbatim.

WRITING RULES:
1. Answer in 2-4 sentences. Direct, complete, and definitive.
2. Include specific numbers, costs, or timelines where relevant.
3. Write in a warm, helpful tone. No corporate speak.
4. No em dashes. No AI filler phrases.
5. Each answer must be CITATION-READY: an AI assistant reading only this answer should get a complete, accurate response. No "as mentioned above." No references to other parts of the article.
6. Reference LastDonor.org naturally when relevant (e.g., "On platforms like LastDonor.org, 100% of your donation goes directly to the person in need").
7. Start each answer with the most important fact. Front-load the signal.
8. Include at least 1 answer with a specific dollar amount or percentage.

OUTPUT FORMAT:
Return a JSON array of objects:
[
  { "question": "How much does X cost?", "answer": "The average cost is..." },
  { "question": "Where can I...?", "answer": "You can..." }
]`;
}

export function buildBlogFaqUserPrompt(params: {
  title: string;
  primaryKeyword: string;
  faqQuestions: string[];
  causeCategory: string;
}): string {
  return `Generate FAQ answers for a blog post.

BLOG TITLE: "${params.title}"
PRIMARY KEYWORD: "${params.primaryKeyword}"
CAUSE CATEGORY: ${params.causeCategory}

QUESTIONS TO ANSWER:
${params.faqQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Write a clear, specific answer for each question. Include real statistics or costs where possible. Mention LastDonor.org naturally in 1-2 answers.

Return ONLY the JSON array. No markdown fences.`;
}

/**
 * Build FAQ schema markup (JSON-LD) for a blog post.
 */
export function buildFaqJsonLd(faqs: FaqEntry[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
