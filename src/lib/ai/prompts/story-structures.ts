import type { CampaignCategory } from '@/types';
import type { ExtractedEntity } from './extract-entities';

// ── Story Pattern Types ─────────────────────────────────────────────────────

export type StoryPattern =
  | 'chronological'
  | 'character-first'
  | 'in-medias-res'
  | 'community-voice'
  | 'quiet-dignity'
  | 'impact-forward';

export type ContextRichness = 'minimal' | 'moderate' | 'rich';

export type WordRange = { min: number; max: number };

// ── Context Richness Scoring ────────────────────────────────────────────────

/**
 * Score the richness of extracted entity context based on how many optional
 * fields are present. Higher scores unlock longer, more detailed narratives.
 *
 * Scoring (out of 7 possible points):
 *   age          → 1
 *   eventDate    → 1
 *   unit         → 1
 *   department   → 1
 *   family.length >= 1 → 1
 *   family.length >= 3 → 1 (bonus for large families)
 *   hometown !== 'Unknown' → 1
 */
export function scoreContextRichness(entity: ExtractedEntity): ContextRichness {
  let score = 0;

  if (entity.age) score++;
  if (entity.eventDate) score++;
  if (entity.unit) score++;
  if (entity.department) score++;
  if (entity.family && entity.family.length >= 1) score++;
  if (entity.family && entity.family.length >= 3) score++;
  if (entity.hometown && entity.hometown !== 'Unknown') score++;

  if (score <= 2) return 'minimal';
  if (score <= 4) return 'moderate';
  return 'rich';
}

/**
 * Map context richness to a word-count target range.
 * Minimal context → shorter (padding with fiction is forbidden).
 * Rich context → longer (more real detail to weave in).
 */
export function getWordRange(richness: ContextRichness): WordRange {
  switch (richness) {
    case 'minimal':
      return { min: 75, max: 120 };
    case 'moderate':
      return { min: 150, max: 200 };
    case 'rich':
      return { min: 200, max: 300 };
  }
}

// ── Category → Pattern Weights ──────────────────────────────────────────────

/**
 * Each category maps to weighted pattern preferences.
 * Weights are relative (they don't need to sum to 1).
 *
 * Psychological rationale embedded in the weights:
 * - Medical: character-first (empathy via personal connection)
 * - Disaster: chronological or community-voice (shared crisis bonds)
 * - Military: in-medias-res (action orientation, duty culture)
 * - Memorial: quiet-dignity (respect, reverence)
 * - Community: community-voice (collective identity)
 * - Education: impact-forward (future-oriented hope)
 */
