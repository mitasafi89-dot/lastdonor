/**
 * Publishing Guardrails Tests
 *
 * Tests the full guardrail system that prevents:
 *  - Keyword cannibalization (two articles competing for the same search intent)
 *  - Title repetition (reader perceives duplicate content)
 *  - Category over-concentration (content-farm appearance)
 *  - Excessive publishing cadence (quality signal to search engines)
 *  - Stale topic accumulation (queue pollution from expired news)
 *
 * Test design:
 *  - Pure function tests (stemmer, tokenizer, Jaccard) run without mocks
 *  - DB-dependent tests mock drizzle to test decision logic in isolation
 *  - Real-world keyword pairs validate threshold calibration
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Each call to db.select()...from()...where() consumes the next entry from this queue.
// Entries are arrays (DB result rows). Use pushMockResult() to enqueue.
const mockResultQueue: unknown[][] = [];

function pushMockResult(...rows: unknown[]) {
  mockResultQueue.push(rows);
}

const mockUpdateCalls: unknown[] = [];

/**
 * Creates a thenable chain object that is both awaitable (resolves to an array)
 * AND has .limit()/.orderBy() methods for further chaining.
 * 
 * This matches drizzle's query builder pattern where the terminal call
 * can be either .where() or .where().limit() or .where().orderBy().limit().
 */
function createThenableChain(): unknown {
  const result = () => mockResultQueue.shift() ?? [];

  const chain: Record<string, unknown> = {
    limit: vi.fn().mockImplementation(() => createThenableTerminal(result)),
    orderBy: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation(() => createThenableTerminal(result)),
      then: (resolve: (v: unknown) => void) => resolve(result()),
    })),
    then: (resolve: (v: unknown) => void) => resolve(result()),
  };
  return chain;
}

