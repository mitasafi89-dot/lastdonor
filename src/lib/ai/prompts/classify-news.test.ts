import { describe, it, expect } from 'vitest';
import {
  buildClassifyNewsPrompt,
  CLASSIFY_SCORE_THRESHOLD,
} from '@/lib/ai/prompts/classify-news';

describe('buildClassifyNewsPrompt', () => {
  const baseInput = {
    title: 'Family loses home in tornado',
    body: 'A family in Joplin, Missouri lost their home when an EF3 tornado struck their neighborhood. Jane Smith, 34, was hospitalized with injuries.',
  };

  it('returns systemPrompt and userPrompt', () => {
    const result = buildClassifyNewsPrompt(baseInput);
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('user prompt contains the title', () => {
    const result = buildClassifyNewsPrompt(baseInput);
    expect(result.userPrompt).toContain('ARTICLE TITLE: Family loses home in tornado');
  });

  it('user prompt contains the body', () => {
    const result = buildClassifyNewsPrompt(baseInput);
    expect(result.userPrompt).toContain('Jane Smith, 34');
  });

  it('system prompt lists 8 core categories', () => {
    const result = buildClassifyNewsPrompt(baseInput);
    expect(result.systemPrompt).toContain('military');
    expect(result.systemPrompt).toContain('veterans');
    expect(result.systemPrompt).toContain('first-responders');
    expect(result.systemPrompt).toContain('disaster');
    expect(result.systemPrompt).toContain('medical');
    expect(result.systemPrompt).toContain('memorial');
    expect(result.systemPrompt).toContain('community');
    expect(result.systemPrompt).toContain('essential-needs');
  });

  it('system prompt contains criteria for high score', () => {
    const result = buildClassifyNewsPrompt(baseInput);
    expect(result.systemPrompt).toContain('Criteria for high score');
    expect(result.systemPrompt).toContain('identifiable person');
  });

  it('system prompt specifies JSON output format', () => {
    const result = buildClassifyNewsPrompt(baseInput);
    expect(result.systemPrompt).toContain('"score": number');
    expect(result.systemPrompt).toContain('"category":');
    expect(result.systemPrompt).toContain('"reason": string');
  });
});

describe('CLASSIFY_SCORE_THRESHOLD', () => {
  it('is 70', () => {
    expect(CLASSIFY_SCORE_THRESHOLD).toBe(70);
  });
});