const CATEGORY_PATTERN_WEIGHTS: Record<CampaignCategory, Record<StoryPattern, number>> = {
  medical:            { 'chronological': 1, 'character-first': 5, 'in-medias-res': 2, 'community-voice': 1, 'quiet-dignity': 2, 'impact-forward': 1 },
  disaster:           { 'chronological': 5, 'character-first': 1, 'in-medias-res': 3, 'community-voice': 4, 'quiet-dignity': 1, 'impact-forward': 1 },
  military:           { 'chronological': 2, 'character-first': 2, 'in-medias-res': 5, 'community-voice': 1, 'quiet-dignity': 3, 'impact-forward': 1 },
  veterans:           { 'chronological': 2, 'character-first': 2, 'in-medias-res': 2, 'community-voice': 1, 'quiet-dignity': 5, 'impact-forward': 2 },
  memorial:           { 'chronological': 2, 'character-first': 3, 'in-medias-res': 1, 'community-voice': 2, 'quiet-dignity': 5, 'impact-forward': 1 },
  'first-responders': { 'chronological': 2, 'character-first': 2, 'in-medias-res': 5, 'community-voice': 2, 'quiet-dignity': 2, 'impact-forward': 1 },
  community:          { 'chronological': 1, 'character-first': 2, 'in-medias-res': 1, 'community-voice': 5, 'quiet-dignity': 1, 'impact-forward': 3 },
  'essential-needs':  { 'chronological': 2, 'character-first': 3, 'in-medias-res': 1, 'community-voice': 2, 'quiet-dignity': 5, 'impact-forward': 2 },
  emergency:          { 'chronological': 4, 'character-first': 2, 'in-medias-res': 5, 'community-voice': 1, 'quiet-dignity': 1, 'impact-forward': 1 },
  charity:            { 'chronological': 1, 'character-first': 2, 'in-medias-res': 1, 'community-voice': 4, 'quiet-dignity': 2, 'impact-forward': 5 },
  education:          { 'chronological': 1, 'character-first': 3, 'in-medias-res': 1, 'community-voice': 2, 'quiet-dignity': 1, 'impact-forward': 5 },
  animal:             { 'chronological': 3, 'character-first': 5, 'in-medias-res': 2, 'community-voice': 2, 'quiet-dignity': 1, 'impact-forward': 2 },
  environment:        { 'chronological': 2, 'character-first': 1, 'in-medias-res': 1, 'community-voice': 5, 'quiet-dignity': 1, 'impact-forward': 4 },
  business:           { 'chronological': 2, 'character-first': 3, 'in-medias-res': 1, 'community-voice': 2, 'quiet-dignity': 1, 'impact-forward': 5 },
  competition:        { 'chronological': 2, 'character-first': 4, 'in-medias-res': 3, 'community-voice': 2, 'quiet-dignity': 1, 'impact-forward': 3 },
  creative:           { 'chronological': 2, 'character-first': 5, 'in-medias-res': 2, 'community-voice': 2, 'quiet-dignity': 1, 'impact-forward': 3 },
  event:              { 'chronological': 4, 'character-first': 2, 'in-medias-res': 3, 'community-voice': 3, 'quiet-dignity': 1, 'impact-forward': 2 },
  faith:              { 'chronological': 2, 'character-first': 2, 'in-medias-res': 1, 'community-voice': 5, 'quiet-dignity': 3, 'impact-forward': 2 },
  family:             { 'chronological': 3, 'character-first': 4, 'in-medias-res': 2, 'community-voice': 2, 'quiet-dignity': 3, 'impact-forward': 1 },
  sports:             { 'chronological': 2, 'character-first': 4, 'in-medias-res': 3, 'community-voice': 3, 'quiet-dignity': 1, 'impact-forward': 2 },
  travel:             { 'chronological': 4, 'character-first': 3, 'in-medias-res': 3, 'community-voice': 1, 'quiet-dignity': 1, 'impact-forward': 2 },
  volunteer:          { 'chronological': 1, 'character-first': 3, 'in-medias-res': 1, 'community-voice': 5, 'quiet-dignity': 2, 'impact-forward': 3 },
  wishes:             { 'chronological': 2, 'character-first': 5, 'in-medias-res': 1, 'community-voice': 2, 'quiet-dignity': 3, 'impact-forward': 2 },
};

// ── Pattern Selection ───────────────────────────────────────────────────────

/**
 * Select a story pattern using weighted random selection, with optional
 * anti-repetition: recently used patterns have their weight halved.
 */
export function selectStoryPattern(
  category: CampaignCategory,
  recentPatterns: StoryPattern[] = [],
): StoryPattern {
  const weights = { ...CATEGORY_PATTERN_WEIGHTS[category] };

  // Anti-repetition: halve weights for recently used patterns
  for (const recent of recentPatterns) {
    if (weights[recent] !== undefined) {
      weights[recent] = Math.max(weights[recent] * 0.5, 0.1);
    }
  }

  const entries = Object.entries(weights) as [StoryPattern, number][];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  let random = Math.random() * totalWeight;
  for (const [pattern, weight] of entries) {
    random -= weight;
    if (random <= 0) return pattern;
  }

  // Fallback (should never reach here)
  return entries[0][0];
}

// ── Pattern Section Definitions ─────────────────────────────────────────────

export type SectionDefinition = {
  id: string;
  title: string;
  instruction: string;
};

export type PatternDefinition = {
  name: string;
  description: string;
  psychologicalNote: string;
  sections: SectionDefinition[];
  formattingGuidance: string;
};

/**
 * Full definitions for each story pattern — section structures, writing
 * instructions, and formatting guidance unique to each narrative archetype.
 */
