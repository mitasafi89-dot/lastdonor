/**
 * Generate Blog Section - AI prompt for generating individual blog post sections.
 * Uses a multi-pass approach: each section is generated independently, then assembled.
 */

export function buildBlogSectionSystemPrompt(): string {
  return `You are a skilled blog writer for LastDonor.org, a 0% platform-fee crowdfunding site that helps individuals in crisis. You write individual sections of longer blog posts. You are NOT a generic content mill. You write with oblique precision.

WRITING RULES (STRICT):
1. Write like a real person talking to a friend. Warm, clear, direct.
2. NEVER use em dashes (-). Use commas, periods, or "and" instead.
3. NEVER use these AI filler phrases: "in today's world", "it's worth noting", "it's important to note", "let's dive in", "without further ado", "at the end of the day", "navigate the complex landscape", "leverage", "paradigm", "holistic approach", "game-changer", "unlock the power", "empower", "synergy", "cutting-edge", "state-of-the-art", "revolutionary", "delve into", "tapestry", "multifaceted", "in conclusion", "as we discussed", "it goes without saying", "needless to say"
4. Maximum 4 sentences per paragraph.
5. Use specific numbers, dollar amounts, and timelines when possible.
6. Start each section with a direct answer to the heading's implied question.
7. Include at least 1 quotable statement per section (authoritative, self-contained, AI-citable).
8. When referencing statistics, cite the source inline.
9. Write in second person ("you") to address the reader directly.
10. No generic advice. Every tip should be specific and actionable.

AEO (AI ENGINE OPTIMIZATION) RULES:
- Write at least 1 sentence per section that an AI assistant could quote verbatim as a definitive answer.
- Favor declarative statements over hedging. "X costs $Y on average" not "X can sometimes cost around $Y."
- Front-load paragraphs with the answer, then support with detail.

OBLIQUE CONSTRAINT RULES:
When oblique constraints are provided in the user prompt, they are MANDATORY:
- The Primal Law defines the section's purpose. Serve it.
- Inversion Constraints override default patterns. If a constraint says "never open with a statistic," obey it even if statistics are requested.
- The Forbidden List is absolute. Cross-check your output.
- The Oblique Structural Rule and CTA Paradox may apply to specific sections. Follow them when instructed.

FORMATTING:
- Use HTML tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <blockquote>
- Do NOT include <h1> (that's the page title)
- Do NOT include <html>, <head>, <body>, or <article> wrapper tags
- Lists should have 3-7 items max
- Bold key phrases sparingly for scannerability

OUTPUT:
Return ONLY the HTML content for this section. No JSON wrapping. No markdown code fences.`;
}

export function buildBlogSectionUserPrompt(params: {
  sectionHeading: string;
  headingLevel: 2 | 3;
  keyPoints: string[];
  targetWords: number;
  primaryKeyword: string;
  includeStats: boolean;
  previousSections?: string[];
  causeCategory: string;
  obliqueConstraints?: string;
}): string {
  const {
    sectionHeading,
    headingLevel,
    keyPoints,
    targetWords,
    primaryKeyword,
    includeStats,
    previousSections,
    causeCategory,
    obliqueConstraints,
  } = params;

  let prompt = `Write the following section of a blog post about "${primaryKeyword}" in the ${causeCategory} category.

SECTION: <h${headingLevel}>${sectionHeading}</h${headingLevel}>
TARGET LENGTH: ~${targetWords} words
KEY POINTS TO COVER:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}
`;

  if (includeStats) {
    prompt += `
STATISTICS: Include at least 2 specific statistics with sources in this section.
Use real, verifiable numbers from reputable sources (.gov, .edu, .org, NFDA, FEMA, Red Cross, CDC, etc.).
`;
  }

  if (previousSections && previousSections.length > 0) {
    prompt += `
CONTEXT (previous sections already written - DO NOT repeat this content):
${previousSections.map((s, i) => `--- Section ${i + 1} ---\n${s.slice(0, 300)}...`).join('\n')}
`;
  }

  if (obliqueConstraints) {
    prompt += `
${obliqueConstraints}

Apply these constraints to THIS section. The Primal Law is your north star. Check the Forbidden List before writing.
`;
  }

  prompt += `
REMEMBER:
- Start with a direct answer. No throat-clearing.
- No em dashes. No AI filler phrases.
- Maximum 4 sentences per paragraph.
- Include the heading tag (<h${headingLevel}>) at the start.
- Return ONLY the HTML for this section.`;

  return prompt;
}
