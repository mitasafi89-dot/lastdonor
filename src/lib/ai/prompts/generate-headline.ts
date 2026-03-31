import type { CampaignCategory } from '@/types';

export type GenerateHeadlineInput = {
  articleTitle: string;
  articleSummary: string;
  subjectName: string;
  event: string;
  hometown: string;
  category: CampaignCategory;
  recentTitles?: string[];
};

export function buildGenerateHeadlinePrompt(input: GenerateHeadlineInput) {
  const recentBlock =
    input.recentTitles && input.recentTitles.length > 0
      ? `\nRECENTLY USED TITLES (you MUST use a different structural pattern from ALL of these):\n${input.recentTitles.map((t) => `- "${t}"`).join('\n')}\n`
      : '';

  const systemPrompt = `You write emotionally compelling campaign headlines for a nonprofit fundraising platform. Your headline is the single most important element — it must make a stranger stop scrolling and feel something real within one second.

EMOTIONAL PRINCIPLE:
People donate because they FEEL — not because they calculate. Your headline must trigger an immediate emotional response: compassion, urgency, protective instinct, grief, solidarity, or hope. Specificity creates emotion — a name, an age, a place, a loss makes the reader see a real human, not an abstract cause. Vague headlines feel like scams. Specific headlines feel like someone you could know.

STRUCTURAL ARCHETYPES — pick the one that fits the emotional truth of this story. Each headline you write MUST use a DIFFERENT archetype from any recent titles listed below:

1. Name + Emotional Journey: "Officer Chen Faces His Toughest Battle Yet"
2. Location + Collective Grief/Hope: "Downers Grove Grieves for Daniel Figueroa"
3. After + Devastating Loss: "After the Northridge Fire, a Family Has Nothing Left"
4. Possessive Emotional Story: "A Mother's Desperate Fight for Her Children's Future"
5. Community Emotion: "An Entire Town Rallies Behind Their Fallen Hero"
6. Contrast/Irony: "He Served Two Tours Abroad, Now Sgt. Lee Needs Us at Home"
7. Human Cost Statement: "The Martinez Family Lost Everything in 40 Minutes"
8. Tribute with Heart: "Cpl. Davis Gave Everything, Now It's Our Turn"

HARD RULES:
- 30–75 characters (optimized for Google SERP and social card truncation)
- Begin with the person's name, their location, or the specific event — never with a generic verb like "Help", "Support", "Donate", "Give", or "Please"
- NEVER start with "Help" — this is the #1 most common mistake. "Help [name]" is lazy, repetitive, and sounds like begging. Every title starting with "Help" is automatically rejected.
- Include the subject's name when a real person is identified
- Include their location when available (local SEO + specificity)
- The emotion must come from the FACTS of the story — a real loss, a real sacrifice, a real fight — not from adjectives or exclamation marks
- NEVER copy or rephrase the article headline — your title must be ORIGINAL
- No ALL CAPS words, no exclamation marks, no quotation marks around the headline
- No clickbait, no guilt-tripping, no begging — dignity always
- Sound like a headline a journalist would write for the front page of a local newspaper, not a GoFundMe title
- Every headline on the platform must feel like a DIFFERENT story — never repeat patterns
- NEVER include violent verbs like "dies", "killed", "shot", "shoots" — instead imply the loss through emotional framing

BAD EXAMPLES (never write anything like these):
- "Help Paradise firefighter" — starts with "Help", no real name, no emotion
- "Help VA social worker dies following shooting" — starts with "Help", contains "dies", copies article headline
- "Support the family of fallen officer" — starts with "Support", generic, no name
- "Donate to help fire victims" — starts with "Donate", vague, no specificity

Return ONLY the headline text. No quotes, no labels, no explanation.`;

  const userPrompt = `ARTICLE TITLE: ${input.articleTitle}
ARTICLE SUMMARY: ${input.articleSummary}
SUBJECT NAME: ${input.subjectName}
EVENT: ${input.event}
HOMETOWN: ${input.hometown}
CATEGORY: ${input.category}${recentBlock}`;

  return { systemPrompt, userPrompt };
}

// ── Headline validation ────────────────────────────────────────────────────

const MIN_LENGTH = 20;
const MAX_LENGTH = 80;

/** Words that signal the LLM regurgitated the article title. */
const HEADLINE_VERBS = /\b(dies|killed|dead|deadly|shoots|shooting|shot|arrested|charged|sentenced|indicted|pleads|emerges|reported|following|fatality|multi-fatality)\b/i;

/** Banned opening words — the LLM must not start with these. */
const BANNED_PREFIXES = /^(help|donate|please|giving|contribute|support|give)\b/i;

/**
 * Compute word-level overlap ratio between two strings.
 * Returns 0–1 where 1 means all words in `a` appear in `b`.
 */
function wordOverlap(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  if (wordsA.length === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return matches / wordsA.length;
}

export type HeadlineRejection = {
  rejected: true;
  reason: string;
};

export type HeadlineAccepted = {
  rejected: false;
  title: string;
};

/**
 * Validates a generated headline against hard rules.
 * Returns the cleaned title on success, or a rejection reason on failure.
 */
export function validateHeadline(
  headline: string,
  articleTitle: string,
  recentTitles: string[],
): HeadlineAccepted | HeadlineRejection {
  const cleaned = headline.replace(/^["']+|["']+$/g, '').trim();

  if (cleaned.length < MIN_LENGTH || cleaned.length > MAX_LENGTH) {
    return { rejected: true, reason: `length ${cleaned.length} outside ${MIN_LENGTH}-${MAX_LENGTH}` };
  }

  if (BANNED_PREFIXES.test(cleaned)) {
    return { rejected: true, reason: `starts with banned prefix` };
  }

  if (HEADLINE_VERBS.test(cleaned)) {
    return { rejected: true, reason: `contains headline verb (regurgitated article)` };
  }

  // Reject if >50% word overlap with the article title (LLM copied it)
  if (wordOverlap(cleaned, articleTitle) > 0.5) {
    return { rejected: true, reason: `>50% overlap with article title` };
  }

  // Reject if >60% word overlap with any recent title (structural repeat)
  for (const recent of recentTitles) {
    if (wordOverlap(cleaned, recent) > 0.6) {
      return { rejected: true, reason: `>60% overlap with recent title "${recent}"` };
    }
  }

  // Reject ALL CAPS words (>3 chars)
  if (/\b[A-Z]{4,}\b/.test(cleaned)) {
    return { rejected: true, reason: `contains ALL CAPS word` };
  }

  // Reject exclamation marks
  if (cleaned.includes('!')) {
    return { rejected: true, reason: `contains exclamation mark` };
  }

  return { rejected: false, title: cleaned };
}

/**
 * Build a deterministic fallback title from entity data.
 * Uses location + name to produce a unique, emotionally grounded title.
 */
export function buildFallbackTitle(
  name: string,
  hometown: string,
  category: CampaignCategory,
): string {
  if (hometown && hometown !== 'Unknown') {
    return `${hometown} Rallies Behind ${name}`;
  }

  const categoryVerb: Record<string, string> = {
    military: 'Honoring the Sacrifice of',
    veterans: 'Standing with Veteran',
    'first-responders': 'Rallying Behind',
    disaster: 'Rebuilding with',
    medical: 'Standing with',
    memorial: 'Remembering',
    community: 'Coming Together for',
    'essential-needs': 'Lifting Up',
  };

  return `${categoryVerb[category] ?? 'Standing with'} ${name}`;
}