export const PATTERN_DEFINITIONS: Record<StoryPattern, PatternDefinition> = {
  'chronological': {
    name: 'Chronological Narrative',
    description: 'Events unfold in time order. The reader walks through the timeline alongside the subject.',
    psychologicalNote: 'Temporal progression creates a sense of inevitability and trust. Readers feel they are witnessing the story, not being sold to.',
    sections: [
      { id: 'before', title: 'Life Before', instruction: 'Set the scene: who this person was before the event. One to two sentences establishing normalcy — their role, their routine, what mattered to them.' },
      { id: 'the-event', title: 'What Happened', instruction: 'Describe the event in plain chronological order. Include the date if known. Cite the source with a properly formatted <a> link. Stay factual.' },
      { id: 'aftermath', title: 'The Aftermath', instruction: 'What followed — medical treatment, displacement, loss. Be specific about real consequences. Use <strong> to highlight key facts (costs, timeline, injuries).' },
      { id: 'whats-needed', title: 'What\'s Needed Now', instruction: 'The concrete gap: what costs remain, what support is missing. Be specific about dollar amounts if known. Use a <ul> list if there are multiple needs.' },
      { id: 'looking-ahead', title: 'Looking Ahead', instruction: 'A brief, dignified close connecting the donation to a tangible outcome. Reference the person by name. No guilt, no pressure.' },
    ],
    formattingGuidance: 'Use <strong> for dates and key figures. Use <em> for location names on first mention. If multiple needs exist, use a <ul> with <li> items. Keep paragraphs short — 2-3 sentences each.',
  },

  'character-first': {
    name: 'Character-First Portrait',
    description: 'Opens with who the person IS, not what happened. The reader connects with the human before learning about the crisis.',
    psychologicalNote: 'Character-first structure activates empathy before distress. Readers who feel they "know" someone donate at 2-3x the rate of those who only know the event.',
    sections: [
      { id: 'who-they-are', title: 'Meet Them', instruction: 'Open with a vivid, human detail about this person — not the crisis. Their job, a habit, what their neighbors say about them, their family role. Make the reader see a person, not a case.' },
      { id: 'their-world', title: 'Their World', instruction: 'Expand: family (use real names if known), community ties, what they contribute. Use <em> for when quoting a characteristic or trait. This section should make the reader root for them.' },
      { id: 'what-changed', title: 'Then Everything Changed', instruction: 'The event — told through the lens of how it disrupted the person described above. Cite the source with a properly formatted <a> link. Use <strong> for the most impactful fact.' },
      { id: 'the-need', title: 'The Need', instruction: 'What this person — who you now know — needs. Connect the need to who they are. A firefighter needs to walk again; a teacher needs to return to her classroom.' },
      { id: 'your-part', title: 'How You Can Help', instruction: 'A direct, warm ask. Reference something specific from the character introduction to create narrative closure. Keep it to 1-2 sentences.' },
    ],
    formattingGuidance: 'Use <em> for character traits or quoted descriptions. Use <strong> for the person\'s name on first full mention and for key monetary figures. Keep the "Meet Them" section the longest. Avoid lists — this pattern is narrative.',
  },

  'in-medias-res': {
    name: 'In Medias Res',
    description: 'Opens in the middle of the action. The reader lands in the critical moment, then context unfolds around them.',
    psychologicalNote: 'Starting mid-action activates the reader\'s fight-or-flight mirror neurons. Urgency is immediate, not built. Particularly effective for action-oriented audiences (military, first-responder communities).',
    sections: [
      { id: 'the-moment', title: 'The Moment', instruction: 'Drop the reader into the critical moment — the call, the collapse, the explosion, the diagnosis. One to three sentences, present tense allowed for immediacy. Use <strong> for the most visceral detail.' },
      { id: 'step-back', title: 'Stepping Back', instruction: 'Now give context: who is this person, where did this happen. Transition from the intense opening to factual grounding. Cite the source with a properly formatted <a> link.' },
      { id: 'the-toll', title: 'The Toll', instruction: 'What the event cost — physically, financially, emotionally. Use <strong> for specific figures. Be precise, not dramatic.' },
      { id: 'the-road-ahead', title: 'The Road Ahead', instruction: 'What recovery or rebuilding looks like. Be honest about the challenge but not hopeless. If there are multiple costs, use a <ul> list.' },
      { id: 'stand-with', title: 'Stand With Them', instruction: 'A call to action that echoes the intensity of the opening. Short, direct, name-specific. 1-2 sentences.' },
    ],
    formattingGuidance: 'Use <strong> heavily in the opening moment for visceral impact. Use <em> for internal moments or emotional shifts. Keep the first section punchy — no more than 3 sentences. Use <hr> before the final call to action if the story is long.',
  },

  'community-voice': {
    name: 'Community Voice',
    description: 'Told through the lens of the community affected. The subject is embedded in a network of people who need help.',
    psychologicalNote: 'Community framing triggers social identity motivation. When readers see a community rallying, they want to join the collective — "I want to be part of this." Effective for disasters, faith, and neighborhood-scale events.',
    sections: [
      { id: 'the-community', title: 'The Community', instruction: 'Open with the place — the neighborhood, the town, the congregation, the unit. Establish the collective identity. Use <em> for the community name.' },
      { id: 'what-hit', title: 'What Hit Them', instruction: 'The event that affected the community. Frame it collectively: "When the tornado struck Oak Ridge..." Cite the source with a properly formatted <a> link.' },
      { id: 'one-story', title: 'One Story Within', instruction: 'Zoom into the specific subject. This person represents the broader impact. Use <strong> for their name. Connect their situation to the larger community crisis.' },
      { id: 'rallying', title: 'The Rally', instruction: 'Show what the community is already doing — neighbors helping, organizations stepping up. This creates momentum: the donation joins an existing wave.' },
      { id: 'join-them', title: 'Join Them', instruction: 'The ask is framed as joining a community effort, not giving to a stranger. Reference the collective. 1-2 sentences.' },
    ],
    formattingGuidance: 'Use <em> for community names and places. Use <strong> for the subject\'s name and key figures. Consider a <blockquote> if there is a natural collective sentiment to express. Keep sections balanced in length.',
  },

  'quiet-dignity': {
    name: 'Quiet Dignity',
    description: 'Understated, respectful tone. Lets the facts speak. No dramatic flourishes — just a clear, honest account that assumes the reader\'s intelligence.',
    psychologicalNote: 'Restraint builds trust. When a story doesn\'t try to manipulate, sophisticated donors lean in. This pattern respects both subject and reader, working especially well for veterans and memorial campaigns.',
    sections: [
      { id: 'the-facts', title: 'The Facts', instruction: 'State what happened plainly. Date, location, event. No adjectives, no drama. Cite the source with a properly formatted <a> link. Use <strong> only for the person\'s name.' },
      { id: 'who-they-are', title: 'Who They Are', instruction: 'Brief, factual biography: age, role, family. Let the reader fill in the emotion. Use specific details but don\'t editorialize them.' },
      { id: 'what-they-face', title: 'What They Face', instruction: 'The practical reality: costs, lost wages, medical timeline. Be specific. Use <strong> for figures. If multiple needs, use a <ul> list. No embellishment.' },
      { id: 'a-simple-ask', title: 'A Simple Ask', instruction: 'One or two sentences. Direct. No "imagine if" or "what would you do." Just: this is what they need, and this is how you can help. Use their name.' },
    ],
    formattingGuidance: 'Minimal formatting — this pattern\'s power is in restraint. Use <strong> sparingly (name, dollar amounts only). Avoid <em> and <blockquote>. No lists unless there are genuinely multiple distinct needs. Short paragraphs, short sentences.',
  },

  'impact-forward': {
    name: 'Impact Forward',
    description: 'Leads with what the donation WILL accomplish. The future state is the hook, then the backstory explains why it matters.',
    psychologicalNote: 'Future-oriented framing activates the brain\'s reward-prediction system. Donors see the outcome before they give, making the act feel like an investment rather than a loss. Highly effective for education, business recovery, and charity campaigns.',
    sections: [
      { id: 'the-vision', title: 'The Vision', instruction: 'Open with what becomes possible with support: a student returns to school, a business reopens, a family has a stable home. Use <em> for the aspirational detail. Keep it concrete, not vague.' },
      { id: 'the-backstory', title: 'The Backstory', instruction: 'Now explain what happened: the event, the setback, the loss. Cite the source with a properly formatted <a> link. Use <strong> for the person\'s name.' },
      { id: 'the-gap-between', title: 'The Gap Between', instruction: 'The distance between where they are now and the vision you opened with. Be specific about costs and needs. Use <strong> for key figures.' },
      { id: 'making-it-real', title: 'Making It Real', instruction: 'Break down how donations translate into outcomes. Use a <ul> list to show 2-3 concrete impact tiers. This is where the donor sees their role.' },
      { id: 'be-part', title: 'Be Part of This', instruction: 'Close by connecting back to the opening vision. The donor isn\'t just giving money — they\'re closing the gap. Reference the person by name. 1-2 sentences.' },
    ],
    formattingGuidance: 'Use <em> in the opening vision for aspirational details. Use <strong> for name, figures, and impact amounts. Use <ul>/<li> in the "Making It Real" section for impact tiers. Keep the opening section vivid and the closing section short.',
  },
};
