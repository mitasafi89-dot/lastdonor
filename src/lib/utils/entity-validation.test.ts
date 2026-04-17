import { describe, it, expect } from 'vitest';
import {
  isValidEntityName,
  validateEntityName,
  normalizeSubjectName,
  normalizeLocation,
  isValidLocation,
  validateLocation,
  validateCampaignQuality,
} from '@/lib/utils/entity-validation';

// ── isValidEntityName ─────────────────────────────────────────────────────

describe('isValidEntityName', () => {
  // ── Accepts real names ─────────────────────────────────────────────────
  it('accepts a normal person name', () => {
    expect(isValidEntityName('Jane Smith', 'Tornado leaves trail of destruction')).toBe(true);
  });

  it('accepts a name with rank prefix', () => {
    expect(isValidEntityName('Sgt. James Lee', 'Soldier killed in action')).toBe(true);
  });

  it('accepts a family name pattern', () => {
    expect(isValidEntityName('The Torres Family', 'Fire displaces Torres family')).toBe(true);
  });

  it('accepts a two-word proper name', () => {
    expect(isValidEntityName('Maria Gonzalez', 'Car accident in Austin')).toBe(true);
  });

  it('accepts Officer + surname', () => {
    expect(isValidEntityName('Officer Chen', 'Officer Chen responds to fire')).toBe(true);
  });

  it('accepts name with middle initial', () => {
    expect(isValidEntityName('Nicole M. Amor', 'Soldier honored')).toBe(true);
  });

  it('accepts single proper name (mononym)', () => {
    expect(isValidEntityName('Rodriguez', 'Rodriguez family seeks help')).toBe(true);
  });

  it('accepts name with suffix', () => {
    expect(isValidEntityName('James Williams Jr.', 'Honoring James Williams')).toBe(true);
  });

  it('accepts The Rivera Family', () => {
    expect(isValidEntityName('The Rivera Family', 'Rivera family displaced')).toBe(true);
  });

  // ── Rejects generic descriptors ────────────────────────────────────────
  it('rejects "Young Woman"', () => {
    expect(isValidEntityName('Young Woman', 'Young woman found hurt')).toBe(false);
  });

  it('rejects "Local Resident"', () => {
    expect(isValidEntityName('Local Resident', 'Local resident displaced')).toBe(false);
  });

  it('rejects "Roommate"', () => {
    expect(isValidEntityName('Roommate', 'Roommate from area needs help')).toBe(false);
  });

  it('rejects "Elderly Man"', () => {
    expect(isValidEntityName('Elderly Man', 'Elderly man loses home')).toBe(false);
  });

  it('rejects "Her Son"', () => {
    expect(isValidEntityName('Her Son', 'Her son was injured')).toBe(false);
  });

  it('rejects "The Family"', () => {
    expect(isValidEntityName('The Family', 'The family lost everything')).toBe(false);
  });

  it('rejects "A Man"', () => {
    expect(isValidEntityName('A Man', 'A man from the city')).toBe(false);
  });

  it('rejects "Baby Girl"', () => {
    expect(isValidEntityName('Baby Girl', 'Baby girl needs surgery')).toBe(false);
  });

  it('rejects "Community Member"', () => {
    expect(isValidEntityName('Community Member', 'Community member hurt')).toBe(false);
  });

  it('rejects "Their Mother"', () => {
    expect(isValidEntityName('Their Mother', 'Their mother is ill')).toBe(false);
  });

  it('rejects "Young Student"', () => {
    expect(isValidEntityName('Young Student', 'Student injured in crash')).toBe(false);
  });

  it('rejects "The Local Family" (generic surname in family pattern)', () => {
    expect(isValidEntityName('The Local Family', 'Local family displaced')).toBe(false);
  });

  it('rejects "Desperate Mother"', () => {
    expect(isValidEntityName('Desperate Mother', 'Mother seeks help')).toBe(false);
  });

  it('rejects "Roommate from Area"', () => {
    expect(isValidEntityName('Roommate from Area', 'Roommate displaced')).toBe(false);
  });

  // ── Rejects existing checks (headline verbs, dehumanizing, etc.) ──────
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

  it('rejects dehumanizing terms like "victim"', () => {
    expect(isValidEntityName('The Kidnapping Victim', 'Victim identified')).toBe(false);
  });

  it('rejects dehumanizing terms like "survivors"', () => {
    expect(isValidEntityName('Fire Survivors', 'Survivors seek aid')).toBe(false);
  });
});

// ── validateEntityName (provides reason strings) ──────────────────────────

