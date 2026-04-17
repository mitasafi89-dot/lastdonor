/** Words that indicate the "name" is actually a raw news headline fragment. */
const HEADLINE_VERBS = new Set([
  'dies', 'killed', 'dead', 'fatal', 'crash', 'explosion',
  'emerges', 'details', 'arrested', 'charged', 'sentenced', 'indicted',
  'reported', 'breaking', 'new', 'update', 'after', 'before', 'during',
  'following', 'donate', 'multi', 'fatality',
]);

/**
 * Terms that reduce a person to their victimhood or crisis.
 * "The Kidnapping Victim", "The Fire Survivors" - dehumanizing as campaign subject names.
 */
const DEHUMANIZING_TERMS = new Set([
  'victim', 'victims', 'survivor', 'survivors', 'deceased', 'injured',
  'wounded', 'missing', 'displaced', 'homeless', 'suspect', 'assailant',
  'perpetrator', 'attacker', 'shooter',
]);

/**
 * Generic descriptor words that are NOT proper names.
 * If every content word in the entity name is in this set, the name is
 * a generic description like "Young Woman" or "Local Resident" rather than
 * a real identifiable person. Each word is lowercase.
 */
const GENERIC_DESCRIPTORS = new Set([
  // Age / gender / relationship descriptors
  'young', 'old', 'elderly', 'teen', 'teenage', 'adult', 'child', 'children',
  'baby', 'infant', 'toddler', 'boy', 'girl', 'man', 'woman', 'men', 'women',
  'mother', 'father', 'son', 'daughter', 'brother', 'sister', 'husband', 'wife',
  'parent', 'parents', 'kid', 'kids', 'grandma', 'grandpa', 'grandmother',
  'grandfather', 'uncle', 'aunt', 'cousin', 'nephew', 'niece', 'family',
  'families', 'couple', 'roommate', 'roommates', 'neighbor', 'neighbors',
  'friend', 'friends',
  // Role descriptors (not part of a proper name)
  'worker', 'workers', 'employee', 'employees', 'resident', 'residents',
  'citizen', 'citizens', 'student', 'students', 'teacher', 'teachers',
  'veteran', 'nurse', 'doctor', 'patient', 'driver', 'passenger',
  'pedestrian', 'cyclist', 'commuter', 'volunteer', 'volunteers',
  'homeowner', 'homeowners', 'tenant', 'tenants', 'renter', 'renters',
  'member', 'members',
  // Vague qualifiers
  'local', 'nearby', 'area', 'unspecified', 'unknown', 'unnamed', 'anonymous',
  'undisclosed', 'certain', 'some', 'another', 'other', 'various', 'several',
  'many', 'few', 'single', 'lone', 'poor', 'struggling', 'starving',
  'desperate', 'needy', 'helpless',
  // Common articles/prepositions that slip through
  'the', 'a', 'an', 'from', 'of', 'in', 'at', 'for', 'with', 'and', 'or',
  'his', 'her', 'their', 'its', 'my', 'our', 'your',
  // Location-type words (not proper nouns)
  'city', 'town', 'village', 'county', 'state', 'community', 'communities',
  'neighborhood', 'district', 'region', 'country', 'big', 'small',
]);

/**
 * Known valid "The [Name] Family" pattern - the word "family" at the end
 * is acceptable IF preceded by a proper surname.
 * e.g. "The Rivera Family" is valid, "The Local Family" is not.
 */
const FAMILY_PATTERN = /^the\s+([A-Z][a-z]+)\s+family$/i;

/** Words allowed in descriptive subject identifiers (not in real names either) */
const _DESCRIPTIVE_SUBJECT_WORDS = new Set([
  'the', 'from', 'of',
]);

/** Honorific/rank prefixes to strip for normalization (not for validation). */
const NAME_PREFIXES = /^(sgt\.?|cpl\.?|pvt\.?|lt\.?|capt\.?|maj\.?|col\.?|gen\.?|officer|dr\.?|mr\.?|mrs\.?|ms\.?|miss|first class|master|staff|tech|senior|chief|lance|specialist|private|sergeant|corporal|lieutenant|captain|major|colonel|general)\s+/i;

/** Middle initials like "M." or "J." */
const MIDDLE_INITIAL = /\s+[A-Z]\.\s*/g;

/** Name suffixes */
const NAME_SUFFIXES = /\s+(jr\.?|sr\.?|iii|iv|ii)\s*$/i;

/**
 * Validate that an entity name is a real, identifiable person or family name
 * suitable for publishing as a fundraising campaign subject.
 *
 * STRICT RULES - a name must satisfy ALL of the following:
 * 1. Not empty, 1-6 words
 * 2. No headline verbs (dies, killed, arrested...)
 * 3. No dehumanizing labels (victim, survivor, suspect...)
 * 4. No digits
 * 5. Not mostly ALL CAPS event codes
 * 6. Not a substring of the article title (headline regurgitation)
 * 7. Contains at least one PROPER NAME word (not a generic descriptor)
 *
 * Rule 7 is the critical guardrail: every content word is checked against
 * GENERIC_DESCRIPTORS. If ALL content words are generic, the name is rejected.
 * "Young Woman" -> all generic -> REJECTED
 * "Maria Gonzalez" -> "maria" not generic, "gonzalez" not generic -> ACCEPTED
 * "The Rivera Family" -> "rivera" not generic -> ACCEPTED
 * "Roommate from Unspecified Location" -> all generic -> REJECTED
 *
 * Returns a rejection reason string on failure, or null on success.
 * The reason string is used for logging/debugging.
 */
