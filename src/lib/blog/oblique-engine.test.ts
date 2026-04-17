/**
 * Oblique Engine Tests
 *
 * Tests for the Oblique Strategy Engine:
 *  - pickSeedWord determinism and distribution
 *  - generateObliqueBrief validation
 *  - formatObliqueConstraints output format
 *  - System/user prompt construction
 *  - Error handling for invalid AI responses
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockCallAI = vi.fn();

vi.mock('@/lib/ai/call-ai', () => ({
  callAI: (...args: unknown[]) => mockCallAI(...args),
}));

vi.mock('@/lib/ai/openrouter', () => ({
  ai: {},
}));

import {
  pickSeedWord,
  generateObliqueBrief,
  formatObliqueConstraints,
  type ObliqueBrief,
} from './oblique-engine';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeValidObliqueBrief(overrides?: Partial<ObliqueBrief>): ObliqueBrief {
  return {
    primalLaw: 'People searching for funeral help need permission to ask for money, not instructions on how to.',
    inversionConstraints: [
      'Never open with a statistic about funeral costs. Open with a human moment.',
      'Do not list steps sequentially. Present the emotional decision first, logistics second.',
      'Avoid passive language about grief. Use active language about agency.',
    ],
    obliqueStructuralRule: 'In section 3, present the strongest claim, then corrode it with a real objection before rebuilding stronger.',
    ctaParadox: 'Instead of asking the reader to donate, ask them to write one sentence about someone they wish they could help.',
    forbiddenList: [
      'Do not use the word "crisis" in the first 500 words',
      'Do not mention GoFundMe by name',
      'Do not use statistics older than 2023',
      'Do not include any numbered step-by-step list in the first section',
      'Do not end any section with a question',
    ],
    seedWord: 'rust',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. pickSeedWord
// ═══════════════════════════════════════════════════════════════════════════════

describe('pickSeedWord', () => {
  it('returns a string from the seed word list', () => {
    const validWords = [
      'rust', 'mirror', 'fermentation', 'scorpion', 'echo',
      'zero', 'knot', 'salt', 'sponge', 'fog',
      'fracture', 'tide', 'ember', 'hollow', 'orbit',
    ];
    const word = pickSeedWord('funeral fundraising');
    expect(validWords).toContain(word);
  });

  it('is deterministic: same keyword always returns the same word', () => {
    const word1 = pickSeedWord('funeral fundraising');
    const word2 = pickSeedWord('funeral fundraising');
    const word3 = pickSeedWord('funeral fundraising');
    expect(word1).toBe(word2);
    expect(word2).toBe(word3);
  });

  it('different keywords produce different seed words (probabilistic, high confidence)', () => {
    const keywords = [
      'funeral fundraising',
      'medical bills help',
      'disaster relief campaign',
      'education crowdfunding',
      'rent assistance emergency',
      'pet surgery fundraiser',
      'fire recovery donations',
    ];
    const words = keywords.map(pickSeedWord);
    const unique = new Set(words);
    // With 15 seed words and 7 keywords, expect at least 3 unique (very high probability)
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  it('handles empty string without throwing', () => {
    const word = pickSeedWord('');
    expect(typeof word).toBe('string');
    expect(word.length).toBeGreaterThan(0);
  });

  it('handles very long keywords', () => {
    const longKeyword = 'a'.repeat(10000);
    const word = pickSeedWord(longKeyword);
    expect(typeof word).toBe('string');
  });

  it('handles special characters in keyword', () => {
    const word = pickSeedWord('how to pay for a funeral (2024) $5,000+');
    expect(typeof word).toBe('string');
    expect(word.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. generateObliqueBrief
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateObliqueBrief', () => {
  beforeEach(() => {
    mockCallAI.mockReset();
  });

  it('calls callAI with correct promptType and parseJson', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief());

    await generateObliqueBrief({
      primaryKeyword: 'funeral fundraising',
      causeCategory: 'memorial',
    });

    expect(mockCallAI).toHaveBeenCalledOnce();
    const callArgs = mockCallAI.mock.calls[0][0];
    expect(callArgs.promptType).toBe('oblique_brief');
    expect(callArgs.parseJson).toBe(true);
    expect(callArgs.maxTokens).toBe(4096);
  });

  it('returns valid ObliqueBrief with seedWord populated', async () => {
    const expected = makeValidObliqueBrief();
    mockCallAI.mockResolvedValueOnce(expected);

    const result = await generateObliqueBrief({
      primaryKeyword: 'funeral fundraising',
      causeCategory: 'memorial',
    });

    expect(result.primalLaw).toBe(expected.primalLaw);
    expect(result.inversionConstraints).toHaveLength(3);
    expect(result.obliqueStructuralRule).toBe(expected.obliqueStructuralRule);
    expect(result.ctaParadox).toBe(expected.ctaParadox);
    expect(result.forbiddenList.length).toBeGreaterThanOrEqual(3);
    expect(typeof result.seedWord).toBe('string');
  });

  it('throws on missing primalLaw', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief({ primalLaw: '' }));

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('throws on wrong number of inversionConstraints', async () => {
    mockCallAI.mockResolvedValueOnce(
      makeValidObliqueBrief({
        inversionConstraints: ['only one'] as unknown as [string, string, string],
      }),
    );

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('throws on missing obliqueStructuralRule', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief({ obliqueStructuralRule: '' }));

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('throws on missing ctaParadox', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief({ ctaParadox: '' }));

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('throws on forbiddenList with fewer than 3 items', async () => {
    mockCallAI.mockResolvedValueOnce(
      makeValidObliqueBrief({ forbiddenList: ['one', 'two'] }),
    );

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('throws on non-array inversionConstraints', async () => {
    mockCallAI.mockResolvedValueOnce(
      makeValidObliqueBrief({
        inversionConstraints: 'not an array' as unknown as [string, string, string],
      }),
    );

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('throws on non-array forbiddenList', async () => {
    mockCallAI.mockResolvedValueOnce(
      makeValidObliqueBrief({
        forbiddenList: 'not an array' as unknown as string[],
      }),
    );

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('Oblique brief is missing required fields');
  });

  it('includes newsHook in user prompt when provided', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief());

    await generateObliqueBrief({
      primaryKeyword: 'funeral fundraising',
      causeCategory: 'memorial',
      newsHook: 'FEMA announces new funeral assistance program',
    });

    const callArgs = mockCallAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('FEMA announces new funeral assistance program');
  });

  it('includes targetAudience in user prompt when provided', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief());

    await generateObliqueBrief({
      primaryKeyword: 'funeral fundraising',
      causeCategory: 'memorial',
      targetAudience: 'Families who lost a loved one unexpectedly',
    });

    const callArgs = mockCallAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('Families who lost a loved one unexpectedly');
  });

  it('system prompt contains 3-phase framework', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief());

    await generateObliqueBrief({
      primaryKeyword: 'test',
      causeCategory: 'community',
    });

    const systemPrompt = mockCallAI.mock.calls[0][0].systemPrompt;
    expect(systemPrompt).toContain('PHASE 1');
    expect(systemPrompt).toContain('PHASE 2');
    expect(systemPrompt).toContain('PHASE 3');
    expect(systemPrompt).toContain('PRIMITIVE DECOMPOSITION');
    expect(systemPrompt).toContain('INVERSION');
    expect(systemPrompt).toContain('OBLIQUE CONSTRAINT');
  });

  it('user prompt contains the seed word', async () => {
    mockCallAI.mockResolvedValueOnce(makeValidObliqueBrief());

    await generateObliqueBrief({
      primaryKeyword: 'funeral fundraising',
      causeCategory: 'memorial',
    });

    const userPrompt = mockCallAI.mock.calls[0][0].userPrompt;
    const seedWord = pickSeedWord('funeral fundraising');
    expect(userPrompt).toContain(`"${seedWord}"`);
  });

  it('propagates callAI errors', async () => {
    mockCallAI.mockRejectedValueOnce(new Error('AI service unavailable'));

    await expect(
      generateObliqueBrief({ primaryKeyword: 'test', causeCategory: 'community' }),
    ).rejects.toThrow('AI service unavailable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. formatObliqueConstraints
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatObliqueConstraints', () => {
  it('includes all sections in output', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);

    expect(output).toContain('PRIMAL LAW:');
    expect(output).toContain('INVERSION CONSTRAINTS:');
    expect(output).toContain('OBLIQUE STRUCTURAL RULE:');
    expect(output).toContain('CTA PARADOX:');
    expect(output).toContain('FORBIDDEN IN THIS POST:');
  });

  it('includes the primal law text', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);
    expect(output).toContain(brief.primalLaw);
  });

  it('numbers the inversion constraints 1-3', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);
    expect(output).toContain('1. ' + brief.inversionConstraints[0]);
    expect(output).toContain('2. ' + brief.inversionConstraints[1]);
    expect(output).toContain('3. ' + brief.inversionConstraints[2]);
  });

  it('includes all forbidden list items with bullets', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);
    for (const item of brief.forbiddenList) {
      expect(output).toContain(`- ${item}`);
    }
  });

  it('includes the CTA paradox text', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);
    expect(output).toContain(brief.ctaParadox);
  });

  it('includes the oblique structural rule text', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);
    expect(output).toContain(brief.obliqueStructuralRule);
  });

  it('produces a string that starts with OBLIQUE CONSTRAINTS', () => {
    const brief = makeValidObliqueBrief();
    const output = formatObliqueConstraints(brief);
    expect(output.startsWith('OBLIQUE CONSTRAINTS')).toBe(true);
  });
});
