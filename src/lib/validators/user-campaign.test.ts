import { describe, it, expect } from 'vitest';
import { createUserCampaignSchema, updateUserCampaignSchema, CATEGORIES, BENEFICIARY_RELATIONS } from './user-campaign';

describe('createUserCampaignSchema', () => {
  const validMilestones = [
    { title: 'Initial medical expenses', description: 'Cover the first round of hospital bills and medication', fundPercentage: 30 },
    { title: 'Ongoing treatment costs', description: 'Physical therapy and follow-up appointments over the next months', fundPercentage: 40 },
    { title: 'Recovery and rehabilitation', description: 'Final recovery costs including home care and medical equipment', fundPercentage: 30 },
  ];

  const valid = {
    subjectName: 'John Doe',
    subjectHometown: 'Austin, TX',
    beneficiaryRelation: 'family' as const,
    category: 'medical' as const,
    beneficiaryConsent: true,
    title: 'Help John recover from surgery complications',
    story: 'A'.repeat(500),
    goalAmount: 50_000,
    fundUsagePlan: 'B'.repeat(100),
    milestones: validMilestones,
    heroImageUrl: 'https://example.com/photo.jpg',
    agreedToTerms: true as const,
    confirmedTruthful: true as const,
  };

  it('accepts valid input with all required fields', () => {
    const result = createUserCampaignSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts with optional photoCredit', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      photoCredit: 'Photo by Jane Smith',
    });
    expect(result.success).toBe(true);
  });

  // ── subjectName ────────────────────────────────────────────────────────

  it('rejects empty subjectName', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, subjectName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects subjectName shorter than 2 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, subjectName: 'A' });
    expect(result.success).toBe(false);
  });

  // ── subjectHometown (required) ─────────────────────────────────────────

  it('rejects missing subjectHometown', () => {
    const { subjectHometown: _subjectHometown, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects subjectHometown shorter than 2 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, subjectHometown: 'A' });
    expect(result.success).toBe(false);
  });

  // ── beneficiaryRelation ────────────────────────────────────────────────

  it('rejects missing beneficiaryRelation', () => {
    const { beneficiaryRelation: _beneficiaryRelation, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid beneficiaryRelation', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, beneficiaryRelation: 'enemy' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid beneficiary relations', () => {
    for (const rel of BENEFICIARY_RELATIONS) {
      const data = {
        ...valid,
        beneficiaryRelation: rel,
        beneficiaryConsent: rel === 'self' ? false : true,
      };
      const result = createUserCampaignSchema.safeParse(data);
      expect(result.success, `relation "${rel}" should be valid`).toBe(true);
    }
  });

  // ── beneficiaryConsent (conditional refine) ────────────────────────────

  it('allows beneficiaryConsent=false when relation is self', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      beneficiaryRelation: 'self',
      beneficiaryConsent: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects beneficiaryConsent=false when relation is not self', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      beneficiaryRelation: 'friend',
      beneficiaryConsent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('beneficiaryConsent');
    }
  });

  it('requires beneficiaryConsent=true for all non-self relations', () => {
    const nonSelf = BENEFICIARY_RELATIONS.filter((r) => r !== 'self');
    for (const rel of nonSelf) {
      const result = createUserCampaignSchema.safeParse({
        ...valid,
        beneficiaryRelation: rel,
        beneficiaryConsent: false,
      });
      expect(result.success, `relation "${rel}" without consent should fail`).toBe(false);
    }
  });

  // ── title ──────────────────────────────────────────────────────────────

  it('rejects title shorter than 20 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, title: 'Help John' });
    expect(result.success).toBe(false);
  });

  it('rejects title longer than 120 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, title: 'X'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('accepts title at exactly 20 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, title: 'A'.repeat(20) });
    expect(result.success).toBe(true);
  });

  // ── story ──────────────────────────────────────────────────────────────

  it('rejects story shorter than 200 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(199) });
    expect(result.success).toBe(false);
  });

  it('rejects story longer than 10000 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(10001) });
    expect(result.success).toBe(false);
  });

  it('accepts story at exactly 200 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(200) });
    expect(result.success).toBe(true);
  });

  // ── goalAmount ─────────────────────────────────────────────────────────

  it('rejects goalAmount below $50 (5000 cents)', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, goalAmount: 4999 });
    expect(result.success).toBe(false);
  });

  it('rejects goalAmount above $50,000 (5,000,000 cents)', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, goalAmount: 5_000_001 });
    expect(result.success).toBe(false);
  });

  it('accepts goalAmount at exactly $50 (5000 cents)', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, goalAmount: 5000 });
    expect(result.success).toBe(true);
  });

  // ── fundUsagePlan ──────────────────────────────────────────────────────

  it('accepts fundUsagePlan with any length under 3000', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, fundUsagePlan: 'Short' });
    expect(result.success).toBe(true);
  });

  it('rejects fundUsagePlan longer than 3000 chars', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, fundUsagePlan: 'X'.repeat(3001) });
    expect(result.success).toBe(false);
  });

  it('accepts missing fundUsagePlan', () => {
    const { fundUsagePlan: _fundUsagePlan, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  // ── heroImageUrl (required) ────────────────────────────────────────────

  it('rejects missing heroImageUrl', () => {
    const { heroImageUrl: _heroImageUrl, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid heroImageUrl', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, heroImageUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  // ── agreedToTerms ──────────────────────────────────────────────────────

  it('rejects agreedToTerms=false', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, agreedToTerms: false });
    expect(result.success).toBe(false);
  });

  it('rejects missing agreedToTerms', () => {
    const { agreedToTerms: _agreedToTerms, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // ── confirmedTruthful ──────────────────────────────────────────────────

  it('rejects confirmedTruthful=false', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, confirmedTruthful: false });
    expect(result.success).toBe(false);
  });

  it('rejects missing confirmedTruthful', () => {
    const { confirmedTruthful: _confirmedTruthful, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // ── category ───────────────────────────────────────────────────────────

  it('rejects invalid category', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, category: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    for (const category of CATEGORIES) {
      const result = createUserCampaignSchema.safeParse({ ...valid, category });
      expect(result.success, `category "${category}" should be valid`).toBe(true);
    }
  });

  // ── milestones ─────────────────────────────────────────────────────────

  it('rejects missing milestones', () => {
    const { milestones: _milestones, ...rest } = valid;
    const result = createUserCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects fewer than 3 milestones', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: validMilestones.slice(0, 2),
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 3 milestones', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [...validMilestones, { title: 'Extra', description: 'Extra phase desc', fundPercentage: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects milestones with percentages not summing to 100', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Phase one description text', fundPercentage: 30 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 30 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 30 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects milestone with fundPercentage below 10', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Phase one description text', fundPercentage: 5 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 55 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 40 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects Phase 1 fundPercentage above 40', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Phase one description text', fundPercentage: 45 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 30 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 25 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts Phase 1 at exactly 40', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Phase one description text', fundPercentage: 40 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 30 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 30 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects milestone with fundPercentage above 60', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Phase one description text', fundPercentage: 70 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 15 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 15 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects milestone with title shorter than 3 chars', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Hi', description: 'Phase one description text', fundPercentage: 30 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 40 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 30 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects milestone with description shorter than 10 chars', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Short', fundPercentage: 30 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 40 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 30 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts milestones with 10/60/30 split', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      milestones: [
        { title: 'Phase one title', description: 'Phase one description text', fundPercentage: 10 },
        { title: 'Phase two title', description: 'Phase two description text', fundPercentage: 60 },
        { title: 'Phase three title', description: 'Phase three description text', fundPercentage: 30 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('updateUserCampaignSchema', () => {
  it('accepts partial updates', () => {
    const result = updateUserCampaignSchema.safeParse({
      title: 'Help John recover from surgery complications',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateUserCampaignSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects title shorter than 20 chars', () => {
    const result = updateUserCampaignSchema.safeParse({ title: 'Hi' });
    expect(result.success).toBe(false);
  });

  it('rejects story shorter than 200 chars', () => {
    const result = updateUserCampaignSchema.safeParse({ story: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('rejects fundUsagePlan shorter than 100 chars', () => {
    const result = updateUserCampaignSchema.safeParse({ fundUsagePlan: 'Short' });
    expect(result.success).toBe(false);
  });

  it('accepts valid fundUsagePlan', () => {
    const result = updateUserCampaignSchema.safeParse({ fundUsagePlan: 'X'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('rejects invalid heroImageUrl', () => {
    const result = updateUserCampaignSchema.safeParse({ heroImageUrl: 'bad' });
    expect(result.success).toBe(false);
  });
});
