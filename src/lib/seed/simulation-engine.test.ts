import { describe, it, expect, vi } from 'vitest';
import type { Campaign } from '@/types';

// Mock AI and DB modules before importing the module under test
vi.mock('@/lib/ai/call-ai', () => ({
  callAI: vi.fn().mockResolvedValue('mocked AI response'),
}));
vi.mock('@/lib/ai/openrouter', () => ({
  ai: {},
}));
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

// Import after mocks are set up
const { canAcceptDonation, OVERFUND_CAP_PERCENT, OVERFUND_WINDOW_MS } = await import('./simulation-engine');

function buildTestCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Campaign',
    slug: 'test-campaign',
    status: 'active',
    heroImageUrl: '/img.jpg',
    photoCredit: null,
    storyHtml: '<p>Test</p>',
    goalAmount: 1_000_00, // $1,000
    raisedAmount: 500_00,
    donorCount: 10,
    category: 'medical',
    location: 'Portland, OR',
    subjectName: 'Test Subject',
    subjectHometown: 'Portland, OR',
    impactTiers: [],
    campaignProfile: null,
    campaignOrganizer: null,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    completedAt: null,
    lastDonorId: null,
    lastDonorName: null,
    lastDonorAmount: null,
    ...overrides,
  } as Campaign;
}

describe('canAcceptDonation', () => {
  describe('pre-goal campaigns', () => {
    it('accepts donations when raisedAmount < goalAmount', () => {
      const campaign = buildTestCampaign({ raisedAmount: 50000, goalAmount: 100000 });
      expect(canAcceptDonation(campaign)).toBe(true);
    });

    it('accepts donations at 0% funded', () => {
      const campaign = buildTestCampaign({ raisedAmount: 0, goalAmount: 100000 });
      expect(canAcceptDonation(campaign)).toBe(true);
    });

    it('accepts donations at 99% funded', () => {
      const campaign = buildTestCampaign({ raisedAmount: 99000, goalAmount: 100000 });
      expect(canAcceptDonation(campaign)).toBe(true);
    });
  });

  describe('goal just crossed (no completedAt yet)', () => {
    it('allows overfunding when raisedAmount equals goalAmount', () => {
      const campaign = buildTestCampaign({
        raisedAmount: 100000,
        goalAmount: 100000,
        completedAt: null,
      });
      expect(canAcceptDonation(campaign)).toBe(true);
    });

    it('allows overfunding up to 150% cap without completedAt', () => {
      const campaign = buildTestCampaign({
        raisedAmount: 149000,
        goalAmount: 100000,
        completedAt: null,
      });
      expect(canAcceptDonation(campaign)).toBe(true);
    });

    it('rejects overfunding at or above 150% cap without completedAt', () => {
      const campaign = buildTestCampaign({
        raisedAmount: 150000,
        goalAmount: 100000,
        completedAt: null,
      });
      expect(canAcceptDonation(campaign)).toBe(false);
    });
  });

  describe('post-goal with completedAt (overfunding window)', () => {
    it('allows donations within 48-hour window and under 150% cap', () => {
      const recentCompletion = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const campaign = buildTestCampaign({
        raisedAmount: 110000,
        goalAmount: 100000,
        completedAt: recentCompletion,
      });
      expect(canAcceptDonation(campaign)).toBe(true);
    });

    it('allows donations at exactly 48 hours minus 1ms', () => {
      const almostExpired = new Date(Date.now() - OVERFUND_WINDOW_MS + 1);
      const campaign = buildTestCampaign({
        raisedAmount: 110000,
        goalAmount: 100000,
        completedAt: almostExpired,
      });
      expect(canAcceptDonation(campaign)).toBe(true);
    });

    it('rejects donations after 48-hour window expires', () => {
      const expired = new Date(Date.now() - OVERFUND_WINDOW_MS - 1);
      const campaign = buildTestCampaign({
        raisedAmount: 110000,
        goalAmount: 100000,
        completedAt: expired,
      });
      expect(canAcceptDonation(campaign)).toBe(false);
    });

    it('rejects donations at exactly 48 hours', () => {
      const exactlyExpired = new Date(Date.now() - OVERFUND_WINDOW_MS - 1);
      const campaign = buildTestCampaign({
        raisedAmount: 110000,
        goalAmount: 100000,
        completedAt: exactlyExpired,
      });
      expect(canAcceptDonation(campaign)).toBe(false);
    });

    it('rejects donations within window but at 150% cap', () => {
      const recentCompletion = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const campaign = buildTestCampaign({
        raisedAmount: 150000,
        goalAmount: 100000,
        completedAt: recentCompletion,
      });
      expect(canAcceptDonation(campaign)).toBe(false);
    });

    it('rejects donations within window but above 150% cap', () => {
      const recentCompletion = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const campaign = buildTestCampaign({
        raisedAmount: 160000,
        goalAmount: 100000,
        completedAt: recentCompletion,
      });
      expect(canAcceptDonation(campaign)).toBe(false);
    });

    it('rejects donations expired AND over cap', () => {
      const expired = new Date(Date.now() - OVERFUND_WINDOW_MS - 1);
      const campaign = buildTestCampaign({
        raisedAmount: 160000,
        goalAmount: 100000,
        completedAt: expired,
      });
      expect(canAcceptDonation(campaign)).toBe(false);
    });
  });

  describe('constants', () => {
    it('OVERFUND_CAP_PERCENT is 150%', () => {
      expect(OVERFUND_CAP_PERCENT).toBe(1.50);
    });

    it('OVERFUND_WINDOW_MS is 48 hours', () => {
      expect(OVERFUND_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
    });
  });
});
