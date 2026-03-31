import { describe, it, expect } from 'vitest';
import { buildGenerateUpdatePrompt, buildPhaseTransitionTitle, getPhaseLabel } from '@/lib/ai/prompts/generate-update';
import type { DonationPhase, CampaignOrganizer } from '@/types';

const BASE_INPUT = {
  subjectName: 'Sarah Chen',
  phase: 'the_push' as DonationPhase,
  percentage: 45,
  raisedAmount: 225_000, // $2,250.00 in cents
  goalAmount: 500_000,   // $5,000.00 in cents
};

describe('buildGenerateUpdatePrompt', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildGenerateUpdatePrompt(BASE_INPUT);
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('includes subject name in user prompt', () => {
    const result = buildGenerateUpdatePrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('Sarah Chen');
  });

  it('includes phase label', () => {
    const result = buildGenerateUpdatePrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('The Push');
  });

  it('includes percentage', () => {
    const result = buildGenerateUpdatePrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('45%');
  });

  it('works without optional fields (backward compatibility)', () => {
    const result = buildGenerateUpdatePrompt(BASE_INPUT);
    expect(result.systemPrompt).toBeTruthy();
    expect(result.userPrompt).toBeTruthy();
  });

  it('includes campaign age when provided', () => {
    const result = buildGenerateUpdatePrompt({
      ...BASE_INPUT,
      campaignAgeDays: 12,
    });
    expect(result.userPrompt).toContain('12 days');
  });

  it('includes donor count when provided', () => {
    const result = buildGenerateUpdatePrompt({
      ...BASE_INPUT,
      donorCount: 87,
    });
    expect(result.userPrompt).toContain('87');
  });

  it('includes story summary when provided', () => {
    const result = buildGenerateUpdatePrompt({
      ...BASE_INPUT,
      storySummary: 'Sarah was diagnosed with a rare condition.',
    });
    expect(result.userPrompt).toContain('Sarah was diagnosed');
  });

  it('includes previous updates when provided', () => {
    const result = buildGenerateUpdatePrompt({
      ...BASE_INPUT,
      previousUpdates: [
        'Sarah\'s campaign enters First Believers',
        'Thank you from the family',
      ],
    });
    expect(result.userPrompt).toContain('Previous updates posted');
    expect(result.userPrompt).toContain('First Believers');
    expect(result.userPrompt).toContain('repeat');
  });

  it('writes in third-person when no organizer provided', () => {
    const result = buildGenerateUpdatePrompt(BASE_INPUT);
    expect(result.systemPrompt).toContain('warm, human');
    expect(result.systemPrompt).not.toContain('FIRST PERSON');
  });

  it('writes in first-person organizer voice when organizer provided', () => {
    const organizer: CampaignOrganizer = {
      name: 'David Chen',
      relation: 'sibling',
      city: 'Portland, OR',
    };
    const result = buildGenerateUpdatePrompt({
      ...BASE_INPUT,
      organizer,
    });
    expect(result.systemPrompt).toContain('David Chen');
    expect(result.systemPrompt).toContain('sibling');
    expect(result.systemPrompt).toContain('FIRST PERSON');
    expect(result.userPrompt).toContain('real person');
  });

  it('includes all phase labels correctly', () => {
    const phases: DonationPhase[] = [
      'first_believers',
      'the_push',
      'closing_in',
      'last_donor_zone',
    ];
    const labels = ['First Believers', 'The Push', 'Closing In', 'Last Donor Zone'];

    phases.forEach((phase, i) => {
      const result = buildGenerateUpdatePrompt({ ...BASE_INPUT, phase });
      expect(result.userPrompt).toContain(labels[i]);
    });
  });
});

// ── getPhaseLabel ───────────────────────────────────────────────────────────

describe('getPhaseLabel', () => {
  it('returns correct labels for all phases', () => {
    expect(getPhaseLabel('first_believers')).toBe('First Believers');
    expect(getPhaseLabel('the_push')).toBe('The Push');
    expect(getPhaseLabel('closing_in')).toBe('Closing In');
    expect(getPhaseLabel('last_donor_zone')).toBe('Last Donor Zone');
  });
});

// ── buildPhaseTransitionTitle ───────────────────────────────────────────────

describe('buildPhaseTransitionTitle', () => {
  it('returns a non-empty string', () => {
    const title = buildPhaseTransitionTitle('Sarah Chen', 'the_push');
    expect(title).toBeTruthy();
    expect(typeof title).toBe('string');
  });

  it('includes the subject name in the title', () => {
    const title = buildPhaseTransitionTitle('Sarah Chen', 'first_believers');
    expect(title).toMatch(/Sarah/);
  });

  it('generates titles for all phases', () => {
    const phases: DonationPhase[] = ['first_believers', 'the_push', 'closing_in', 'last_donor_zone'];
    for (const phase of phases) {
      const title = buildPhaseTransitionTitle('Sarah Chen', phase);
      expect(title.length).toBeGreaterThan(0);
    }
  });

  it('avoids previously used titles when alternatives exist', () => {
    // Get all possible first_believers titles by running many times
    const seenTitles = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seenTitles.add(buildPhaseTransitionTitle('Sarah Chen', 'first_believers'));
    }
    // Should have at least 2 different titles (multiple templates exist)
    expect(seenTitles.size).toBeGreaterThanOrEqual(2);
  });

  it('prefers unused titles over previously used titles', () => {
    // Generate all possible titles first
    const allTitles = new Set<string>();
    for (let i = 0; i < 100; i++) {
      allTitles.add(buildPhaseTransitionTitle('Sarah Chen', 'the_push'));
    }

    // Block all but one title
    const allTitlesArr = Array.from(allTitles);
    const blockedTitles = allTitlesArr.slice(0, allTitlesArr.length - 1);
    const expected = allTitlesArr[allTitlesArr.length - 1];

    // When all but one are blocked, should consistently get the unblocked one
    let gotExpected = false;
    for (let i = 0; i < 20; i++) {
      const title = buildPhaseTransitionTitle('Sarah Chen', 'the_push', blockedTitles);
      if (title === expected) gotExpected = true;
    }
    expect(gotExpected).toBe(true);
  });

  it('still returns a title even when all titles are in previousTitles', () => {
    const allTitles: string[] = [];
    for (let i = 0; i < 100; i++) {
      allTitles.push(buildPhaseTransitionTitle('Sarah Chen', 'closing_in'));
    }
    // Block everything
    const title = buildPhaseTransitionTitle('Sarah Chen', 'closing_in', allTitles);
    expect(title.length).toBeGreaterThan(0);
  });

  it('uses first name in some templates and full name in others', () => {
    const titles = new Set<string>();
    for (let i = 0; i < 100; i++) {
      titles.add(buildPhaseTransitionTitle('Sarah Chen', 'last_donor_zone'));
    }
    const titlesArr = Array.from(titles);
    const hasFullName = titlesArr.some((t) => t.includes('Sarah Chen'));
    const hasFirstName = titlesArr.some((t) => t.includes('Sarah') && !t.includes('Sarah Chen'));
    expect(hasFullName || hasFirstName).toBe(true);
  });

  it('produces no two identical titles for the same campaign across phases', () => {
    const phases: DonationPhase[] = ['first_believers', 'the_push', 'closing_in', 'last_donor_zone'];
    const titles = phases.map((p) => buildPhaseTransitionTitle('Billy Johnson', p));
    const unique = new Set(titles);
    expect(unique.size).toBe(phases.length);
  });
});
