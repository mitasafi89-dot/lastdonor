import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ---------- mocks ---------- */

vi.mock('server-only', () => ({}));

const mockGetSetting = vi.fn();
vi.mock('@/lib/settings.server', () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
}));

// Chainable DB mock
const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
vi.mock('@/db', () => ({
  db: { select: (..._args: unknown[]) => mockSelect() },
}));

vi.mock('@/db/schema', () => ({
  campaigns: {
    simulationFlag: 'simulation_flag',
    status: 'status',
  },
}));

/* ---------- import under test ---------- */

const { calculateAutoVolume } = await import('@/lib/seed/phase-out');

/* ---------- helpers ---------- */

function setupSettings(overrides: Partial<{
  enabled: boolean;
  low: number;
  mid: number;
  high: number;
}> = {}) {
  const { enabled = true, low = 10, mid = 25, high = 50 } = overrides;
  mockGetSetting.mockImplementation((key: string) => {
    switch (key) {
      case 'simulation.phase_out.enabled': return Promise.resolve(enabled);
      case 'simulation.phase_out.threshold_low': return Promise.resolve(low);
      case 'simulation.phase_out.threshold_mid': return Promise.resolve(mid);
      case 'simulation.phase_out.threshold_high': return Promise.resolve(high);
      default: return Promise.resolve(null);
    }
  });
}

function setRealCampaignCount(count: number) {
  mockWhere.mockResolvedValue([{ count }]);
}

/* ---------- tests ---------- */

describe('calculateAutoVolume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns -1 when phase-out is disabled', async () => {
    setupSettings({ enabled: false });
    const result = await calculateAutoVolume();
    expect(result).toBe(-1);
    // Should not query DB at all
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns 1.0 when below low threshold', async () => {
    setupSettings({ low: 10 });
    setRealCampaignCount(5);
    expect(await calculateAutoVolume()).toBe(1.0);
  });

  it('returns 0.7 when at low threshold', async () => {
    setupSettings({ low: 10 });
    setRealCampaignCount(10);
    expect(await calculateAutoVolume()).toBe(0.7);
  });

  it('returns 0.7 when between low and mid thresholds', async () => {
    setupSettings({ low: 10, mid: 25 });
    setRealCampaignCount(15);
    expect(await calculateAutoVolume()).toBe(0.7);
  });

  it('returns 0.3 when at mid threshold', async () => {
    setupSettings({ mid: 25 });
    setRealCampaignCount(25);
    expect(await calculateAutoVolume()).toBe(0.3);
  });

  it('returns 0.3 when between mid and high thresholds', async () => {
    setupSettings({ mid: 25, high: 50 });
    setRealCampaignCount(35);
    expect(await calculateAutoVolume()).toBe(0.3);
  });

  it('returns 0.0 when at high threshold', async () => {
    setupSettings({ high: 50 });
    setRealCampaignCount(50);
    expect(await calculateAutoVolume()).toBe(0.0);
  });

  it('returns 0.0 when above high threshold', async () => {
    setupSettings({ high: 50 });
    setRealCampaignCount(100);
    expect(await calculateAutoVolume()).toBe(0.0);
  });

  it('respects custom threshold values', async () => {
    setupSettings({ low: 5, mid: 15, high: 30 });
    setRealCampaignCount(0);
    expect(await calculateAutoVolume()).toBe(1.0);

    setRealCampaignCount(5);
    expect(await calculateAutoVolume()).toBe(0.7);

    setRealCampaignCount(15);
    expect(await calculateAutoVolume()).toBe(0.3);

    setRealCampaignCount(30);
    expect(await calculateAutoVolume()).toBe(0.0);
  });

  it('returns 1.0 when zero real campaigns', async () => {
    setupSettings();
    setRealCampaignCount(0);
    expect(await calculateAutoVolume()).toBe(1.0);
  });

  it.each([
    { count: 0, expected: 1.0 },
    { count: 9, expected: 1.0 },
    { count: 10, expected: 0.7 },
    { count: 24, expected: 0.7 },
    { count: 25, expected: 0.3 },
    { count: 49, expected: 0.3 },
    { count: 50, expected: 0.0 },
    { count: 200, expected: 0.0 },
  ])('returns $expected when $count real campaigns (default thresholds)', async ({ count, expected }) => {
    setupSettings();
    setRealCampaignCount(count);
    expect(await calculateAutoVolume()).toBe(expected);
  });
});