describe('validateEntityName', () => {
  it('returns null for valid names', () => {
    expect(validateEntityName('Maria Gonzalez', 'Accident in Austin')).toBeNull();
  });

  it('returns reason for empty name', () => {
    expect(validateEntityName('', 'headline')).toBe('empty name');
  });

  it('returns reason for generic descriptor', () => {
    const reason = validateEntityName('Young Woman', 'headline');
    expect(reason).toContain('generic descriptors');
  });

  it('returns reason for generic family name', () => {
    const reason = validateEntityName('The Local Family', 'headline');
    expect(reason).toContain('generic word');
  });

  it('returns reason for headline verb', () => {
    const reason = validateEntityName('Soldier killed', 'headline');
    expect(reason).toContain('headline verb');
  });

  it('returns reason for dehumanizing term', () => {
    const reason = validateEntityName('The Victim', 'headline');
    expect(reason).toContain('dehumanizing');
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

// ── isValidLocation / validateLocation ──────────────────────────────────────

describe('isValidLocation', () => {
  // ── Accepts real locations ──────────────────────────────────────────────
  it('accepts "Glendale, Kentucky"', () => {
    expect(isValidLocation('Glendale, Kentucky')).toBe(true);
  });

  it('accepts "Fort Worth, TX"', () => {
    expect(isValidLocation('Fort Worth, TX')).toBe(true);
  });

  it('accepts "Paradise, CA"', () => {
    expect(isValidLocation('Paradise, CA')).toBe(true);
  });

  it('accepts "St. Louis"', () => {
    expect(isValidLocation('St. Louis')).toBe(true);
  });

  it('accepts "New York City"', () => {
    expect(isValidLocation('New York City')).toBe(true);
  });

  it('accepts "Washington, DC"', () => {
    expect(isValidLocation('Washington, DC')).toBe(true);
  });

  it('accepts "Springfield, Illinois"', () => {
    expect(isValidLocation('Springfield, Illinois')).toBe(true);
  });

  // ── Rejects placeholder/invalid locations ──────────────────────────────
  it('rejects "Unknown"', () => {
    expect(isValidLocation('Unknown')).toBe(false);
  });

  it('rejects "Unspecified"', () => {
    expect(isValidLocation('Unspecified')).toBe(false);
  });

  it('rejects "N/A"', () => {
    expect(isValidLocation('N/A')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidLocation('')).toBe(false);
  });

  it('rejects "Not Specified"', () => {
    expect(isValidLocation('Not Specified')).toBe(false);
  });

  it('rejects "Undisclosed"', () => {
    expect(isValidLocation('Undisclosed')).toBe(false);
  });

  it('rejects "Nationwide"', () => {
    expect(isValidLocation('Nationwide')).toBe(false);
  });

  it('rejects "Big City"', () => {
    expect(isValidLocation('Big City')).toBe(false);
  });

  it('rejects "Small Town"', () => {
    expect(isValidLocation('Small Town')).toBe(false);
  });

  it('rejects "The Community"', () => {
    expect(isValidLocation('The Community')).toBe(false);
  });

  it('rejects "Local Area"', () => {
    expect(isValidLocation('Local Area')).toBe(false);
  });
});

describe('validateLocation', () => {
  it('returns null for valid locations', () => {
    expect(validateLocation('Austin, TX')).toBeNull();
  });

  it('returns reason for "Unknown"', () => {
    expect(validateLocation('Unknown')).toContain('placeholder');
  });

  it('returns reason for generic words', () => {
    expect(validateLocation('Big City')).toContain('generic');
  });

  it('returns reason for empty', () => {
    expect(validateLocation('')).toBe('empty location');
  });
});

// ── validateCampaignQuality ─────────────────────────────────────────────────

describe('validateCampaignQuality', () => {
  const goodEntity = {
    name: 'Maria Gonzalez',
    hometown: 'Austin, TX',
    confidence: 85,
    articleTitle: 'Fire displaces family in Austin',
  };

  it('passes for a fully valid entity', () => {
    const result = validateCampaignQuality(goodEntity);
    expect(result.pass).toBe(true);
  });

  it('fails for generic name', () => {
    const result = validateCampaignQuality({
      ...goodEntity,
      name: 'Young Woman',
    });
    expect(result.pass).toBe(false);
    if (!result.pass) expect(result.reason).toContain('Invalid entity name');
  });

  it('fails for invalid location', () => {
    const result = validateCampaignQuality({
      ...goodEntity,
      hometown: 'Unknown',
    });
    expect(result.pass).toBe(false);
    if (!result.pass) expect(result.reason).toContain('Invalid location');
  });

  it('fails for low confidence', () => {
    const result = validateCampaignQuality({
      ...goodEntity,
      confidence: 25,
    });
    expect(result.pass).toBe(false);
    if (!result.pass) expect(result.reason).toContain('confidence too low');
  });

  it('fails for zero confidence (missing field)', () => {
    const result = validateCampaignQuality({
      ...goodEntity,
      confidence: 0,
    });
    expect(result.pass).toBe(false);
  });

  it('passes at confidence threshold of 40', () => {
    const result = validateCampaignQuality({
      ...goodEntity,
      confidence: 40,
    });
    expect(result.pass).toBe(true);
  });

  it('fails at confidence 39', () => {
    const result = validateCampaignQuality({
      ...goodEntity,
      confidence: 39,
    });
    expect(result.pass).toBe(false);
  });

  it('fails for "Roommate from Unspecified Location" scenario', () => {
    const result = validateCampaignQuality({
      name: 'Roommate',
      hometown: 'Unspecified',
      confidence: 45,
      articleTitle: 'Roommate found in unspecified location',
    });
    expect(result.pass).toBe(false);
  });

  it('catches the exact bad campaign that triggered this fix', () => {
    // The campaign that was published with no real name and no real location
    const result = validateCampaignQuality({
      name: 'Roommate from Unspecified Location',
      hometown: 'Unknown',
      confidence: 55,
      articleTitle: 'Roommate dispute leads to tragedy',
    });
    expect(result.pass).toBe(false);
  });
});
