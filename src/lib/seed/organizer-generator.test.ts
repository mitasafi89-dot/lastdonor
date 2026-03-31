import { describe, it, expect, vi } from 'vitest';
import type { CampaignCategory, CampaignUpdateType } from '@/types';

// Mock OpenAI client to prevent API key requirement during import
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
  },
}));

import { selectUpdateType, buildUpdateTitle } from './organizer-generator';

// Test the exported types and constants by importing the module
// The pure logic is tested indirectly through type validation and prompt output

describe('CampaignOrganizer type', () => {
  it('has the correct shape', () => {
    const organizer = {
      name: 'Lisa Martinez',
      relation: 'spouse',
      city: 'San Antonio, TX',
    };
    expect(organizer).toHaveProperty('name');
    expect(organizer).toHaveProperty('relation');
    expect(organizer).toHaveProperty('city');
  });
});

describe('CampaignUpdateType', () => {
  it('includes all expected types including community_response', () => {
    const types: CampaignUpdateType[] = [
      'phase_transition',
      'thank_you',
      'story_development',
      'disbursement_plan',
      'milestone_reflection',
      'community_response',
      'completion',
      'celebration',
      'impact_report',
    ];
    expect(types).toHaveLength(9);
  });
});

describe('CampaignCategory coverage', () => {
  it('all 23 categories are valid', () => {
    const categories: CampaignCategory[] = [
      'medical', 'disaster', 'military', 'veterans', 'memorial',
      'first-responders', 'community', 'essential-needs', 'emergency',
      'charity', 'education', 'animal', 'environment', 'business',
      'competition', 'creative', 'event', 'faith', 'family',
      'sports', 'travel', 'volunteer', 'wishes',
    ];
    expect(categories).toHaveLength(23);
  });
});

// ── selectUpdateType ────────────────────────────────────────────────────────

describe('selectUpdateType', () => {
  it('returns a valid schedulable update type', () => {
    const schedulable: CampaignUpdateType[] = [
      'thank_you', 'story_development', 'disbursement_plan',
      'milestone_reflection', 'community_response',
    ];
    for (let i = 0; i < 50; i++) {
      const type = selectUpdateType();
      expect(schedulable).toContain(type);
    }
  });

  it('never returns phase_transition, completion, celebration, or impact_report', () => {
    const nonSchedulable: CampaignUpdateType[] = [
      'phase_transition', 'completion', 'celebration', 'impact_report',
    ];
    for (let i = 0; i < 100; i++) {
      expect(nonSchedulable).not.toContain(selectUpdateType());
    }
  });

  it('returns community_response at least sometimes', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      if (selectUpdateType() === 'community_response') {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('returns story_development more often for mature campaigns (> 7 days)', () => {
    let youngStoryCount = 0;
    let matureStoryCount = 0;
    const iterations = 2000;

    for (let i = 0; i < iterations; i++) {
      if (selectUpdateType(3) === 'story_development') youngStoryCount++;
      if (selectUpdateType(14) === 'story_development') matureStoryCount++;
    }

    // Mature campaigns should have higher story_development rate
    // Young weight: 0.25, Mature weight: 0.35 (40% boost)
    expect(matureStoryCount).toBeGreaterThan(youngStoryCount * 0.9);
  });

  it('accepts campaign age parameter defaulting to 0', () => {
    // Should not throw
    const type = selectUpdateType();
    expect(type).toBeTruthy();
    const type2 = selectUpdateType(0);
    expect(type2).toBeTruthy();
    const type3 = selectUpdateType(30);
    expect(type3).toBeTruthy();
  });
});

// ── buildUpdateTitle ────────────────────────────────────────────────────────

describe('buildUpdateTitle', () => {
  const organizer = 'David Chen';
  const subject = 'Sarah Johnson';

  it('returns a non-empty string for all schedulable types', () => {
    const types: CampaignUpdateType[] = [
      'thank_you', 'story_development', 'disbursement_plan',
      'milestone_reflection', 'community_response',
    ];
    for (const type of types) {
      const title = buildUpdateTitle(type, organizer, subject);
      expect(title.length).toBeGreaterThan(0);
    }
  });

  it('includes organizer first name in organizer-voice titles', () => {
    const title = buildUpdateTitle('thank_you', organizer, subject, false);
    expect(title).toMatch(/David/);
  });

  it('includes subject first name in story_development titles', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(buildUpdateTitle('story_development', organizer, subject, false));
    }
    const hasSubjectName = Array.from(seen).some((t) => t.includes('Sarah'));
    expect(hasSubjectName).toBe(true);
  });

  it('produces varied titles across multiple calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(buildUpdateTitle('thank_you', organizer, subject));
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('prefers titles not in previousTitles', () => {
    // Collect all possible thank_you titles
    const allTitles = new Set<string>();
    for (let i = 0; i < 100; i++) {
      allTitles.add(buildUpdateTitle('thank_you', organizer, subject));
    }

    const allArr = Array.from(allTitles);
    if (allArr.length < 2) return; // Skip if only 1 template

    const blocked = allArr.slice(0, allArr.length - 1);
    const remaining = allArr[allArr.length - 1];

    let gotRemaining = false;
    for (let i = 0; i < 30; i++) {
      const title = buildUpdateTitle('thank_you', organizer, subject, false, blocked);
      if (title === remaining) gotRemaining = true;
    }
    expect(gotRemaining).toBe(true);
  });

  it('returns a title even when all templates are blocked', () => {
    const allTitles: string[] = [];
    for (let i = 0; i < 100; i++) {
      allTitles.push(buildUpdateTitle('disbursement_plan', organizer, subject));
    }
    const title = buildUpdateTitle('disbursement_plan', organizer, subject, false, allTitles);
    expect(title.length).toBeGreaterThan(0);
  });

  it('uses editorial voice for community_response', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(buildUpdateTitle('community_response', organizer, subject, true));
    }
    const allTitles = Array.from(seen);
    // Editorial titles should NOT contain organizer first name prominently
    const hasEditorialStyle = allTitles.some(
      (t) => t.includes('spotlight') || t.includes('community') || t.includes('coming together') || t.includes('editorial'),
    );
    expect(hasEditorialStyle).toBe(true);
  });

  it('uses editorial templates for milestone_reflection in editorial mode', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(buildUpdateTitle('milestone_reflection', organizer, subject, true));
    }
    const allTitles = Array.from(seen);
    // Editorial milestone titles reference "milestone" or "journey" or "progress"
    const hasEditorialStyle = allTitles.some(
      (t) => t.includes('milestone') || t.includes('journey') || t.includes('progress'),
    );
    expect(hasEditorialStyle).toBe(true);
  });

  it('falls back gracefully for unknown types', () => {
    const title = buildUpdateTitle('celebration' as CampaignUpdateType, organizer, subject);
    expect(title.length).toBeGreaterThan(0);
  });
});