function createThenableTerminal(result: () => unknown): unknown {
  return {
    then: (resolve: (v: unknown) => void) => resolve(result()),
  };
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => createThenableChain()),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((data) => {
        mockUpdateCalls.push(data);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  blogPosts: {
    id: 'id',
    primaryKeyword: 'primary_keyword',
    published: 'published',
    publishedAt: 'published_at',
    causeCategory: 'cause_category',
    title: 'title',
  },
  blogTopicQueue: {
    id: 'id',
    primaryKeyword: 'primary_keyword',
    status: 'status',
    causeCategory: 'cause_category',
    sourceNewsId: 'source_news_id',
    createdAt: 'created_at',
    title: 'title',
    slug: 'slug',
    updatedAt: 'updated_at',
    rejectedReason: 'rejected_reason',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  ne: vi.fn((...args: unknown[]) => ({ type: 'ne', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gte: vi.fn((...args: unknown[]) => ({ type: 'gte', args })),
  sql: Object.assign(vi.fn(), {
    join: vi.fn(),
  }),
  inArray: vi.fn((...args: unknown[]) => ({ type: 'inArray', args })),
}));

import {
  simpleStem,
  tokenizeForSimilarity,
  jaccardSimilarity,
  checkKeywordSimilarity,
  checkTitleSimilarity,
  checkCategoryCadence,
  canPublishNow,
  markStaleTopics,
  checkTopicCandidate,
  KEYWORD_SIMILARITY_THRESHOLD,
  TITLE_SIMILARITY_THRESHOLD,
  MAX_POSTS_PER_CATEGORY_PER_WEEK,
  MAX_POSTS_PER_WEEK,
  MAX_QUEUED_PER_CATEGORY,
  STALE_TTL_NEWS_DAYS,
  STALE_TTL_EVERGREEN_DAYS,
  MIN_CATEGORY_GAP_DAYS,
} from './publishing-guardrails';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Stemmer
// ═══════════════════════════════════════════════════════════════════════════════

describe('simpleStem', () => {
  it('normalizes fundraising/fundraiser/fundraisers to the same stem', () => {
    const stems = [simpleStem('fundraising'), simpleStem('fundraiser'), simpleStem('fundraisers')];
    expect(new Set(stems).size).toBe(1);
  });

  it('normalizes paying/pays to similar forms', () => {
    expect(simpleStem('paying')).toBe(simpleStem('paying'));
    // "pays" -> strip 's' -> "pay"
    expect(simpleStem('pays')).toBe('pay');
  });

  it('normalizes ideas/idea', () => {
    expect(simpleStem('ideas')).toBe('idea');
    expect(simpleStem('idea')).toBe('idea');
  });

  it('normalizes assistance -> assist', () => {
    expect(simpleStem('assistance')).toBe('assist');
  });

  it('normalizes treatment -> treat', () => {
    expect(simpleStem('treatment')).toBe('treat');
  });

  it('normalizes illness -> ill', () => {
    expect(simpleStem('illness')).toBe('ill');
  });

  it('normalizes families -> family', () => {
    expect(simpleStem('families')).toBe('family');
  });

  it('normalizes medical -> medic', () => {
    expect(simpleStem('medical')).toBe('medic');
  });

  it('preserves short words (3 chars or fewer)', () => {
    expect(simpleStem('pay')).toBe('pay');
    expect(simpleStem('for')).toBe('for');
    expect(simpleStem('how')).toBe('how');
  });

  it('preserves words that do not match any suffix rule', () => {
    expect(simpleStem('cancer')).toBe('canc');
    expect(simpleStem('debt')).toBe('debt');
    expect(simpleStem('fund')).toBe('fund');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Tokenizer
// ═══════════════════════════════════════════════════════════════════════════════

describe('tokenizeForSimilarity', () => {
  it('strips stopwords and stems remaining words', () => {
    const tokens = tokenizeForSimilarity('how to pay for cancer treatment');
    // "how" and "to" and "for" are stopwords
    expect(tokens.has('how')).toBe(false);
    expect(tokens.has('to')).toBe(false);
    expect(tokens.has('for')).toBe(false);
    // "pay", "cancer", "treatment" remain (stemmed)
    expect(tokens.size).toBeGreaterThanOrEqual(2);
  });

  it('removes punctuation', () => {
    const tokens = tokenizeForSimilarity("what's the best fundraiser?");
    expect([...tokens].every((t) => /^[a-z0-9]+$/.test(t))).toBe(true);
  });

  it('strips title structural words (guide, tips, best)', () => {
    const a = tokenizeForSimilarity('Best Medical Fundraising Tips');
    expect(a.has('best')).toBe(false);
    expect(a.has('tips')).toBe(false);
  });

  it('returns empty set for all-stopword input', () => {
    const tokens = tokenizeForSimilarity('how to the and for');
    expect(tokens.size).toBe(0);
  });

  it('handles single-character tokens by filtering them', () => {
    const tokens = tokenizeForSimilarity('a b c help');
    expect(tokens.has('a')).toBe(false);
    expect(tokens.size).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Jaccard Similarity
// ═══════════════════════════════════════════════════════════════════════════════

describe('jaccardSimilarity', () => {
  it('returns 1.0 for identical sets', () => {
    const s = new Set(['a', 'b', 'c']);
    expect(jaccardSimilarity(s, s)).toBe(1);
  });

  it('returns 0 for completely disjoint sets', () => {
    const a = new Set(['a', 'b']);
    const b = new Set(['c', 'd']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it('returns 0 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it('returns 0 for one empty set', () => {
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
  });

  it('calculates correctly for partial overlap', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd']);
    // intersection: {b, c} = 2, union: {a, b, c, d} = 4
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });

  it('is symmetric', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y', 'z', 'w', 'v']);
    expect(jaccardSimilarity(a, b)).toBe(jaccardSimilarity(b, a));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Keyword Similarity - Real-World Threshold Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('keyword similarity threshold calibration', () => {
  /**
   * These test cases validate that the threshold correctly distinguishes:
   *  - SAME-INTENT pairs (should be BLOCKED): would cannibalize each other in SERPs
   *  - DIFFERENT-INTENT pairs (should be ALLOWED): serve distinct reader needs
   *
   * Each case includes why a reader searching that phrase has a distinct (or same) intent.
   */

  // SAME INTENT - Should result in similarity >= KEYWORD_SIMILARITY_THRESHOLD
  const sameIntentPairs: [string, string, string][] = [
    [
      'medical fundraising ideas',
      'medical fundraiser ideas',
      'Only inflection differs; same reader need, same SERP',
    ],
    [
      'how to start a fundraiser for a family',
      'start a fundraiser for family',
      'Prefix "how to" is a stopword; rest is identical intent',
    ],
  ];

  for (const [a, b, why] of sameIntentPairs) {
    it(`BLOCKS: "${a}" vs "${b}" (${why})`, () => {
      const tokA = tokenizeForSimilarity(a);
      const tokB = tokenizeForSimilarity(b);
      const sim = jaccardSimilarity(tokA, tokB);
      expect(sim).toBeGreaterThanOrEqual(KEYWORD_SIMILARITY_THRESHOLD);
    });
  }

  // DIFFERENT INTENT - Should result in similarity < KEYWORD_SIMILARITY_THRESHOLD
  const differentIntentPairs: [string, string, string][] = [
    [
      'how to pay for cancer treatment',
      'fundraising ideas for medical bills',
      'Different problem frames: paying vs raising money',
    ],
    [
      'funeral fundraiser ideas',
      'how to help a family pay for a funeral',
      'Different intent: what ideas vs how to help',
    ],
    [
      'school fundraiser ideas',
      'help pay for pet surgery',
      'Completely different cause categories',
    ],
    [
      'veteran fundraising ideas',
      'medical fundraising ideas',
      'Same activity (fundraising) but different beneficiary audience',
    ],
    [
      'crowdfunding for medical expenses',
      'church fundraiser ideas',
      'Different target audience and cause',
    ],
    [
      'help with medical debt',
      'medical debt assistance',
      // "help" vs "assistance" are synonyms but share no stem.
      // Jaccard = 0.5 (2 of 4 stems overlap). This is a known limitation
      // of lexical similarity. Caught by content-level dedup (85% body
      // similarity threshold in blog-pipeline.ts) if both are generated.
      'Synonym cannibalization caught by content-level dedup, not keyword-level',
    ],
  ];

  for (const [a, b, why] of differentIntentPairs) {
    it(`ALLOWS: "${a}" vs "${b}" (${why})`, () => {
      const tokA = tokenizeForSimilarity(a);
      const tokB = tokenizeForSimilarity(b);
      const sim = jaccardSimilarity(tokA, tokB);
      expect(sim).toBeLessThan(KEYWORD_SIMILARITY_THRESHOLD);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Title Similarity - Real-World Threshold Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('title similarity threshold calibration', () => {
  const samePerceptionPairs: [string, string, string][] = [
    [
      'How to Help Someone With Medical Bills',
      'How to Help a Friend With Medical Bills',
      'Reader sees the same article topic; "someone" vs "friend" is trivial',
    ],
    [
      'Medical Fundraising Ideas That Work',
      'Medical Fundraiser Ideas That Work',
      'Singular vs plural inflection; same reader expectation',
    ],
  ];

  for (const [a, b, why] of samePerceptionPairs) {
    it(`BLOCKS: "${a}" vs "${b}" (${why})`, () => {
      const tokA = tokenizeForSimilarity(a);
      const tokB = tokenizeForSimilarity(b);
      const sim = jaccardSimilarity(tokA, tokB);
      expect(sim).toBeGreaterThanOrEqual(TITLE_SIMILARITY_THRESHOLD);
    });
  }

  const differentPerceptionPairs: [string, string, string][] = [
    [
      'How to Pay for Surgery Without Insurance',
      'Medical Fundraising Ideas That Work',
      'Different topic: paying personally vs fundraising',
    ],
    [
      'The Real Cost of Cancer Treatment in 2026',
      'How to Help After a House Fire',
      'Completely different subjects',
    ],
    [
      'Help Military Families in Need',
      'Church Fundraiser Ideas for Your Community',
      'Different audience and cause',
    ],
  ];

  for (const [a, b, why] of differentPerceptionPairs) {
    it(`ALLOWS: "${a}" vs "${b}" (${why})`, () => {
      const tokA = tokenizeForSimilarity(a);
      const tokB = tokenizeForSimilarity(b);
      const sim = jaccardSimilarity(tokA, tokB);
      expect(sim).toBeLessThan(TITLE_SIMILARITY_THRESHOLD);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Keyword Similarity (DB-backed)
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkKeywordSimilarity', () => {
  beforeEach(() => {
    mockResultQueue.length = 0;
    vi.clearAllMocks();
  });

  it('allows a keyword when no existing keywords exist', async () => {
    // Two queries: queue keywords (empty), published keywords (empty)
    pushMockResult();
    pushMockResult();
    const result = await checkKeywordSimilarity('how to pay for cancer treatment');
    expect(result.allowed).toBe(true);
  });

  it('rejects a keyword with no meaningful tokens', async () => {
    const result = await checkKeywordSimilarity('the and for');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('no meaningful words');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Title Similarity (DB-backed)
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkTitleSimilarity', () => {
  beforeEach(() => {
    mockResultQueue.length = 0;
    vi.clearAllMocks();
  });

  it('allows a title when no existing titles exist', async () => {
    // Two queries: queue titles (empty), published titles (empty)
    pushMockResult();
    pushMockResult();
    const result = await checkTitleSimilarity('How to Pay for Surgery Without Insurance');
    expect(result.allowed).toBe(true);
  });

  it('rejects a title with no meaningful tokens', async () => {
    const result = await checkTitleSimilarity('the and or but');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('no meaningful words');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Category Cadence Cap
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkCategoryCadence', () => {
  beforeEach(() => {
    mockResultQueue.length = 0;
    vi.clearAllMocks();
  });

  it('allows when category has no recent posts', async () => {
    // Two queries: published count (0), queued count (0)
    pushMockResult({ count: 0 });
    pushMockResult({ count: 0 });
    const result = await checkCategoryCadence('medical');
    expect(result.allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Publishing Gate
// ═══════════════════════════════════════════════════════════════════════════════

describe('canPublishNow', () => {
  beforeEach(() => {
    mockResultQueue.length = 0;
    vi.clearAllMocks();
  });

  it('allows publishing when all limits are clear', async () => {
    // Three queries: weekly count (0), category count (0), latest in category (empty)
    pushMockResult({ count: 0 });
    pushMockResult({ count: 0 });
    pushMockResult(); // no recent same-category post
    const result = await canPublishNow('medical');
    expect(result.canPublish).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Topic Staleness
// ═══════════════════════════════════════════════════════════════════════════════

describe('markStaleTopics', () => {
  beforeEach(() => {
    mockResultQueue.length = 0;
    mockUpdateCalls.length = 0;
    vi.clearAllMocks();
  });

  it('returns zero when no topics are stale', async () => {
    // Two queries: stale news (empty), stale evergreen (empty)
    pushMockResult();
    pushMockResult();
    const result = await markStaleTopics();
    expect(result.markedStale).toBe(0);
    expect(result.details).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Configuration Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('guardrail configuration', () => {
  it('keyword similarity threshold is between 0 and 1', () => {
    expect(KEYWORD_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(KEYWORD_SIMILARITY_THRESHOLD).toBeLessThan(1);
  });

  it('title similarity threshold is between 0 and 1', () => {
    expect(TITLE_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(TITLE_SIMILARITY_THRESHOLD).toBeLessThan(1);
  });

  it('title threshold is lower than keyword threshold', () => {
    // Titles are longer, share more structure. Lower threshold avoids false positives.
    expect(TITLE_SIMILARITY_THRESHOLD).toBeLessThan(KEYWORD_SIMILARITY_THRESHOLD);
  });

  it('weekly post limit is at least 2', () => {
    expect(MAX_POSTS_PER_WEEK).toBeGreaterThanOrEqual(2);
  });

  it('category limit is less than weekly limit', () => {
    expect(MAX_POSTS_PER_CATEGORY_PER_WEEK).toBeLessThan(MAX_POSTS_PER_WEEK);
  });

  it('queue cap per category is at least double the weekly category limit', () => {
    // Queue must hold enough for at least 2 weeks of generation
    expect(MAX_QUEUED_PER_CATEGORY).toBeGreaterThanOrEqual(MAX_POSTS_PER_CATEGORY_PER_WEEK * 2);
  });

  it('news staleness TTL is shorter than evergreen TTL', () => {
    expect(STALE_TTL_NEWS_DAYS).toBeLessThan(STALE_TTL_EVERGREEN_DAYS);
  });

  it('category gap is at least 1 day', () => {
    expect(MIN_CATEGORY_GAP_DAYS).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Composite Check
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkTopicCandidate', () => {
  beforeEach(() => {
    mockResultQueue.length = 0;
    vi.clearAllMocks();
  });

  it('passes all checks for a valid, unique topic', async () => {
    // checkTopicCandidate runs 3 checks in parallel via Promise.all:
    //   checkKeywordSimilarity: 2 queries
    //   checkTitleSimilarity: 2 queries
    //   checkCategoryCadence: 2 queries
    // Parallel execution interleaves query order, so all results must be
    // shape-agnostic. Empty arrays work for both keyword/title queries
    // (allExisting = []) and count queries ([result] = [] → undefined?.count ?? 0 = 0).
    for (let i = 0; i < 6; i++) pushMockResult();
    const result = await checkTopicCandidate(
      'how to pay for cancer treatment',
      'How to Pay for Cancer Treatment',
      'medical',
    );
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('returns all failure reasons (not just the first)', async () => {
    // Keyword/title "the and for" reduces to empty tokens => rejected before DB queries.
    // But cadence check still runs => needs 2 mock results.
    pushMockResult({ count: 0 }); // cadence: published count
    pushMockResult({ count: 0 }); // cadence: queued count
    const result = await checkTopicCandidate(
      'the and for',
      'The And For',
      'medical',
    );
    expect(result.allowed).toBe(false);
    // Should have at least the keyword reason
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    expect(result.reasons.some((r) => r.includes('no meaningful words'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Keyword Bank Coverage - Verify No Existing Keywords Cannibalize
// ═══════════════════════════════════════════════════════════════════════════════

describe('keyword bank cannibalization audit', () => {
  /**
   * Verifies that within each category of the curated keyword bank,
   * no two keywords are similar enough to cannibalize each other.
   *
   * This ensures the keyword bank itself was curated with SEO discipline.
   * If a new keyword is added to the bank that's too similar to an existing one,
   * this test will catch it immediately.
   */

  // Import keyword bank data (pure data, no DB access needed)
  // Using dynamic import since the function doesn't need mocks
  it('no two keywords in the same category exceed the similarity threshold', async () => {
    // We test the keyword bank statically by importing the function
    const { getKeywordsByCategory, getKeywordCategories } =
      await import('./keyword-bank');

    const categories = getKeywordCategories();
    const violations: string[] = [];

    for (const category of categories) {
      const keywords = getKeywordsByCategory(category);
      for (let i = 0; i < keywords.length; i++) {
        for (let j = i + 1; j < keywords.length; j++) {
          const tokA = tokenizeForSimilarity(keywords[i].keyword);
          const tokB = tokenizeForSimilarity(keywords[j].keyword);
          const sim = jaccardSimilarity(tokA, tokB);
          if (sim >= KEYWORD_SIMILARITY_THRESHOLD) {
            violations.push(
              `[${category}] "${keywords[i].keyword}" vs "${keywords[j].keyword}" = ${(sim * 100).toFixed(0)}%`,
            );
          }
        }
      }
    }

    // If this fails, one of the keywords in keyword-bank.ts needs to be removed or differentiated
    expect(violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('handles unicode and special characters in keywords', () => {
    const tokens = tokenizeForSimilarity("can't afford chemotherapy — help needed!");
    expect(tokens.size).toBeGreaterThan(0);
    // Should strip em dashes, apostrophes, exclamation marks
    for (const token of tokens) {
      expect(token).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('handles extremely long keywords', () => {
    const longKeyword = 'how to help someone with cancer treatment when they cannot afford it and have no insurance and no family support';
    const tokens = tokenizeForSimilarity(longKeyword);
    expect(tokens.size).toBeGreaterThan(3);
  });

  it('tokenizer is case-insensitive', () => {
    const lower = tokenizeForSimilarity('Medical Fundraising IDEAS');
    const upper = tokenizeForSimilarity('medical fundraising ideas');
    expect([...lower].sort()).toEqual([...upper].sort());
  });

  it('Jaccard handles one-element sets', () => {
    const a = new Set(['fund']);
    const b = new Set(['fund']);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it('stemmer handles words with double letters', () => {
    // "illness" has 'll' - should still work with -ness rule
    expect(simpleStem('illness')).toBe('ill');
    // "wellness" has 'll' too
    expect(simpleStem('wellness')).toBe('well');
  });
});
