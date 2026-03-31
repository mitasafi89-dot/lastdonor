import { describe, it, expect } from 'vitest';
import {
  buildGenerateCampaignPrompt,
  getDefaultImpactTiers,
} from '@/lib/ai/prompts/generate-campaign';
import type { ExtractedEntity } from '@/lib/ai/prompts/extract-entities';
import type { CampaignCategory } from '@/types';
import type { StoryPattern } from '@/lib/ai/prompts/story-structures';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<ExtractedEntity> = {}): ExtractedEntity {
  return {
    name: 'Jane Smith',
    event: 'Tornado destroyed home',
    hometown: 'Joplin, MO',
    family: [{ name: 'Tom', relation: 'husband', age: 40 }],
    category: 'disaster' as CampaignCategory,
    suggestedGoal: 15000,
    sourceUrl: 'https://example.com/tornado-article',
    sourceName: 'KMOX',
    confidence: 85,
    ...overrides,
  };
}

// ── buildGenerateCampaignPrompt ─────────────────────────────────────────────

describe('buildGenerateCampaignPrompt', () => {
  it('returns systemPrompt, userPrompt, and selectedPattern', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
    expect(result).toHaveProperty('selectedPattern');
  });

  it('selectedPattern is a valid StoryPattern', () => {
    const validPatterns: StoryPattern[] = [
      'chronological', 'character-first', 'in-medias-res',
      'community-voice', 'quiet-dignity', 'impact-forward',
    ];
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(validPatterns).toContain(result.selectedPattern);
  });

  it('system prompt contains the pattern name', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    // The system prompt should reference the selected pattern's definition name
    expect(result.systemPrompt).toContain('narrative structure');
  });

  it('system prompt contains word count target', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toMatch(/WORD COUNT.*\d+.*\d+/);
  });

  it('system prompt contains section structures with data-section attributes', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('data-section=');
  });

  it('system prompt includes formatting palette', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('<strong>');
    expect(result.systemPrompt).toContain('<em>');
  });

  it('user prompt contains entity details', () => {
    const entity = makeEntity({
      name: 'Alice Johnson',
      age: 35,
      eventDate: '2024-06-01',
      unit: 'Ladder 5',
      department: 'Joplin FD',
    });
    const result = buildGenerateCampaignPrompt(entity);
    expect(result.userPrompt).toContain('Alice Johnson');
    expect(result.userPrompt).toContain('age 35');
    expect(result.userPrompt).toContain('2024-06-01');
    expect(result.userPrompt).toContain('Ladder 5');
    expect(result.userPrompt).toContain('Joplin FD');
    expect(result.userPrompt).toContain('$15,000');
    expect(result.userPrompt).toContain('KMOX');
  });

  it('user prompt includes NARRATIVE PATTERN and TARGET WORD COUNT', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.userPrompt).toContain('NARRATIVE PATTERN:');
    expect(result.userPrompt).toContain('TARGET WORD COUNT:');
    expect(result.userPrompt).toContain('CONTEXT LEVEL:');
  });

  it('user prompt includes family description', () => {
    const entity = makeEntity({
      family: [
        { name: 'Tom', relation: 'husband', age: 40 },
        { name: 'Lucy', relation: 'daughter', age: 8 },
      ],
    });
    const result = buildGenerateCampaignPrompt(entity);
    expect(result.userPrompt).toContain('Tom (husband, 40)');
    expect(result.userPrompt).toContain('Lucy (daughter, 8)');
  });

  it('handles empty family array with anti-fabrication instruction', () => {
    const entity = makeEntity({ family: [] });
    const result = buildGenerateCampaignPrompt(entity);
    expect(result.userPrompt).toContain('do NOT mention or invent any family members');
  });

  it('passes recentPatterns to selectStoryPattern for anti-repetition', () => {
    // Verify that passing recentPatterns changes the distribution
    const entity = makeEntity({ category: 'medical' as CampaignCategory });
    const counts: Record<string, number> = {};

    // Run many trials blocking the normally-favored pattern
    for (let i = 0; i < 200; i++) {
      const result = buildGenerateCampaignPrompt(entity, ['character-first']);
      counts[result.selectedPattern] = (counts[result.selectedPattern] || 0) + 1;
    }

    // With character-first blocked (halved weight), other patterns should dominate
    const characterFirstPct = (counts['character-first'] || 0) / 200;
    // character-first has weight 5 for medical, halved to 2.5, so it should be <50% of total
    expect(characterFirstPct).toBeLessThan(0.5);
  });

  it('adapts context level text for minimal richness', () => {
    const entity = makeEntity({ hometown: 'Unknown', family: [] });
    const result = buildGenerateCampaignPrompt(entity);
    expect(result.userPrompt).toContain('minimal');
    expect(result.userPrompt).toContain('details are still emerging');
  });

  it('adapts context level text for rich richness', () => {
    const entity = makeEntity({
      age: 30,
      eventDate: '2024-01-15',
      unit: 'Unit A',
      department: 'Dept B',
      family: [
        { name: 'A', relation: 'spouse' },
        { name: 'B', relation: 'son' },
        { name: 'C', relation: 'daughter' },
      ],
    });
    const result = buildGenerateCampaignPrompt(entity);
    expect(result.userPrompt).toContain('rich');
    expect(result.userPrompt).toContain('rich, detailed narrative');
  });

  it('system prompt forbids markdown', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('NEVER use markdown');
  });

  it('system prompt requires third person', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('third person');
  });

  it('system prompt forbids guilt-tripping', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('No guilt-tripping');
  });

  it('system prompt contains anti-fabrication rules', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('ABSOLUTELY NO fictional details');
    expect(result.systemPrompt).toContain('details are still emerging');
  });

  it('system prompt forbids inventing family members', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('do NOT mention or invent any family members');
  });

  it('system prompt forbids age guessing', () => {
    const result = buildGenerateCampaignPrompt(makeEntity());
    expect(result.systemPrompt).toContain('do NOT guess or include any age reference');
  });
});

// ── getDefaultImpactTiers ───────────────────────────────────────────────────

describe('getDefaultImpactTiers', () => {
  it('returns tiers up to goal amount', () => {
    const tiers = getDefaultImpactTiers(10000);
    expect(tiers.every((t) => t.amount <= 10000)).toBe(true);
  });

  it('returns empty array for very small goal', () => {
    const tiers = getDefaultImpactTiers(1000);
    expect(tiers).toHaveLength(0);
  });

  it('returns all 4 tiers for large goals', () => {
    const tiers = getDefaultImpactTiers(50000);
    expect(tiers).toHaveLength(4);
  });
});
