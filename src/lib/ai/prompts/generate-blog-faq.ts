/**
 * Blog FAQ Generator — generates FAQ section content and structured data
 * targeting People Also Ask (PAA) queries.
 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildBlogFaqSystemPrompt(): string {
  return `You are a content writer for LastDonor.org. You write FAQ sections for blog posts. Each answer should be direct, specific, and quotable by search engines and AI assistants.

WRITING RULES:
1. Answer in 2-4 sentences. Direct and complete.
2. Include specific numbers, costs, or timelines where relevant.
3. Write in a warm, helpful tone. No corporate speak.
4. No em dashes. No AI filler phrases.
5. Each answer should stand on its own (an AI assistant could quote it verbatim).
6. Reference LastDonor.org naturally when relevant (e.g., "On platforms like LastDonor.org, 100% of your donation goes directly to the person in need").

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
