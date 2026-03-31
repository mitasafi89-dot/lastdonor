import type { CampaignCategory, DonationPhase } from '@/types';

export type GenerateMessagesInput = {
  name: string;
  age?: number;
  event: string;
  unit?: string;
  department?: string;
  hometown: string;
  family: string[];
  goal: number;
  category: CampaignCategory;
  phase: DonationPhase;
  count?: number;
  /** Campaign age in days (0 for new campaigns) */
  campaignAgeDays?: number;
  /** Current donor count */
  donorCount?: number;
  /** Current funding percentage (0-100) */
  percentage?: number;
  /** 5 example messages already used, for tonal continuity */
  existingMessages?: string[];
};

/**
 * Category-weighted persona distribution.
 * Each category emphasizes certain donor personas more than others,
 * creating a natural fit between the campaign type and who donates.
 */
const CATEGORY_PERSONA_EMPHASIS: Record<CampaignCategory, string> = {
  medical: 'Emphasize: nurses, fellow patients, church members, parents, teachers. De-emphasize: corporate execs, frat bros.',
  disaster: 'Emphasize: neighbors, church members, working class, first responders family. De-emphasize: teenagers, frat bros.',
  military: 'Emphasize: veterans, military spouses, patriotic retirees, Gold Star families, battle buddies. De-emphasize: Gen Z, academics.',
  veterans: 'Emphasize: fellow veterans, military spouses, VFW members, patriotic retirees. De-emphasize: teenagers, corporate execs.',
  memorial: 'Emphasize: lifelong friends, neighbors, coworkers, church members, family friends. De-emphasize: frat bros, Gen Z.',
  'first-responders': 'Emphasize: fellow firefighters/officers, station family, blue line supporters, neighbors. De-emphasize: academics.',
  community: 'Emphasize: neighbors, PTA parents, local business owners, church members, retirees. Mix broadly.',
  'essential-needs': 'Emphasize: social workers, church members, neighbors, working class, teachers. De-emphasize: corporate execs.',
  emergency: 'Emphasize: friends, neighbors, coworkers, church members. Mix broadly — emergencies attract diverse donors.',
  charity: 'Emphasize: regular donors, nonprofit workers, church members, corporate matching. Mix broadly.',
  education: 'Emphasize: teachers, parents, alumni, coaches, PTA members. De-emphasize: military jargon.',
  animal: 'Emphasize: animal lovers, shelter volunteers, vet techs, pet owners, grandmas. De-emphasize: military jargon.',
  environment: 'Emphasize: environmental advocates, outdoor enthusiasts, scientists, young professionals. De-emphasize: military jargon.',
  business: 'Emphasize: business owners, mentors, industry colleagues, employees, investors. De-emphasize: teenagers.',
  competition: 'Emphasize: teammates, coaches, parents, fans, athletic trainers. De-emphasize: academics, corporate.',
  creative: 'Emphasize: fellow artists, mentors, gallery-goers, art teachers, young professionals. Mix broadly.',
  event: 'Emphasize: community members, event attendees, local supporters, volunteers. Mix broadly.',
  faith: 'Emphasize: congregation members, pastors, deacons, youth group leaders, church families. De-emphasize: frat bros.',
  family: 'Emphasize: family members, family friends, neighbors, church members. De-emphasize: corporate execs.',
  sports: 'Emphasize: teammates, coaches, team parents, fans, sports enthusiasts. De-emphasize: academics.',
  travel: 'Emphasize: travel companions, friends, family, coworkers. Mix broadly.',
  volunteer: 'Emphasize: fellow volunteers, program staff, community advocates. Mix broadly.',
  wishes: 'Emphasize: parents, teachers, social workers, classmates, neighbors. De-emphasize: corporate execs.',
};

