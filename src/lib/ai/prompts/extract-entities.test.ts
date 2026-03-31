import { describe, it, expect } from 'vitest';
import { buildExtractEntitiesPrompt } from '@/lib/ai/prompts/extract-entities';
import type { CampaignCategory } from '@/types';

describe('buildExtractEntitiesPrompt', () => {
  const baseInput = {
    title: 'Family loses home in tornado',
    body: 'A family in Joplin, Missouri lost their home when a tornado struck on Tuesday. Jane Smith, 34, and her husband Tom were hospitalized.',
    category: 'disaster' as CampaignCategory,
  };

  it('returns systemPrompt and userPrompt', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('system prompt includes anti-fabrication rules for age', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('ONLY include the person\'s age if it is EXPLICITLY stated');
    expect(result.systemPrompt).toContain('NEVER estimate or guess an age');
  });

  it('system prompt includes anti-fabrication rules for family', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('ONLY include family members who are EXPLICITLY named');
    expect(result.systemPrompt).toContain('NEVER invent family members');
  });

  it('system prompt includes anti-fabrication rules for eventDate', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('ONLY include if a specific date is mentioned');
  });

  it('system prompt includes anti-fabrication rules for sourceUrl', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('EXACT full article URL');
    expect(result.systemPrompt).toContain('NEVER construct or shorten URLs');
  });

  it('system prompt includes confidence field instruction', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('"confidence"');
    expect(result.systemPrompt).toContain('Rate 0-100');
  });

  it('JSON schema includes confidence field', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('"confidence": number (0-100)');
  });

  it('user prompt contains the article title and body', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.userPrompt).toContain('Family loses home in tornado');
    expect(result.userPrompt).toContain('Jane Smith, 34');
  });

  it('user prompt contains the category', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.userPrompt).toContain('CATEGORY: disaster');
  });

  it('system prompt contains goal range for the category', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('$10,000');
    expect(result.systemPrompt).toContain('$30,000');
  });

  it('system prompt retains name validation rules', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('NEVER use a job title');
    expect(result.systemPrompt).toContain('NEVER return an empty string');
  });

  it('handles military category', () => {
    const result = buildExtractEntitiesPrompt({
      ...baseInput,
      category: 'military' as CampaignCategory,
    });
    expect(result.systemPrompt).toContain('$15,000');
    expect(result.systemPrompt).toContain('$50,000');
    expect(result.userPrompt).toContain('CATEGORY: military');
  });

  it('JSON schema shows empty array for family when none mentioned', () => {
    const result = buildExtractEntitiesPrompt(baseInput);
    expect(result.systemPrompt).toContain('empty array [] if none mentioned');
  });
});
