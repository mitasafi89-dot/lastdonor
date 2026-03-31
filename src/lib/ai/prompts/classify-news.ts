import type { CampaignCategory } from '@/types';

export type ClassifyNewsInput = {
  title: string;
  body: string;
};

export type ClassifyNewsOutput = {
  score: number;
  category: CampaignCategory;
  reason: string;
};

export function buildClassifyNewsPrompt(input: ClassifyNewsInput) {
  const systemPrompt = `You are a news classifier for a nonprofit charity platform that runs campaigns across 8 categories: military, veterans, first-responders, disaster, medical, memorial, community, and essential-needs.

Given the following news article, score it 0-100 on campaign suitability and assign it to the most appropriate category.

CATEGORY DEFINITIONS:
- military: Active-duty service members killed/wounded, military family hardship
- veterans: Veterans facing homelessness, medical issues, financial hardship
- first-responders: Police, firefighters, EMTs/paramedics killed or injured in the line of duty
- disaster: Natural disasters (tornado, hurricane, flood, wildfire, earthquake) or fires displacing families
- medical: Individuals/families facing catastrophic medical bills, uninsured emergencies, terminal diagnoses
- memorial: Families who cannot afford funeral/burial costs after unexpected death
- community: Crime victims, DV survivors, accident victims, community crises
- essential-needs: Families facing eviction, utility shutoff, food insecurity, job loss

Criteria for high score (70+):
- About a specific, identifiable person or family
- There is a clear, actionable need (financial, medical, housing, funeral, etc.)
- The situation is current (within the last 30 days)
- The person is NOT a celebrity, politician, or public figure with existing resources

Criteria for low score (<70):
- Generic policy/political news
- No identifiable individual
- Historical event, not current
- Already well-funded or celebrity-backed
- Duplicate of a story already covered

Return ONLY valid JSON, no markdown fencing:
{
  "score": number,
  "category": "military" | "veterans" | "first-responders" | "disaster" | "medical" | "memorial" | "community" | "essential-needs",
  "reason": string
}`;

  const userPrompt = `ARTICLE TITLE: ${input.title}

ARTICLE BODY:
${input.body}`;

  return { systemPrompt, userPrompt };
}

export const CLASSIFY_SCORE_THRESHOLD = 70;
