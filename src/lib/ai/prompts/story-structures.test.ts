import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scoreContextRichness,
  getWordRange,
  selectStoryPattern,
  PATTERN_DEFINITIONS,
  type StoryPattern,
  type ContextRichness,
} from '@/lib/ai/prompts/story-structures';
import type { ExtractedEntity } from '@/lib/ai/prompts/extract-entities';
import type { CampaignCategory } from '@/types';

// ── Helper: build entity with controlled fields ─────────────────────────────

function makeEntity(overrides: Partial<ExtractedEntity> = {}): ExtractedEntity {
  return {
    name: 'John Doe',
    event: 'House fire',
    hometown: 'Springfield, IL',
    family: [],
    category: 'disaster' as CampaignCategory,
    suggestedGoal: 10000,
    sourceUrl: 'https://example.com/article',
    sourceName: 'Local News',
    confidence: 75,
    ...overrides,
  };
}

// ── scoreContextRichness ────────────────────────────────────────────────────

describe('scoreContextRichness', () => {
  it('returns "minimal" for a bare entity (no optional fields)', () => {
    const entity = makeEntity({ hometown: 'Unknown' });
    expect(scoreContextRichness(entity)).toBe('minimal');
  });

  it('returns "minimal" when only 1-2 optional fields are set', () => {
    const entity = makeEntity({ age: 30 });
    // age=1, hometown!=Unknown=1 → 2 → minimal
    expect(scoreContextRichness(entity)).toBe('minimal');
  });

  it('returns "moderate" when 3-4 optional fields are set', () => {
    const entity = makeEntity({
      age: 30,
      eventDate: '2024-01-15',
      family: [{ name: 'Jane', relation: 'spouse' }],
    });
    // age=1, eventDate=1, family>=1=1, hometown!=Unknown=1 → 4 → moderate
    expect(scoreContextRichness(entity)).toBe('moderate');
  });

  it('returns "rich" when 5+ optional fields are set', () => {
    const entity = makeEntity({
      age: 30,
      eventDate: '2024-01-15',
      unit: 'Engine 7',
      department: 'Springfield FD',
      family: [
        { name: 'Jane', relation: 'spouse' },
        { name: 'Billy', relation: 'son', age: 5 },
        { name: 'Sara', relation: 'daughter', age: 3 },
      ],
    });
    // age=1, eventDate=1, unit=1, department=1, family>=1=1, family>=3=1, hometown=1 → 7 → rich
    expect(scoreContextRichness(entity)).toBe('rich');
  });

  it('counts family bonus only when family has 3+ members', () => {
    const twoFamilyEntity = makeEntity({
      age: 30,
      eventDate: '2024-01-15',
      unit: 'Unit A',
      family: [
        { name: 'Jane', relation: 'spouse' },
        { name: 'Billy', relation: 'son' },
      ],
    });
    // age=1, eventDate=1, unit=1, family>=1=1, hometown=1 → 5 → rich
    expect(scoreContextRichness(twoFamilyEntity)).toBe('rich');

    const threeFamilyEntity = makeEntity({
      age: 30,
      eventDate: '2024-01-15',
      family: [
        { name: 'Jane', relation: 'spouse' },
        { name: 'Billy', relation: 'son' },
        { name: 'Sara', relation: 'daughter' },
      ],
    });
    // age=1, eventDate=1, family>=1=1, family>=3=1, hometown=1 → 5 → rich
    expect(scoreContextRichness(threeFamilyEntity)).toBe('rich');
  });

  it('treats empty family array as 0 points', () => {
    const entity = makeEntity({ family: [] });
    // hometown=1 → 1 → minimal
    expect(scoreContextRichness(entity)).toBe('minimal');
  });
});

// ── getWordRange ────────────────────────────────────────────────────────────

describe('getWordRange', () => {
  it('returns 75-120 for minimal', () => {
    const range = getWordRange('minimal');
    expect(range).toEqual({ min: 75, max: 120 });
  });

  it('returns 150-200 for moderate', () => {
    const range = getWordRange('moderate');
    expect(range).toEqual({ min: 150, max: 200 });
  });

  it('returns 200-300 for rich', () => {
    const range = getWordRange('rich');
    expect(range).toEqual({ min: 200, max: 300 });
  });
});

