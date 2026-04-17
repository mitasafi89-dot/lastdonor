/**
 * Oblique Strategy Engine - generates unconventional content constraints
 * using a 3-phase framework: Primitive Decomposition → Inversion → Oblique Constraint.
 *
 * Each blog topic gets a unique ObliqueBrief that forces the content away from
 * generic AI writing patterns and toward genuinely engaging, conversion-focused prose.
 */

import { callAI } from '@/lib/ai/call-ai';

// ─── Seed words for Phase 3 oblique constraint generation ─────────────────────
const OBLIQUE_SEED_WORDS = [
  'rust',
  'mirror',
  'fermentation',
  'scorpion',
  'echo',
  'zero',
  'knot',
  'salt',
  'sponge',
  'fog',
  'fracture',
  'tide',
  'ember',
  'hollow',
  'orbit',
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObliqueBrief {
  /** Single sentence: the irreducible law governing this post's existence */
  primalLaw: string;
  /** 3 positive constraints derived from inverting failure modes */
  inversionConstraints: [string, string, string];
  /** Self-contradictory structural rule mapped to a concrete writing instruction */
  obliqueStructuralRule: string;
  /** Counterintuitive CTA approach that creates tension before resolution */
  ctaParadox: string;
  /** 5-7 specific things forbidden in THIS post (not generic rules) */
  forbiddenList: string[];
  /** The seed word used for Phase 3 */
  seedWord: string;
}

/**
 * Pick a deterministic-ish seed word based on the keyword.
 * Uses a simple hash so the same keyword always gets the same seed word,
 * but different keywords get different ones.
 */
export function pickSeedWord(keyword: string): string {
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) {
    hash = ((hash << 5) - hash + keyword.charCodeAt(i)) | 0;
  }
  return OBLIQUE_SEED_WORDS[Math.abs(hash) % OBLIQUE_SEED_WORDS.length];
}

/**
 * Generate an ObliqueBrief for a blog topic using the 3-phase framework.
 *
 * Phase 1 - Primitive Decomposition:
 *   Strip common SEO/AEO rules to their primitives (truth, novelty, consistency,
 *   utility, surprise). Distill into a single Primal Law.
 *
 * Phase 2 - Inversion (Failure Modes):
 *   Identify 3 ways this specific post would fail to engage or convert.
 *   Derive a positive constraint forcing the opposite of each failure.
 *
 * Phase 3 - Oblique Constraint:
 *   Use a random seed word to generate a self-contradictory structural rule,
 *   then map it to a concrete writing instruction.
 */