export function isValidEntityName(name: string, articleTitle: string): boolean {
  return validateEntityName(name, articleTitle) === null;
}

export function validateEntityName(name: string, articleTitle: string): string | null {
  if (!name || name.trim().length === 0) return 'empty name';

  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);

  // Subject identifiers are 1-6 words
  if (words.length > 6) return `too many words (${words.length})`;

  const lowerWords = words.map((w) => w.toLowerCase().replace(/[.,;:!?]/g, ''));

  // Reject if any word is a headline verb/action word
  for (const w of lowerWords) {
    if (HEADLINE_VERBS.has(w)) return `contains headline verb "${w}"`;
  }

  // Reject if contains digits (e.g. "3rd victim", "26-year-old")
  if (/\d/.test(trimmed)) return 'contains digits';

  // Reject if >1 word is ALL CAPS and >3 chars (event codes like "MORRILL-COTTONWOOD FIRE")
  const allCapsWords = words.filter((w) => w.length > 3 && w === w.toUpperCase());
  if (allCapsWords.length > 1) return 'multiple ALL CAPS words (event code)';

  // Reject dehumanizing labels
  for (const w of lowerWords) {
    if (DEHUMANIZING_TERMS.has(w)) return `contains dehumanizing term "${w}"`;
  }

  // Reject if name is a substring of the article title (headline regurgitation)
  // Only trigger for longer strings that are clearly headline fragments, not real names
  const nameNorm = trimmed.toLowerCase();
  const titleNorm = articleTitle.toLowerCase();
  if (nameNorm.length > 20 && titleNorm.includes(nameNorm)) {
    return 'name is substring of article title';
  }

  // ── CRITICAL GUARDRAIL: Proper name detection ──────────────────────────
  //
  // A valid entity name must contain at least one word that is NOT a generic
  // descriptor. This catches AI-generated placeholders like:
  //   "Young Woman"         -> young=generic, woman=generic -> REJECT
  //   "Roommate"            -> roommate=generic -> REJECT
  //   "Local Resident"      -> local=generic, resident=generic -> REJECT
  //   "Her Son"             -> her=generic, son=generic -> REJECT
  //   "The Family"          -> the=generic, family=generic -> REJECT
  //
  // But allows:
  //   "Maria Gonzalez"      -> neither word is generic -> ACCEPT
  //   "The Rivera Family"   -> "rivera" is not generic -> ACCEPT
  //   "Sgt. James Lee"      -> "james"/"lee" not generic -> ACCEPT
  //   "Officer Chen"        -> "chen" not generic -> ACCEPT

  // Special case: "The [Surname] Family" pattern
  const familyMatch = trimmed.match(FAMILY_PATTERN);
  if (familyMatch) {
    const surname = familyMatch[1].toLowerCase();
    if (GENERIC_DESCRIPTORS.has(surname)) {
      return `"The ${familyMatch[1]} Family" uses a generic word, not a real surname`;
    }
    return null; // Valid family name
  }

  // Strip honorific/rank prefix for name-word analysis
  const nameWithoutPrefix = trimmed.replace(NAME_PREFIXES, '');
  const nameWords = nameWithoutPrefix.split(/\s+/);
  const lowerNameWords = nameWords.map((w) => w.toLowerCase().replace(/[.,;:!?]/g, ''));

  // Check: does at least one word look like a proper name (not generic)?
  const hasProperNameWord = lowerNameWords.some(
    (w) => w.length > 1 && !GENERIC_DESCRIPTORS.has(w),
  );

  if (!hasProperNameWord) {
    return `all words are generic descriptors: "${trimmed}"`;
  }

  // Single-word names must be at least 2 characters and not generic
  // (already covered above, but explicit for clarity)
  if (words.length === 1 && GENERIC_DESCRIPTORS.has(lowerWords[0])) {
    return `single generic word: "${trimmed}"`;
  }

  return null; // Valid
}

/**
 * Normalize a subject name for fuzzy dedup comparison.
 * "Sgt. First Class Nicole M. Amor" → "nicole amor"
 */