// ── selectStoryPattern ──────────────────────────────────────────────────────

describe('selectStoryPattern', () => {
  it('returns a valid StoryPattern for every category', () => {
    const categories: CampaignCategory[] = [
      'medical', 'disaster', 'military', 'veterans', 'memorial',
      'first-responders', 'community', 'essential-needs', 'emergency',
      'charity', 'education', 'animal', 'environment', 'business',
      'competition', 'creative', 'event', 'faith', 'family',
      'sports', 'travel', 'volunteer', 'wishes',
    ];

    const validPatterns: StoryPattern[] = [
      'chronological', 'character-first', 'in-medias-res',
      'community-voice', 'quiet-dignity', 'impact-forward',
    ];

    for (const category of categories) {
      const pattern = selectStoryPattern(category);
      expect(validPatterns).toContain(pattern);
    }
  });

  it('applies anti-repetition by reducing weight of recent patterns', () => {
    // Run many selections with the same recent patterns blocked
    // The blocked pattern should appear less frequently
    const category: CampaignCategory = 'medical';
    const blockedPattern: StoryPattern = 'character-first'; // highest weight for medical

    const counts: Record<StoryPattern, number> = {
      'chronological': 0, 'character-first': 0, 'in-medias-res': 0,
      'community-voice': 0, 'quiet-dignity': 0, 'impact-forward': 0,
    };

    const unblockedCounts: Record<StoryPattern, number> = { ...counts };

    // Run 1000 trials with and without blocking
    for (let i = 0; i < 1000; i++) {
      const blocked = selectStoryPattern(category, [blockedPattern]);
      counts[blocked]++;

      const unblocked = selectStoryPattern(category, []);
      unblockedCounts[unblocked]++;
    }

    // Blocked pattern should appear less often than unblocked
    expect(counts[blockedPattern]).toBeLessThan(unblockedCounts[blockedPattern]);
  });

  it('never returns undefined or throws for any category', () => {
    const categories: CampaignCategory[] = [
      'medical', 'disaster', 'military', 'veterans', 'memorial',
      'first-responders', 'community', 'essential-needs', 'emergency',
      'charity', 'education', 'animal', 'environment', 'business',
      'competition', 'creative', 'event', 'faith', 'family',
      'sports', 'travel', 'volunteer', 'wishes',
    ];

    for (const category of categories) {
      expect(() => selectStoryPattern(category)).not.toThrow();
      expect(selectStoryPattern(category)).toBeDefined();
    }
  });
});

// ── PATTERN_DEFINITIONS ─────────────────────────────────────────────────────

describe('PATTERN_DEFINITIONS', () => {
  const allPatterns: StoryPattern[] = [
    'chronological', 'character-first', 'in-medias-res',
    'community-voice', 'quiet-dignity', 'impact-forward',
  ];

  it('defines all 6 patterns', () => {
    for (const pattern of allPatterns) {
      expect(PATTERN_DEFINITIONS[pattern]).toBeDefined();
    }
  });

  it('each pattern has a non-empty name, description, and psychologicalNote', () => {
    for (const pattern of allPatterns) {
      const def = PATTERN_DEFINITIONS[pattern];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.psychologicalNote.length).toBeGreaterThan(0);
    }
  });

  it('each pattern has 4-5 sections', () => {
    for (const pattern of allPatterns) {
      const def = PATTERN_DEFINITIONS[pattern];
      expect(def.sections.length).toBeGreaterThanOrEqual(4);
      expect(def.sections.length).toBeLessThanOrEqual(5);
    }
  });

  it('each section has unique id, title, and instruction', () => {
    for (const pattern of allPatterns) {
      const def = PATTERN_DEFINITIONS[pattern];
      const ids = def.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length); // unique IDs

      for (const section of def.sections) {
        expect(section.id.length).toBeGreaterThan(0);
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.instruction.length).toBeGreaterThan(0);
      }
    }
  });

  it('each pattern has non-empty formattingGuidance', () => {
    for (const pattern of allPatterns) {
      expect(PATTERN_DEFINITIONS[pattern].formattingGuidance.length).toBeGreaterThan(0);
    }
  });
});
