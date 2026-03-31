import { describe, it, expect } from 'vitest';
import { generateSlug } from '@/lib/utils/slug';

describe('generateSlug', () => {
  it('converts normal title to slug', () => {
    expect(generateSlug('Help the Johnson Family')).toBe('help-the-johnson-family');
  });

  it('strips special characters', () => {
    expect(generateSlug("Mike's Recovery: A Story!")).toBe('mikes-recovery-a-story');
  });

  it('collapses multiple spaces to single hyphen', () => {
    expect(generateSlug('Too   many   spaces')).toBe('too-many-spaces');
  });

  it('collapses multiple hyphens to single hyphen', () => {
    expect(generateSlug('hello---world')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('--hello world--')).toBe('hello-world');
  });

  it('truncates to 100 characters max', () => {
    const longTitle = 'a'.repeat(150);
    const slug = generateSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(100);
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('converts to lowercase', () => {
    expect(generateSlug('ALL CAPS TITLE')).toBe('all-caps-title');
  });

  it('preserves numbers', () => {
    expect(generateSlug('Campaign 2026 for Unit 42')).toBe('campaign-2026-for-unit-42');
  });

  it('handles string with only special characters', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('');
  });

  it('handles unicode characters by stripping them', () => {
    expect(generateSlug('Héro campaña')).toBe('hro-campaa');
  });
});
