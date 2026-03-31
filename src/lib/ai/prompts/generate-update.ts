import type { DonationPhase, CampaignOrganizer } from '@/types';

// ── Phase Transition Title Templates ────────────────────────────────────────

/**
 * Multiple title templates per phase to avoid P5 repetition.
 * `{name}` is replaced with the subject's first name,
 * `{fullName}` with the full name, `{label}` with the phase label.
 */
const PHASE_TRANSITION_TITLE_TEMPLATES: Record<DonationPhase, string[]> = {
  first_believers: [
    "The first believers have spoken — {fullName}'s campaign is underway",
    "{fullName}'s community rallies with early support",
    "Early momentum builds for {name}'s campaign",
    "{name}'s campaign crosses its first milestone",
    "A strong start: {name}'s supporters show up",
  ],
  the_push: [
    "{fullName}'s campaign hits a major milestone",
    "The push is on — {name} is past 25% funded",
    "Building momentum: supporters keep showing up for {name}",
    "{name}'s campaign enters a new chapter",
    "Halfway in sight: {fullName}'s campaign gains steam",
  ],
  closing_in: [
    "{fullName}'s campaign is closing in on the goal",
    "Almost there — {name}'s campaign crosses 60%",
    "The finish line is in sight for {name}",
    "{name}'s community pushes closer to the goal",
    "So close: {fullName}'s campaign enters the home stretch",
  ],
  last_donor_zone: [
    "{fullName}'s campaign enters the Last Donor Zone!",
    "Who will be the last donor? {name}'s campaign is over 90%",
    "Final stretch — {name}'s campaign needs just a little more",
    "The Last Donor Zone: {fullName}'s campaign is almost complete",
    "One generous gift away — {name} is in the Last Donor Zone",
  ],
};

/**
 * Build a varied title for a phase-transition update.
 * Selects a random template that doesn't match any previously used title.
 */
export function buildPhaseTransitionTitle(
  subjectName: string,
  phase: DonationPhase,
  previousTitles: string[] = [],
): string {
  const templates = PHASE_TRANSITION_TITLE_TEMPLATES[phase];
  const firstName = subjectName.split(' ')[0];

  // Generate all candidate titles
  const candidates = templates.map((t) =>
    t.replace(/\{fullName\}/g, subjectName)
      .replace(/\{name\}/g, firstName)
      .replace(/\{label\}/g, getPhaseLabel(phase)),
  );

  // Prefer titles not already used
  const unused = candidates.filter(
    (c) => !previousTitles.some((prev) => prev === c),
  );

  const pool = unused.length > 0 ? unused : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type GenerateUpdateInput = {
  subjectName: string;
  phase: DonationPhase;
  percentage: number;
  raisedAmount: number;
  goalAmount: number;
  /** Campaign age in days */
  campaignAgeDays?: number;
  /** Total donor count */
  donorCount?: number;
  /** Short plaintext summary of the campaign story */
  storySummary?: string;
  /** Titles/types of previous updates for context continuity */
  previousUpdates?: string[];
  /** Organizer identity — if present, the update is written in their voice */
  organizer?: CampaignOrganizer;
};

export function buildGenerateUpdatePrompt(input: GenerateUpdateInput) {
  const raisedDollars = (input.raisedAmount / 100).toLocaleString();
  const goalDollars = (input.goalAmount / 100).toLocaleString();

  // Determine voice: organizer (first-person) or platform (third-person)
  const hasOrganizer = !!input.organizer;
  const voiceInstruction = hasOrganizer
    ? `Write as ${input.organizer!.name}, the ${input.organizer!.relation} of ${input.subjectName}, from ${input.organizer!.city}. Write in FIRST PERSON — "we", "I", "our". Be warm, personal, and genuine. Reference your relationship naturally.`
    : `Write as a warm, human campaign update. Reference ${input.subjectName} by name. Be genuine, not corporate.`;

  const systemPrompt = `You write short campaign update posts for a nonprofit fundraising platform. ${voiceInstruction} Return ONLY plain text, no formatting, no HTML, no markdown.`;

  // Build context lines
  const contextLines: string[] = [
    `Campaign for ${input.subjectName} just entered the "${getPhaseLabel(input.phase)}" phase at ${input.percentage}%.`,
    `Raised: $${raisedDollars} of $${goalDollars} goal.`,
  ];

  if (input.campaignAgeDays != null) {
    contextLines.push(`Campaign has been running for ${input.campaignAgeDays} day${input.campaignAgeDays !== 1 ? 's' : ''}.`);
  }
  if (input.donorCount != null) {
    contextLines.push(`Total donors so far: ${input.donorCount}.`);
  }
  if (input.storySummary) {
    contextLines.push(`\nStory background: ${input.storySummary}`);
  }
  if (input.previousUpdates && input.previousUpdates.length > 0) {
    contextLines.push(`\nPrevious updates posted (do NOT repeat these themes):\n${input.previousUpdates.map((u) => `- ${u}`).join('\n')}`);
  }

  const userPrompt = `${contextLines.join('\n')}

Write a 2-3 sentence campaign update that:
- Celebrates reaching the ${getPhaseLabel(input.phase)} milestone
- Thanks the ${input.donorCount ?? 'many'} donors who got us here
- Builds urgency and momentum for the next phase
- References ${input.subjectName} by ${hasOrganizer ? 'first name' : 'name'}
${hasOrganizer ? `- Sounds like a real person posting — ${input.organizer!.name}, not a brand` : ''}
- Does NOT mention specific dollar amounts from individual donors
- Does NOT repeat themes from previous updates`;

  return { systemPrompt, userPrompt };
}

export function getPhaseLabel(phase: DonationPhase): string {
  const labels: Record<DonationPhase, string> = {
    first_believers: 'First Believers',
    the_push: 'The Push',
    closing_in: 'Closing In',
    last_donor_zone: 'Last Donor Zone',
  };
  return labels[phase];
}
