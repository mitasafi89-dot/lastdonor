import { describe, it, expect } from 'vitest';
import { KEYWORD_SETS } from '@/lib/news/gnews-client';
import type { CampaignCategory } from '@/types';

describe('KEYWORD_SETS', () => {
  const allCategories: CampaignCategory[] = [
    'military', 'veterans', 'first-responders', 'disaster', 'medical',
    'memorial', 'community', 'essential-needs', 'emergency', 'charity',
    'education', 'animal', 'environment', 'business', 'competition',
    'creative', 'event', 'faith', 'family', 'sports', 'travel',
    'volunteer', 'wishes',
  ];

  it('has keywords for all 23 campaign categories', () => {
    for (const category of allCategories) {
      expect(KEYWORD_SETS[category]).toBeDefined();
      expect(KEYWORD_SETS[category].length).toBeGreaterThan(0);
    }
  });

  it('each category has at least 3 keywords', () => {
    for (const category of allCategories) {
      expect(KEYWORD_SETS[category].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keywords are non-empty strings', () => {
    for (const category of allCategories) {
      for (const keyword of KEYWORD_SETS[category]) {
        expect(typeof keyword).toBe('string');
        expect(keyword.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate keywords within a category', () => {
    for (const category of allCategories) {
      const keywords = KEYWORD_SETS[category];
      const unique = new Set(keywords.map((k) => k.toLowerCase()));
      expect(unique.size).toBe(keywords.length);
    }
  });
});
