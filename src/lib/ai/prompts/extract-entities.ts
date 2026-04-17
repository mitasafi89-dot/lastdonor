import type { CampaignCategory } from '@/types';

export type ExtractEntitiesInput = {
  title: string;
  body: string;
  category: CampaignCategory;
};

export type ExtractedEntity = {
  name: string;
  age?: number;
  event: string;
  eventDate?: string;
  unit?: string;
  department?: string;
  hometown: string;
  family: { name: string; relation: string; age?: number }[];
  category: CampaignCategory;
  suggestedGoal: number;
  sourceUrl: string;
  sourceName: string;
  confidence: number;
};

const GOAL_RANGES: Record<string, { default: number; min: number; max: number }[]> = {
  military: [
    { default: 25000, min: 15000, max: 50000 },
  ],
  veterans: [
    { default: 10000, min: 5000, max: 20000 },
  ],
  'first-responders': [
    { default: 25000, min: 15000, max: 50000 },
  ],
  disaster: [
    { default: 15000, min: 10000, max: 30000 },
  ],
  medical: [
    { default: 20000, min: 10000, max: 50000 },
  ],
  memorial: [
    { default: 10000, min: 5000, max: 20000 },
  ],
  community: [
    { default: 10000, min: 5000, max: 25000 },
  ],
  'essential-needs': [
    { default: 5000, min: 2000, max: 10000 },
  ],
};

export function buildExtractEntitiesPrompt(input: ExtractEntitiesInput) {
  const ranges = GOAL_RANGES[input.category]?.[0] ?? { default: 10000, min: 5000, max: 25000 };

  const systemPrompt = `You are an entity extraction system for a nonprofit fundraising platform. Given a news article and its assigned category, extract structured data about the person or family in need.

CRITICAL RULES FOR THE "name" FIELD:
- "name" MUST be the real full name of the primary person (e.g. "Nicole Amor", "James Rodriguez", "Sarah Chen").
- NEVER use a job title, role description, or headline fragment as the name (e.g. "Paradise firefighter", "VA social worker", "Cooke County family" are NOT names).
- NEVER copy or paraphrase the article headline into the name field.
- The name should be 1-6 words: first name, optional middle name/initial, last name, optional suffix (Jr., Sr., III).
- Include military rank or title prefix only if part of how the person is known (e.g. "Sgt. James Lee").

IF NO REAL PERSON'S NAME IS FOUND IN THE ARTICLE:
- Set "confidence" to 25 or lower. Articles without named individuals are unlikely to produce good campaigns.
- For "name", use the most specific identifier you can: "The [Lastname] Family" if a surname is mentioned, or "[Rank/Title] [Lastname]" if a last name is available in any form.
- If absolutely NO surname or proper name appears anywhere in the article, set "name" to "UNIDENTIFIED" and "confidence" to 10.
- NEVER fabricate a descriptive phrase as a name. The following are FORBIDDEN as names: "Young Woman", "Local Resident", "Area Family", "Roommate from [City]", "Elderly Man", "Community Member", or any combination of generic descriptors.
- NEVER return an empty string "" for "name".

ANTI-FABRICATION RULES (CRITICAL):
- "age": ONLY include the person's age if it is EXPLICITLY stated in the article text. If the article does not mention their age, return null. NEVER estimate or guess an age.
- "family": ONLY include family members who are EXPLICITLY named or described in the article. If the article says "survived by his wife" but does not name her, include { "name": "wife (unnamed)", "relation": "wife" }. If NO family is mentioned in the article at all, return an EMPTY array []. NEVER invent family members.
- "eventDate": ONLY include if a specific date is mentioned in the article. Return null otherwise. NEVER guess dates.
- "sourceUrl": Use the EXACT full article URL provided in the ARTICLE BODY section. NEVER construct or shorten URLs. If no URL is available, return an empty string "".
- "confidence": Rate 0-100 how confident you are in the extraction accuracy. This MUST be low (< 30) if no real person name was found in the article. High confidence (70+) requires: a real full name, a specific location, and detailed event context.

Extract ALL other available information. If a field is not available in the article, use null.

For suggestedGoal, estimate an appropriate fundraising goal in whole dollars based on the situation severity, family size, and location cost of living. The goal for "${input.category}" campaigns typically ranges from $${ranges.min.toLocaleString()} to $${ranges.max.toLocaleString()}, with a default of $${ranges.default.toLocaleString()}.

Return ONLY valid JSON, no markdown fencing:
{
  "name": string (real person's full name, OR a short descriptive identifier if no name found - NEVER empty),
  "age": number | null (ONLY if explicitly stated in article),
  "event": string,
  "eventDate": string | null (ISO date format, ONLY if explicitly stated),
  "unit": string | null (military unit, if applicable),
  "department": string | null (fire/police department, if applicable),
  "hometown": string (city, state - MUST be a real specific place. If the article does not mention a location, set confidence below 25 and use the most specific location you can infer from context. NEVER use "Unknown", "Unspecified", or "N/A"),
  "family": [{ "name": string, "relation": string, "age": number | null }] (ONLY family members mentioned in article, empty array [] if none mentioned),
  "category": "${input.category}",
  "suggestedGoal": number,
  "sourceUrl": string (EXACT full URL from article),
  "sourceName": string,
  "confidence": number (0-100)
}`;

  const userPrompt = `CATEGORY: ${input.category}

ARTICLE TITLE: ${input.title}

ARTICLE BODY:
${input.body}`;

  return { systemPrompt, userPrompt };
}
