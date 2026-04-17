import { describe, it, expect } from 'vitest';
import { validateHeadline, buildFallbackTitle } from '@/lib/ai/prompts/generate-headline';

// ── validateHeadline ──────────────────────────────────────────────────────

describe('validateHeadline', () => {
  const articleTitle = 'Tornado destroys homes in Oklahoma';
  const recentTitles: string[] = [];

  // ── Length rules ──

  it('rejects headlines shorter than 20 chars', () => {
    const result = validateHeadline('Too Short', articleTitle, recentTitles);
    expect(result.rejected).toBe(true);
  });

  it('rejects headlines longer than 80 chars', () => {
    const result = validateHeadline(
      'This Is An Extremely Long Headline That Exceeds the Maximum Character Limit of Eighty Characters',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });

  // ── Banned prefixes (always rejected) ──

  it('rejects titles starting with "Donate"', () => {
    const result = validateHeadline('Donate to the Rivera Family Fund', articleTitle, recentTitles);
    expect(result.rejected).toBe(true);
  });

  it('rejects titles starting with "Please"', () => {
    const result = validateHeadline('Please Consider Helping the Chen Family', articleTitle, recentTitles);
    expect(result.rejected).toBe(true);
  });

  it('rejects titles starting with "Give"', () => {
    const result = validateHeadline('Give to the Martinez Recovery Effort', articleTitle, recentTitles);
    expect(result.rejected).toBe(true);
  });

  // ── Conditional prefixes: "Help"/"Support" ──

  it('accepts "Help" when followed by a proper noun + outcome', () => {
    const result = validateHeadline(
      'Help Maria Gonzalez Access Life-Saving Treatment',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(false);
  });

  it('accepts "Support" when followed by a proper noun', () => {
    const result = validateHeadline(
      'Support the Rivera Family Through Recovery',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(false);
  });

  it('accepts "Stand with" when followed by a proper noun', () => {
    const result = validateHeadline(
      'Stand with James as He Rebuilds After the Flood',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(false);
  });

  it('rejects "Help" without a proper noun (lowercase)', () => {
    const result = validateHeadline(
      'Help a family recover from disaster',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
    if (result.rejected) {
      expect(result.reason).toContain('proper noun');
    }
  });

  it('rejects "Support" without a proper noun', () => {
    const result = validateHeadline(
      'Support the community after the fire',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });

  it('rejects "Help" with a generic word (not capitalized name)', () => {
    const result = validateHeadline(
      'Help someone get back on their feet',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });

  // ── Editorial archetypes still work ──

  it('accepts editorial archetype (Name + Journey)', () => {
    const result = validateHeadline(
      'Officer Chen Faces His Toughest Battle Yet',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(false);
  });

  it('accepts editorial archetype (After + Loss)', () => {
    const result = validateHeadline(
      'After the Northridge Fire, a Family Has Nothing Left',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(false);
  });

  // ── Headline verb rejection ──

  it('rejects headlines with violent verbs', () => {
    const result = validateHeadline(
      'Soldier Killed in Training Accident at Fort Liberty',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });

  // ── Article title overlap ──

  it('rejects >50% overlap with article title', () => {
    const result = validateHeadline(
      'Tornado Destroys Many Homes in Oklahoma City',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });

  // ── Recent title overlap ──

  it('rejects >60% overlap with recent title', () => {
    const result = validateHeadline(
      'Downers Grove Rallies Behind Sarah Chen',
      articleTitle,
      ['Downers Grove Rallies Behind Daniel Figueroa'],
    );
    expect(result.rejected).toBe(true);
  });

  // ── ALL CAPS rejection ──

  it('rejects ALL CAPS words', () => {
    const result = validateHeadline(
      'MORRILL Community Stands Together for Recovery',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });

  // ── Exclamation mark rejection ──

  it('rejects exclamation marks', () => {
    const result = validateHeadline(
      'Help Maria Gonzalez Fight Cancer Now!',
      articleTitle,
      recentTitles,
    );
    expect(result.rejected).toBe(true);
  });
});

// ── buildFallbackTitle ────────────────────────────────────────────────────

describe('buildFallbackTitle', () => {
  // ── Solemn categories ──

  it('uses dignified framing for military with hometown', () => {
    const title = buildFallbackTitle('Sgt. James Lee', 'Fort Liberty, NC', 'military');
    expect(title).toBe('Fort Liberty, NC Honors Sgt. James Lee');
  });

  it('uses dignified framing for memorial without hometown', () => {
    const title = buildFallbackTitle('David Chen', 'Unknown', 'memorial');
    expect(title).toBe('Remembering David Chen');
  });

  it('uses dignified framing for veterans without hometown', () => {
    const title = buildFallbackTitle('Robert Thompson', 'Unknown', 'veterans');
    expect(title).toBe('Standing with Veteran Robert Thompson');
  });

  it('uses dignified framing for first-responders without hometown', () => {
    const title = buildFallbackTitle('Officer Daniels', 'Unknown', 'first-responders');
    expect(title).toBe('Rallying Behind Officer Daniels');
  });

  // ── Warm/invitation categories ──

  it('uses "Help" for medical with hometown', () => {
    const title = buildFallbackTitle('Maria Gonzalez', 'Los Angeles, CA', 'medical');
    expect(title).toBe('Help Maria Gonzalez Rebuild in Los Angeles, CA');
  });

  it('uses "Support" for medical without hometown', () => {
    const title = buildFallbackTitle('Maria Gonzalez', 'Unknown', 'medical');
    expect(title).toBe('Support Maria Gonzalez Through This Difficult Time');
  });

  it('uses "Help" for disaster without hometown', () => {
    const title = buildFallbackTitle('The Johnson Family', 'Unknown', 'disaster');
    expect(title).toBe('Help The Johnson Family Through This Difficult Time');
  });

  it('uses "Help" for emergency without hometown', () => {
    const title = buildFallbackTitle('Sarah Lee', 'Unknown', 'emergency');
    expect(title).toBe('Help Sarah Lee Through This Difficult Time');
  });

  it('uses "Stand with" for community without hometown', () => {
    const title = buildFallbackTitle('The Okafor Family', 'Unknown', 'community');
    expect(title).toBe('Stand with The Okafor Family Through This Difficult Time');
  });

  it('uses default "Support" for unknown categories', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title = buildFallbackTitle('Jane Doe', 'Unknown', 'competition' as any);
    expect(title).toContain('Support');
    expect(title).toContain('Jane Doe');
  });
});
