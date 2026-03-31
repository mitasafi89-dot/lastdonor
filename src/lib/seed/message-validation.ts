/**
 * Message validation pipeline for seed donation messages.
 *
 * Validates generated messages against three criteria:
 * 1. Length: reject messages longer than 280 characters
 * 2. Dollar amounts: reject messages containing specific dollar amounts
 * 3. Similarity: reject messages that are >70% similar to any existing message
 */

const MAX_MESSAGE_LENGTH = 280;
const SIMILARITY_THRESHOLD = 0.70;

/** Regex to catch dollar amounts in various forms */
const DOLLAR_AMOUNT_REGEX = /\$\s?\d[\d,]*(?:\.\d{2})?|\d[\d,]*\s*(?:dollars?|bucks?)\b/i;

/**
 * Compute normalized Levenshtein similarity ratio between two strings.
 * Returns a value 0..1 where 1 = identical strings.
 *
 * Uses a memory-efficient single-row DP approach (O(min(m,n)) space).
 */
function levenshteinSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1.0;

  const m = aLower.length;
  const n = bLower.length;

  if (m === 0 || n === 0) return 0;

  // Ensure a is the shorter string for O(min(m,n)) space
  const [s1, s2, len1, len2] =
    m <= n ? [aLower, bLower, m, n] : [bLower, aLower, n, m];

  let prev = new Array<number>(len1 + 1);
  let curr = new Array<number>(len1 + 1);

  for (let i = 0; i <= len1; i++) prev[i] = i;

  for (let j = 1; j <= len2; j++) {
    curr[0] = j;
    for (let i = 1; i <= len1; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[len1];
  const maxLen = Math.max(m, n);
  return 1 - distance / maxLen;
}

export type ValidationResult = {
  valid: string[];
  rejected: {
    message: string;
    reason: 'too_long' | 'dollar_amount' | 'too_similar';
  }[];
};

/**
 * Validate a batch of generated messages against the validation criteria.
 *
 * @param messages - The newly generated messages to validate
 * @param existingMessages - Messages already in the database for this campaign
 * @returns Object with valid messages and rejected messages with reasons
 */
export function validateMessages(
  messages: string[],
  existingMessages: string[],
): ValidationResult {
  const result: ValidationResult = {
    valid: [],
    rejected: [],
  };

  // Build a combined pool: existing + already-validated new messages
  // This prevents duplicates within the new batch as well
  const acceptedPool = [...existingMessages];

  for (const raw of messages) {
    const msg = typeof raw === 'string' ? raw.trim() : String(raw).trim();

    if (!msg) continue;

    // Rule 1: Length check
    if (msg.length > MAX_MESSAGE_LENGTH) {
      result.rejected.push({ message: msg, reason: 'too_long' });
      continue;
    }

    // Rule 2: Dollar amount check
    if (DOLLAR_AMOUNT_REGEX.test(msg)) {
      result.rejected.push({ message: msg, reason: 'dollar_amount' });
      continue;
    }

    // Rule 3: Similarity check against all existing + already-accepted messages
    let tooSimilar = false;
    for (const existing of acceptedPool) {
      if (levenshteinSimilarity(msg, existing) > SIMILARITY_THRESHOLD) {
        tooSimilar = true;
        break;
      }
    }

    if (tooSimilar) {
      result.rejected.push({ message: msg, reason: 'too_similar' });
      continue;
    }

    result.valid.push(msg);
    acceptedPool.push(msg);
  }

  return result;
}

// Export for testing
export { levenshteinSimilarity, DOLLAR_AMOUNT_REGEX, MAX_MESSAGE_LENGTH, SIMILARITY_THRESHOLD };
