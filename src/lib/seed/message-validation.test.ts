import { describe, it, expect } from 'vitest';
import {
  validateMessages,
  levenshteinSimilarity,
  DOLLAR_AMOUNT_REGEX,
  MAX_MESSAGE_LENGTH,
  SIMILARITY_THRESHOLD,
} from '@/lib/seed/message-validation';

// ── levenshteinSimilarity ───────────────────────────────────────────────────

describe('levenshteinSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1.0);
  });

  it('returns 1.0 for identical strings ignoring case', () => {
    expect(levenshteinSimilarity('Hello', 'hello')).toBe(1.0);
  });

  it('returns 0 when one string is empty', () => {
    expect(levenshteinSimilarity('hello', '')).toBe(0);
    expect(levenshteinSimilarity('', 'hello')).toBe(0);
  });

  it('returns high similarity for nearly identical strings', () => {
    const sim = levenshteinSimilarity('Praying for you', 'Praying for ya');
    expect(sim).toBeGreaterThan(0.8);
  });

  it('returns low similarity for very different strings', () => {
    const sim = levenshteinSimilarity(
      'Stay strong brother',
      'God bless the whole family',
    );
    expect(sim).toBeLessThan(0.5);
  });

  it('is symmetric', () => {
    const a = 'one two three';
    const b = 'one two four';
    expect(levenshteinSimilarity(a, b)).toBe(levenshteinSimilarity(b, a));
  });
});

// ── DOLLAR_AMOUNT_REGEX ─────────────────────────────────────────────────────

describe('DOLLAR_AMOUNT_REGEX', () => {
  it('catches $25', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Gave $25 for the cause')).toBe(true);
  });

  it('catches $1,000', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Donated $1,000')).toBe(true);
  });

  it('catches $25.00', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Sent $25.00 your way')).toBe(true);
  });

  it('catches "50 dollars"', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Threw in 50 dollars')).toBe(true);
  });

  it('catches "100 bucks"', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Here are 100 bucks')).toBe(true);
  });

  it('does not catch generic text', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Stay strong brother')).toBe(false);
  });

  it('does not catch "dollar" without a number', () => {
    expect(DOLLAR_AMOUNT_REGEX.test('Worth every dollar of effort')).toBe(false);
  });
});

// ── validateMessages ────────────────────────────────────────────────────────

describe('validateMessages', () => {
  it('accepts valid short messages', () => {
    const messages = ['Stay strong!', 'God bless', 'Praying for you'];
    const result = validateMessages(messages, []);
    expect(result.valid).toEqual(messages);
    expect(result.rejected).toHaveLength(0);
  });

  it('rejects messages longer than MAX_MESSAGE_LENGTH', () => {
    const longMsg = 'A'.repeat(MAX_MESSAGE_LENGTH + 1);
    const result = validateMessages([longMsg, 'Short msg'], []);
    expect(result.valid).toEqual(['Short msg']);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe('too_long');
  });

  it('rejects messages containing dollar amounts', () => {
    const result = validateMessages(
      ['Gave $50 for the cause', 'Stay strong brother', 'Here are 100 bucks'],
      [],
    );
    expect(result.valid).toEqual(['Stay strong brother']);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected.every((r) => r.reason === 'dollar_amount')).toBe(true);
  });

  it('rejects messages too similar to existing messages', () => {
    const existing = ['Praying for you and your family'];
    const result = validateMessages(
      ['Praying for you and your family!', 'Completely different message'],
      existing,
    );
    // The first message is extremely similar to the existing one
    expect(result.valid).toContain('Completely different message');
    expect(result.rejected.some((r) => r.reason === 'too_similar')).toBe(true);
  });

  it('rejects duplicates within the same batch', () => {
    const result = validateMessages(
      ['Stay strong!', 'Stay strong!', 'Stay strong!'],
      [],
    );
    // First one passes, subsequent identical ones are rejected
    expect(result.valid).toEqual(['Stay strong!']);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected.every((r) => r.reason === 'too_similar')).toBe(true);
  });

  it('handles empty input', () => {
    const result = validateMessages([], ['existing message']);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it('handles empty strings by skipping them', () => {
    const result = validateMessages(['', '  ', 'Valid message'], []);
    expect(result.valid).toEqual(['Valid message']);
  });

  it('applies all three rules in priority order', () => {
    const longDollarMsg = '$50 ' + 'A'.repeat(300);
    const result = validateMessages([longDollarMsg], []);
    // Length check comes first, so it should be rejected for too_long
    expect(result.rejected[0].reason).toBe('too_long');
  });

  it('correctly handles a realistic batch', () => {
    const existing = [
      'Praying for the Johnson family',
      'Stay strong yall',
      'God bless from Texas',
    ];
    const newMessages = [
      'Sending love from Missouri',       // valid — different
      'Praying for the Johnson family!',   // rejected — too similar
      'Gave $25 for the kids',             // rejected — dollar amount
      'A'.repeat(300),                     // rejected — too long
      'Y\'all are in our hearts',          // valid
      'From one Joplin family to another', // valid
    ];
    const result = validateMessages(newMessages, existing);
    expect(result.valid.length).toBeGreaterThanOrEqual(3);
    expect(result.rejected.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('MAX_MESSAGE_LENGTH is 280', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(280);
  });

  it('SIMILARITY_THRESHOLD is 0.70', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.70);
  });
});
