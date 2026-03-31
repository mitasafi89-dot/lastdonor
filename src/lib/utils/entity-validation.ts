/** Words that indicate the "name" is actually a raw news headline fragment. */
const HEADLINE_VERBS = new Set([
  'dies', 'killed', 'dead', 'fatal', 'crash', 'explosion',
  'emerges', 'details', 'arrested', 'charged', 'sentenced', 'indicted',
  'reported', 'breaking', 'new', 'update', 'after', 'before', 'during',
  'following', 'donate', 'multi', 'fatality',
]);

/**
 * Terms that reduce a person to their victimhood or crisis.
 * "The Kidnapping Victim", "The Fire Survivors" — dehumanizing as campaign subject names.
 */
const DEHUMANIZING_TERMS = new Set([
  'victim', 'victims', 'survivor', 'survivors', 'deceased', 'injured',
  'wounded', 'missing', 'displaced', 'homeless', 'suspect', 'assailant',
  'perpetrator', 'attacker', 'shooter',
]);

/** Words allowed in descriptive subject identifiers (not in real names either) */
const DESCRIPTIVE_SUBJECT_WORDS = new Set([
  'the', 'from', 'of',
]);

/** Honorific/rank prefixes to strip for normalization (not for validation). */
const NAME_PREFIXES = /^(sgt\.?|cpl\.?|pvt\.?|lt\.?|capt\.?|maj\.?|col\.?|gen\.?|officer|dr\.?|mr\.?|mrs\.?|ms\.?|miss|first class|master|staff|tech|senior|chief|lance|specialist|private|sergeant|corporal|lieutenant|captain|major|colonel|general)\s+/i;

/** Middle initials like "M." or "J." */
const MIDDLE_INITIAL = /\s+[A-Z]\.\s*/g;

/** Name suffixes */
const NAME_SUFFIXES = /\s+(jr\.?|sr\.?|iii|iv|ii)\s*$/i;

/**
 * Validate that an entity name looks like an actual person/family name
 * or a valid descriptive subject identifier, not a raw headline copy.
 */
export function isValidEntityName(name: string, articleTitle: string): boolean {
  if (!name || name.trim().length === 0) return false;

  const words = name.trim().split(/\s+/);

  // Subject identifiers are 1–6 words
  if (words.length > 6) return false;

  const lowerWords = words.map((w) => w.toLowerCase().replace(/[.,;:!?]/g, ''));

  // Reject if any word is a headline verb/action word (not a subject identifier)
  if (lowerWords.some((w) => HEADLINE_VERBS.has(w))) return false;

  // Must have at least one "content" word that's not just a descriptor
  const contentWords = lowerWords.filter(
    (w) => !DESCRIPTIVE_SUBJECT_WORDS.has(w) && w.length > 1,
  );
  if (contentWords.length === 0) return false;

  // Reject if contains digits (e.g. "3rd victim")
  if (/\d/.test(name)) return false;

  // Reject if >1 word is ALL CAPS and >3 chars (event codes like "MORRILL-COTTONWOOD FIRE")
  const allCapsWords = words.filter((w) => w.length > 3 && w === w.toUpperCase());
  if (allCapsWords.length > 1) return false;

  // Reject dehumanizing labels that reduce people to their crisis
  // e.g. "The Kidnapping Victim", "The Fire Survivors"
  if (lowerWords.some((w) => DEHUMANIZING_TERMS.has(w))) return false;

  // Reject if name is >60% substring overlap with article title (headline was used as name)
  const nameNorm = name.toLowerCase();
  const titleNorm = articleTitle.toLowerCase();
  if (nameNorm.length > 10 && titleNorm.includes(nameNorm)) return false;

  return true;
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
