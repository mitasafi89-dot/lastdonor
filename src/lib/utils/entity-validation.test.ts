import { describe, it, expect } from 'vitest';
import {
  isValidEntityName,
  normalizeSubjectName,
  normalizeLocation,
} from '@/lib/utils/entity-validation';

// ── isValidEntityName ─────────────────────────────────────────────────────

describe('isValidEntityName', () => {
  it('accepts a normal person name', () => {
    expect(isValidEntityName('Jane Smith', 'Tornado leaves trail of destruction')).toBe(true);
  });

  it('accepts a name with rank prefix', () => {
    expect(isValidEntityName('Sgt. James Lee', 'Soldier killed in action')).toBe(true);
  });

  it('accepts a descriptive identifier', () => {
    expect(isValidEntityName('The Torres Family', 'Fire displaces Torres family')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEntityName('', 'Some headline')).toBe(false);
  });

  it('rejects headline verbs', () => {
    expect(isValidEntityName('Soldier killed', 'Soldier killed in action')).toBe(false);
  });

  it('rejects strings with digits', () => {
    expect(isValidEntityName('3rd victim', 'Three victims found')).toBe(false);
  });

  it('rejects names longer than 6 words', () => {
    expect(
      isValidEntityName(
        'John Michael David Thomas William Edward James',
        'Some article',
      ),
    ).toBe(false);
  });

  it('rejects ALL CAPS event codes', () => {
    expect(isValidEntityName('MORRILL COTTONWOOD FIRE', 'Wild fire alert')).toBe(false);
  });

  it('rejects when name is substring of title (headline copy)', () => {
    expect(
      isValidEntityName(
        'tornado leaves trail of destruction',
        'Tornado leaves trail of destruction in Midwest',
      ),
    ).toBe(false);
  });
});

// ── normalizeSubjectName ────────────────────────────────────────────────────

describe('normalizeSubjectName', () => {
  it('lowercases the name', () => {
    expect(normalizeSubjectName('John DOE')).toBe('john doe');
  });

  it('strips military rank prefix', () => {
    expect(normalizeSubjectName('Sgt. James Lee')).toBe('james lee');
  });

  it('strips middle initial', () => {
    expect(normalizeSubjectName('Nicole M. Amor')).toBe('nicole amor');
  });

  it('strips suffix', () => {
    expect(normalizeSubjectName('James Williams Jr.')).toBe('james williams');
  });

  it('strips compound rank like "Sgt."', () => {
    expect(normalizeSubjectName('Sgt. Robert Chen')).toBe('robert chen');
  });

  it('strips full rank word "Sergeant"', () => {
    expect(normalizeSubjectName('Sergeant Robert Chen')).toBe('robert chen');
  });

  it('handles already-normalized input', () => {
    expect(normalizeSubjectName('alice johnson')).toBe('alice johnson');
  });
});

// ── normalizeLocation ───────────────────────────────────────────────────────

describe('normalizeLocation', () => {
  it('expands St. to Saint', () => {
    expect(normalizeLocation('St. Louis, MO')).toBe('saint louis, missouri');
  });

  it('expands Ft. to Fort', () => {
    expect(normalizeLocation('Ft. Worth, TX')).toBe('fort worth, texas');
  });

  it('expands Mt. to Mount', () => {
    expect(normalizeLocation('Mt. Vernon, NY')).toBe('mount vernon, new york');
  });

  it('expands state abbreviation at end', () => {
    expect(normalizeLocation('Springfield, IL')).toBe('springfield, illinois');
  });

  it('preserves full state name', () => {
    expect(normalizeLocation('Springfield, Illinois')).toBe('springfield, illinois');
  });

  it('handles DC', () => {
    expect(normalizeLocation('Washington, DC')).toBe('washington, district of columbia');
  });

  it('handles multiple abbreviations', () => {
    expect(normalizeLocation('N. Ft. Myers, FL')).toBe('north fort myers, florida');
  });

  it('normalizes whitespace', () => {
    expect(normalizeLocation('  San   Diego ,  CA  ')).toBe('san diego , california');
  });

  it('handles city without state', () => {
    expect(normalizeLocation('Springfield')).toBe('springfield');
  });

  it('handles unknown', () => {
    expect(normalizeLocation('Unknown')).toBe('unknown');
  });
});
