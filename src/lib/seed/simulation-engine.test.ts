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
const { canAcceptDonation, OVERFUND_CAP_PERCENT, OVERFUND_WINDOW_MS, getETHour, getETDay } = await import('./simulation-engine');

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

// ── DST-Aware ET Helpers ────────────────────────────────────────────────────

describe('getETHour', () => {
  it('returns a number 0-23 for any date', () => {
    const hour = getETHour(new Date());
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });

  it('handles midnight UTC (should be ET evening the previous day)', () => {
    // Midnight UTC = 7pm ET (EST) or 8pm ET (EDT)
    const midnightUtc = new Date('2026-01-15T00:00:00Z'); // January = EST (UTC-5)
    const hour = getETHour(midnightUtc);
    expect(hour).toBe(19); // 7pm ET
  });

  it('handles noon UTC', () => {
    const noonUtc = new Date('2026-01-15T12:00:00Z'); // January = EST
    const hour = getETHour(noonUtc);
    expect(hour).toBe(7); // 7am ET
  });

  it('handles EDT (summer) dates correctly', () => {
    // July = EDT (UTC-4), so noon UTC = 8am ET
    const summerNoon = new Date('2026-07-15T12:00:00Z');
    const hour = getETHour(summerNoon);
    expect(hour).toBe(8); // 8am ET (EDT)
  });

  it('handles EST (winter) dates correctly', () => {
    // January = EST (UTC-5), so noon UTC = 7am ET
    const winterNoon = new Date('2026-01-15T12:00:00Z');
    const hour = getETHour(winterNoon);
    expect(hour).toBe(7); // 7am ET (EST)
  });

  it('DST transition: spring forward shifts by 1 hour', () => {
    // 2026 spring forward: March 8. Check March 9 vs March 7.
    const beforeDST = new Date('2026-03-07T17:00:00Z'); // March 7, 5pm UTC = noon EST (12pm)
    const afterDST = new Date('2026-03-09T17:00:00Z'); // March 9, 5pm UTC = 1pm EDT (13pm)
    expect(getETHour(beforeDST)).toBe(12); // noon EST
    expect(getETHour(afterDST)).toBe(13);  // 1pm EDT
  });
});

describe('getETDay', () => {
  it('returns a number 0-6', () => {
    const day = getETDay(new Date());
    expect(day).toBeGreaterThanOrEqual(0);
    expect(day).toBeLessThanOrEqual(6);
  });

  it('correctly identifies Sunday as 0', () => {
    // 2026-01-04 is a Sunday
    const sunday = new Date('2026-01-04T15:00:00Z');
    expect(getETDay(sunday)).toBe(0);
  });

  it('correctly identifies Saturday as 6', () => {
    // 2026-01-03 is a Saturday
    const saturday = new Date('2026-01-03T15:00:00Z');
    expect(getETDay(saturday)).toBe(6);
  });

  it('returns correct day near midnight ET boundary', () => {
    // Friday at 11pm ET (4am UTC Saturday) should still be Friday in ET
    // 2026-01-02 (Fri) at 11pm ET = 2026-01-03 4am UTC
    const fridayNightET = new Date('2026-01-03T04:00:00Z');
    expect(getETDay(fridayNightET)).toBe(5); // Friday
  });

  it('correctly transitions to Saturday after midnight ET', () => {
    // Saturday at 1am ET = 6am UTC
    const saturdayMorningET = new Date('2026-01-03T06:00:00Z');
    expect(getETDay(saturdayMorningET)).toBe(6); // Saturday
  });
});
