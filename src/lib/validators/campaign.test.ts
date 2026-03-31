import { describe, it, expect } from 'vitest';
import { createCampaignSchema, updateCampaignSchema } from '@/lib/validators/campaign';

describe('createCampaignSchema', () => {
  const validInput = {
    title: 'Help First Responder Mike Recover',
    slug: 'help-first-responder-mike-recover',
    category: 'first-responders' as const,
    heroImageUrl: 'https://example.com/hero.webp',
    subjectName: 'Mike Torres',
    storyHtml: '<p>Mike was injured in the line of duty and needs support for his recovery and family expenses.</p>',
    goalAmount: 1_000_000,
  };

  it('accepts valid campaign input', () => {
    const result = createCampaignSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts all 23 valid categories', () => {
    const categories = [
      'medical', 'disaster', 'military', 'veterans',
      'memorial', 'first-responders', 'community', 'essential-needs',
      'emergency', 'charity', 'education', 'animal',
      'environment', 'business', 'competition', 'creative',
      'event', 'faith', 'family', 'sports',
      'travel', 'volunteer', 'wishes',
    ] as const;
    for (const category of categories) {
      const result = createCampaignSchema.safeParse({ ...validInput, category });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid category', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, category: 'nonexistent-category' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, slug: 'has spaces here' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase letters', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, slug: 'Has-Uppercase' });
    expect(result.success).toBe(false);
  });

  it('rejects slug shorter than 3 characters', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, slug: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects slug longer than 100 characters', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, slug: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const { title, ...noTitle } = validInput;
    const result = createCampaignSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('rejects title shorter than 5 characters', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, title: 'Hi' });
    expect(result.success).toBe(false);
  });

  it('rejects missing heroImageUrl', () => {
    const { heroImageUrl, ...noImage } = validInput;
    const result = createCampaignSchema.safeParse(noImage);
    expect(result.success).toBe(false);
  });

  it('rejects invalid heroImageUrl (not a URL)', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, heroImageUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects storyHtml shorter than 50 characters', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, storyHtml: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('rejects goalAmount below 100,000 cents ($1,000)', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, goalAmount: 99_999 });
    expect(result.success).toBe(false);
  });

  it('rejects goalAmount above 10,000,000 cents ($100,000)', () => {
    const result = createCampaignSchema.safeParse({ ...validInput, goalAmount: 10_000_001 });
    expect(result.success).toBe(false);
  });

  it('accepts valid impactTiers', () => {
    const result = createCampaignSchema.safeParse({
      ...validInput,
      impactTiers: [
        { amount: 2500, label: 'Send a care package' },
        { amount: 10000, label: 'Cover a week of bills' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects impactTiers with more than 10 items', () => {
    const tiers = Array.from({ length: 11 }, (_, i) => ({
      amount: (i + 1) * 1000,
      label: `Tier ${i + 1} with enough chars`,
    }));
    const result = createCampaignSchema.safeParse({ ...validInput, impactTiers: tiers });
    expect(result.success).toBe(false);
  });

  it('defaults impactTiers to empty array', () => {
    const result = createCampaignSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.impactTiers).toEqual([]);
    }
  });

  it('defaults status to draft', () => {
    const result = createCampaignSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
    }
  });

  it('rejects missing subjectName', () => {
    const { subjectName, ...noSubject } = validInput;
    const result = createCampaignSchema.safeParse(noSubject);
    expect(result.success).toBe(false);
  });
});

describe('updateCampaignSchema', () => {
  it('accepts partial updates', () => {
    const result = updateCampaignSchema.safeParse({ title: 'Updated Title Here' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no fields to update)', () => {
    const result = updateCampaignSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates fields that are provided', () => {
    const result = updateCampaignSchema.safeParse({ goalAmount: 50 });
    expect(result.success).toBe(false);
  });
});
