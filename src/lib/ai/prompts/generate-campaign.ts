import type { ExtractedEntity } from './extract-entities';
import type { CampaignCategory } from '@/types';
import {
  type StoryPattern,
  type ContextRichness,
  type WordRange,
  scoreContextRichness,
  getWordRange,
  selectStoryPattern,
  PATTERN_DEFINITIONS,
} from './story-structures';

export type GenerateCampaignInput = ExtractedEntity;

export type GenerateCampaignOutput = {
  title: string;
  storyHtml: string;
  impactTiers: { amount: number; label: string }[];
};

const DEFAULT_IMPACT_TIERS = [
  { amount: 2500, label: 'Covers immediate expenses' },
  { amount: 5000, label: 'One month of support' },
  { amount: 10000, label: 'Meaningful stability' },
  { amount: 25000, label: 'Life-changing impact' },
];

export function getDefaultImpactTiers(goalAmount: number): { amount: number; label: string }[] {
  return DEFAULT_IMPACT_TIERS.filter((tier) => tier.amount <= goalAmount);
}

/**
 * Build story generation prompt with structural variation.
 *
 * The pattern and word range are determined automatically from the entity's
 * category and context richness. Callers can pass recentPatterns for
 * anti-repetition across a batch of campaigns.
 */
export function buildGenerateCampaignPrompt(
  input: GenerateCampaignInput,
  recentPatterns: StoryPattern[] = [],
): { systemPrompt: string; userPrompt: string; selectedPattern: StoryPattern } {
  const category = input.category as CampaignCategory;
  const pattern = selectStoryPattern(category, recentPatterns);
  const richness = scoreContextRichness(input);
  const wordRange = getWordRange(richness);
  const definition = PATTERN_DEFINITIONS[pattern];

  const family = input.family ?? [];
  const familyDescription = family.length > 0
    ? family.map((f) => `${f.name} (${f.relation}${f.age ? `, ${f.age}` : ''})`).join(', ')
    : null;

  const systemPrompt = buildSystemPrompt(definition, wordRange, richness);

  const userPrompt = `SUBJECT: ${input.name}${input.age ? `, age ${input.age}` : ''}
EVENT: ${input.event}
${input.eventDate ? `DATE: ${input.eventDate}` : ''}
${input.unit ? `UNIT: ${input.unit}` : ''}
${input.department ? `DEPARTMENT: ${input.department}` : ''}
HOMETOWN: ${input.hometown}
${familyDescription ? `FAMILY: ${familyDescription}` : 'FAMILY: No family members identified in the source article - do NOT mention or invent any family members'}
CATEGORY: ${input.category}
FUNDING GOAL: $${input.suggestedGoal.toLocaleString()}
SOURCE: ${input.sourceName} - ${input.sourceUrl}

NARRATIVE PATTERN: ${definition.name}
TARGET WORD COUNT: ${wordRange.min}–${wordRange.max} words
CONTEXT LEVEL: ${richness} (${richness === 'minimal' ? 'keep it concise - do NOT pad with fictional details. If information is limited, acknowledge that details are still emerging' : richness === 'moderate' ? 'use all available context, stay factual' : 'use all context to create a rich, detailed narrative'})`;

  return { systemPrompt, userPrompt, selectedPattern: pattern };
}

// ── System Prompt Builder ───────────────────────────────────────────────────

function buildSystemPrompt(
  definition: (typeof PATTERN_DEFINITIONS)[StoryPattern],
  wordRange: WordRange,
  richness: ContextRichness,
): string {
  const sectionInstructions = definition.sections
    .map((s) => `<section data-section="${s.id}">
  <p>${s.instruction}</p>
</section>`)
    .join('\n\n');

  return `You are a storyteller for a nonprofit fundraising platform. Write a campaign story using the "${definition.name}" narrative structure.

NARRATIVE APPROACH: ${definition.description}
${definition.psychologicalNote}

RULES:
- Write in third person
- Plain language, empathetic but NOT manipulative or exaggerated
- When citing the source, use the EXACT full URL provided in the SOURCE field - never shorten it to a domain root. The link text must be the source name, NEVER use "here" or "click here" as link text
- ABSOLUTELY NO fictional details - only use what is provided. If details are unknown, write "details are still emerging" or "the full extent is still being determined" - never invent specifics
- If family members are not listed, do NOT mention or invent any family members. Simply omit family references
- If the person's age is not provided, do NOT guess or include any age reference
- No guilt-tripping or emotional manipulation
- WORD COUNT: Target ${wordRange.min}–${wordRange.max} words total.${richness === 'minimal' ? ' You have LIMITED context - write concisely. Do NOT invent details to fill space. Use phrases like "details are still emerging" if needed.' : richness === 'rich' ? ' You have RICH context - weave all available details into a compelling narrative.' : ''}

FORMAT - CRITICAL:
- You MUST output valid HTML. NEVER use markdown syntax (no [text](url), no **bold**, no # headings)
- Every paragraph MUST be wrapped in <p> tags
- Links MUST use <a> tags: <a href="URL" target="_blank" rel="noopener noreferrer">Source Name</a>
- Bold text MUST use <strong> tags, italic MUST use <em> tags
- Each section MUST be wrapped in a <section> tag with a data-section attribute
- The result must render correctly when inserted into an HTML page with no additional processing

FORMATTING PALETTE:
${definition.formattingGuidance}
- <strong> for names (first full mention), dollar amounts, and critical facts
- <em> for character traits, place names on first mention, or emotional emphasis
- <blockquote> ONLY when expressing a collective sentiment or paraphrasing a quote (not for regular text)
- <ul>/<li> for listing multiple needs or impact tiers (only when naturally appropriate)
- <hr> to create a visual break before a final section (use sparingly)

STRUCTURE (${definition.sections.length} sections - follow this exact order):

${sectionInstructions}

Return ONLY the HTML sections. No JSON, no markdown, no code fences, no explanation.`;
}