export async function generateObliqueBrief(params: {
  primaryKeyword: string;
  causeCategory: string;
  targetAudience?: string;
  newsHook?: string | null;
}): Promise<ObliqueBrief> {
  const seedWord = pickSeedWord(params.primaryKeyword);

  const systemPrompt = buildObliqueSystemPrompt();
  const userPrompt = buildObliqueUserPrompt({
    ...params,
    seedWord,
  });

  const brief = await callAI<ObliqueBrief>({
    systemPrompt,
    userPrompt,
    parseJson: true,
    maxTokens: 4096,
    promptType: 'oblique_brief',
  });

  // Validate
  if (
    !brief.primalLaw ||
    !Array.isArray(brief.inversionConstraints) ||
    brief.inversionConstraints.length !== 3 ||
    !brief.obliqueStructuralRule ||
    !brief.ctaParadox ||
    !Array.isArray(brief.forbiddenList) ||
    brief.forbiddenList.length < 3
  ) {
    throw new Error('Oblique brief is missing required fields or has wrong structure');
  }

  return { ...brief, seedWord };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildObliqueSystemPrompt(): string {
  return `You are an Oblique Strategist for LastDonor.org's blog engine. Your job is NOT to write blog posts. Your job is to generate a set of unconventional constraints that will force the blog writer to produce content that defies generic AI patterns and genuinely engages humans.

You think in 3 phases:

PHASE 1 - PRIMITIVE DECOMPOSITION:
Take the 5 core SEO/AEO signals (truth, novelty, internal consistency, utility, surprise) and ask: what does a search engine or AI engine ACTUALLY reward for this specific topic? Not the conventional rule, but the primitive underneath it. Strip away the "best practices" layer and find the raw signal. From this analysis, distill ONE Primal Law: a single sentence that captures the irreducible truth about why this content must exist.

PHASE 2 - INVERSION (FAILURE MODES):
Imagine 3 specific ways this blog post would FAIL. Not generic failures. Specific to this topic, this audience, this intent. Examples: "The reader already knows the top 3 results and bounced from all of them" or "The reader is emotionally numb to statistics about this cause." For each failure, derive a POSITIVE constraint that forces the opposite. These become Inversion Constraints.

PHASE 3 - OBLIQUE CONSTRAINT:
You are given a seed word. Use it as a lens to generate ONE self-contradictory structural rule for the article (e.g., if the word is "rust": "The article must corrode its own strongest claim before rebuilding it stronger"). Then map that rule to a CONCRETE writing instruction the blog writer can follow (e.g., "In section 3, present the most compelling statistic, then immediately challenge it with a real objection. Resolve the tension in the next paragraph.").

Additionally, generate:
- A CTA Paradox: a counterintuitive approach to the call-to-action that creates tension before resolution. Not "donate now" but something that makes the reader feel the weight first.
- A Forbidden List: 5-7 specific things forbidden in THIS post. Not generic rules (no em dashes, no filler). Topic-specific bans (e.g., "Do not mention the word 'crisis' in the first 500 words", "Do not use any statistic older than 2023").

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "primalLaw": "One sentence: the irreducible law.",
  "inversionConstraints": [
    "Constraint 1: positive rule derived from failure mode 1",
    "Constraint 2: positive rule derived from failure mode 2",
    "Constraint 3: positive rule derived from failure mode 3"
  ],
  "obliqueStructuralRule": "The concrete writing instruction derived from the seed word.",
  "ctaParadox": "The counterintuitive CTA approach.",
  "forbiddenList": [
    "Specific thing banned in this post",
    "Another specific ban",
    "..."
  ],
  "seedWord": "the seed word used"
}`;
}

function buildObliqueUserPrompt(params: {
  primaryKeyword: string;
  causeCategory: string;
  targetAudience?: string;
  newsHook?: string | null;
  seedWord: string;
}): string {
  const { primaryKeyword, causeCategory, targetAudience, newsHook, seedWord } = params;

  let prompt = `Generate an Oblique Brief for the following blog topic.

PRIMARY KEYWORD: "${primaryKeyword}"
CAUSE CATEGORY: ${causeCategory}
SEED WORD FOR PHASE 3: "${seedWord}"
`;

  if (targetAudience) {
    prompt += `TARGET AUDIENCE: ${targetAudience}\n`;
  }

  if (newsHook) {
    prompt += `NEWS HOOK: "${newsHook}"\n`;
  }

  prompt += `
Run all 3 phases:
1. Decompose to primitives. What does an AI engine actually reward for "${primaryKeyword}"? Output ONE Primal Law.
2. Identify 3 failure modes specific to a blog about "${primaryKeyword}" in the ${causeCategory} space. Derive 3 Inversion Constraints.
3. Use "${seedWord}" to create a self-contradictory structural rule, then map it to a concrete writing instruction.
4. Create a CTA Paradox: how should the call-to-action defy expectations while still driving action?
5. Create a Forbidden List: 5-7 specific things banned in THIS post (not generic writing rules).

Return ONLY the JSON object. No markdown fences.`;

  return prompt;
}

/**
 * Format an ObliqueBrief into a compact text block that can be injected into
 * content generation prompts as constraints.
 */
export function formatObliqueConstraints(brief: ObliqueBrief): string {
  return `OBLIQUE CONSTRAINTS (follow strictly):

PRIMAL LAW: ${brief.primalLaw}

INVERSION CONSTRAINTS:
1. ${brief.inversionConstraints[0]}
2. ${brief.inversionConstraints[1]}
3. ${brief.inversionConstraints[2]}

OBLIQUE STRUCTURAL RULE: ${brief.obliqueStructuralRule}

CTA PARADOX: ${brief.ctaParadox}

FORBIDDEN IN THIS POST:
${brief.forbiddenList.map((f) => `- ${f}`).join('\n')}`;
}