export function normalizeSubjectName(name: string): string {
  return name
    .replace(NAME_PREFIXES, '')
    .replace(MIDDLE_INITIAL, ' ')
    .replace(NAME_SUFFIXES, '')
    .replace(/[.,]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Geographic Normalization ────────────────────────────────────────────────

/** Common abbreviation expansions for location normalization. */
const LOCATION_ABBREVIATIONS: [RegExp, string][] = [
  [/\bSt\.\s/gi, 'Saint '],
  [/\bFt\.\s/gi, 'Fort '],
  [/\bMt\.\s/gi, 'Mount '],
  [/\bN\.\s/gi, 'North '],
  [/\bS\.\s/gi, 'South '],
  [/\bE\.\s/gi, 'East '],
  [/\bW\.\s/gi, 'West '],
];

/** US state abbreviation → full name. */
const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

/**
 * Normalize a location string for fuzzy comparison.
 * Expands abbreviations, normalizes state names, lowercases.
 *
 *   "St. Louis, MO" → "saint louis, missouri"
 *   "Ft. Worth, TX" → "fort worth, texas"
 */
export function normalizeLocation(location: string): string {
  let normalized = location;

  // Expand common prefix abbreviations
  for (const [pattern, replacement] of LOCATION_ABBREVIATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Expand state abbreviations at the end: ", TX" → ", Texas"
  normalized = normalized.replace(
    /,\s*([A-Z]{2})\s*$/,
    (_match, abbr: string) => {
      const state = STATE_ABBREVIATIONS[abbr.toUpperCase()];
      return state ? `, ${state}` : `, ${abbr}`;
    },
  );

  return normalized.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Location Validation ─────────────────────────────────────────────────────

/**
 * Words/phrases that indicate the AI could not determine a real location.
 * Checked case-insensitively against the full location string.
 */
const INVALID_LOCATIONS = new Set([
  'unknown', 'unspecified', 'n/a', 'na', 'none', 'not specified',
  'not available', 'undisclosed', 'not mentioned', 'unnamed',
  'various', 'multiple', 'nationwide', 'online',
]);

/**
 * Generic location words that are not real place names.
 * "Big City", "Small Town", "The Community" -> invalid
 */
const GENERIC_LOCATION_WORDS = new Set([
  'big', 'small', 'large', 'little', 'nearby', 'local', 'rural', 'urban',
  'suburban', 'remote', 'the', 'a', 'an', 'some', 'city', 'town', 'village',
  'area', 'region', 'place', 'community', 'somewhere', 'anywhere', 'nowhere',
]);

/**
 * Validate that a location is a real, specific geographic place.
 *
 * ACCEPTS: "Glendale, Kentucky", "Fort Worth, TX", "Paradise, CA",
 *          "St. Louis", "New York City", "Washington, DC"
 *
 * REJECTS: "Unknown", "Unspecified", "Big City", "Small Town",
 *          "N/A", "", "The Community", "Somewhere in Texas",
 *          "Online", "Nationwide"
 *
 * Returns a rejection reason string on failure, or null on success.
 */
export function validateLocation(location: string): string | null {
  if (!location || location.trim().length === 0) return 'empty location';

  const trimmed = location.trim();
  const lower = trimmed.toLowerCase();

  // Exact match against known-invalid values
  if (INVALID_LOCATIONS.has(lower)) return `placeholder location: "${trimmed}"`;

  // Must be at least 2 characters (single letters aren't places)
  if (trimmed.length < 2) return 'location too short';

  // Check if ALL words are generic (same logic as name validation)
  const words = lower.split(/[\s,]+/).filter((w) => w.length > 0);
  const hasSpecificWord = words.some(
    (w) => w.length > 1 && !GENERIC_LOCATION_WORDS.has(w),
  );

  if (!hasSpecificWord) {
    return `all words are generic location descriptors: "${trimmed}"`;
  }

  return null; // Valid
}

export function isValidLocation(location: string): boolean {
  return validateLocation(location) === null;
}

// ── Pre-Publish Quality Gate ────────────────────────────────────────────────

export type QualityGateResult =
  | { pass: true }
  | { pass: false; reason: string };

/**
 * Final quality gate before a campaign is inserted into the database.
 * This is the last line of defense - if this rejects, the campaign
 * is NOT published. No exceptions.
 *
 * Checks:
 * 1. Entity name must be a real proper name (not a generic descriptor)
 * 2. Location must be a real place (not "Unknown" or "Unspecified")
 * 3. AI confidence must be >= 40 (the AI itself wasn't sure)
 * 4. Entity name + location cannot both be vague
 */
export function validateCampaignQuality(entity: {
  name: string;
  hometown: string;
  confidence: number;
  articleTitle: string;
}): QualityGateResult {
  // 1. Name validation (strict)
  const nameReason = validateEntityName(entity.name, entity.articleTitle);
  if (nameReason) {
    return { pass: false, reason: `Invalid entity name: ${nameReason}` };
  }

  // 2. Location validation (strict)
  const locationReason = validateLocation(entity.hometown);
  if (locationReason) {
    return { pass: false, reason: `Invalid location: ${locationReason}` };
  }

  // 3. Confidence floor
  if (entity.confidence < 40) {
    return {
      pass: false,
      reason: `AI confidence too low (${entity.confidence}/100). The article likely lacks sufficient detail for a credible campaign.`,
    };
  }

  return { pass: true };
}