export function buildGenerateMessagesPrompt(input: GenerateMessagesInput) {
  const count = input.count ?? 30;
  const familyStr = input.family.length > 0 ? input.family.join(', ') : 'Unknown';

  const systemPrompt = `You generate realistic donation messages for a nonprofit fundraising platform. Each message should sound like it was written by a real person who just donated.

Return a JSON array of exactly ${count} unique message strings. No numbering, no labels, no markdown — ONLY a JSON array of strings.`;

  // Build context section with campaign progress info
  const contextLines: string[] = [
    `Campaign Context:`,
    `- Subject: ${input.name}${input.age ? `, ${input.age}` : ''}`,
    `- Event: ${input.event}`,
  ];
  if (input.unit) contextLines.push(`- Unit: ${input.unit}`);
  if (input.department) contextLines.push(`- Department: ${input.department}`);
  contextLines.push(
    `- Hometown: ${input.hometown}`,
    `- Family: ${familyStr}`,
    `- Funding Goal: $${input.goal.toLocaleString()}`,
    `- Category: ${input.category}`,
    `- Current Phase: ${input.phase}`,
  );

  // Add campaign progression context when available
  if (input.campaignAgeDays != null) {
    contextLines.push(`- Campaign Age: ${input.campaignAgeDays} day${input.campaignAgeDays !== 1 ? 's' : ''} old`);
  }
  if (input.donorCount != null) {
    contextLines.push(`- Total Donors So Far: ${input.donorCount}`);
  }
  if (input.percentage != null) {
    contextLines.push(`- Funded: ${input.percentage}%`);
  }

  // Add existing message examples for tonal continuity
  let continuitySectionStr = '';
  if (input.existingMessages && input.existingMessages.length > 0) {
    continuitySectionStr = `\n\nEXISTING MESSAGES (match this tonal range — do NOT repeat these, but maintain similar diversity and voice):
${input.existingMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}`;
  }

  // Category-specific persona emphasis
  const personaEmphasis = CATEGORY_PERSONA_EMPHASIS[input.category] ?? 'Mix broadly.';

  const userPrompt = `${contextLines.join('\n')}${continuitySectionStr}

Generate ${count} unique donation messages. Requirements:

SPECIFICITY DISTRIBUTION:
- 40% reference the subject by name ("${input.name.split(' ')[0]}", "${input.name.split(' ').pop()}")
- 20% reference location ("${input.hometown.split(',')[0]?.trim()}")
- 15% reference family (${input.family.slice(0, 3).map((f) => `"${f}"`).join(', ')})
- 10% reference the event/unit
- 15% generic but situation-appropriate

TONE (vary across all messages):
- Emotional, casual, blunt, formal, religious, patriotic, humorous, quiet

LENGTH:
- Most should be SHORT (3-8 words)
- Some 1-2 sentences max
- Never longer than 2 sentences

DONOR PERSONA DISTRIBUTION (for ${input.category} campaigns):
${personaEmphasis}
Base personas: Grandma, veteran, frat bro, soccer mom, truck driver, teacher, nurse, teenager, retiree, pastor, immigrant, corporate exec

DIALECT & PERSONALITY (each message from a different persona):
- Southern drawl, NYC blunt, Midwest nice, military jargon, Gen Z, Boomer, immigrant English, academic, working class

QUIRKS (distribute randomly):
- Some with typos
- Some ALL CAPS
- Some with emojis
- Some with no punctuation
- Some start mid-thought
- Some with pet names ("honey", "brother")

PHASE-SPECIFIC TONE (${input.phase}):
${getPhaseGuidance(input.phase)}

${getCampaignAgeGuidance(input.campaignAgeDays, input.donorCount)}

NEVER:
- Mention donation amounts
- Sound like an AI wrote it
- Use the same opening word twice
- Be longer than 2 sentences
- Sound like a corporate statement
- Reference being a "donor" or "donating" explicitly — the message IS the donation note`;

  return { systemPrompt, userPrompt };
}

function getPhaseGuidance(phase: DonationPhase): string {
  switch (phase) {
    case 'first_believers':
      return '- Hopeful, launching energy, "Let\'s get this started", pioneer spirit\n- These are EARLY donors — they reference being "first" or "getting the ball rolling"';
    case 'the_push':
      return '- Building momentum, encouraging, "Keep it going", community energy\n- Reference momentum: "Saw this was picking up steam", "Glad to see the support growing"';
    case 'closing_in':
      return '- Urgency, "We\'re almost there", excited energy, rally cry\n- Reference proximity to the goal: "So close!", "Let\'s finish this"';
    case 'last_donor_zone':
      return '- Maximum urgency, "Who will close it?", final push, historic moment\n- Reference being potentially the LAST donor: "Could I be the one?", "Let\'s make it happen NOW"';
  }
}

function getCampaignAgeGuidance(ageDays?: number, donorCount?: number): string {
  if (ageDays == null) return '';

  if (ageDays <= 1) {
    return `CAMPAIGN IS BRAND NEW (${ageDays} day old):
- Donors found this early — some reference that: "Just saw this", "First hearing about this"
- No references to momentum or progress yet — it's too early`;
  }
  if (ageDays <= 7) {
    return `CAMPAIGN IS YOUNG (${ageDays} days):
- Mix of early discoverers and people who heard through friends/social shares
- Some "a friend shared this" or "saw this on my feed" references are appropriate`;
  }
  if (ageDays <= 21) {
    return `CAMPAIGN HAS BEEN RUNNING (${ageDays} days, ${donorCount ?? 'many'} donors):
- Donors arrive through various channels — social shares, news articles, word of mouth
- Some reference having followed the story: "Been meaning to help", "Finally getting around to this"`;
  }
  return `ESTABLISHED CAMPAIGN (${ageDays} days, ${donorCount ?? 'many'} donors):
- Mature campaign — donors arrive through news coverage, social shares, community awareness
- Some reference the campaign's longevity: "Can't believe this is still going", "Better late than never"`;
}
