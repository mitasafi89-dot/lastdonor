import { describe, it, expect } from 'vitest';
import { getCampaignPhase, getPhaseLabel, getPhasePercentRange } from '@/lib/utils/phase';

describe('getCampaignPhase', () => {
  it('returns first_believers at 0%', () => {
    expect(getCampaignPhase(0, 10000)).toBe('first_believers');
  });

  it('returns first_believers at exactly 25%', () => {
    expect(getCampaignPhase(2500, 10000)).toBe('first_believers');
  });

  it('returns the_push at 26%', () => {
    expect(getCampaignPhase(2600, 10000)).toBe('the_push');
  });

  it('returns the_push at exactly 60%', () => {
    expect(getCampaignPhase(6000, 10000)).toBe('the_push');
  });

  it('returns closing_in at 61%', () => {
    expect(getCampaignPhase(6100, 10000)).toBe('closing_in');
  });

  it('returns closing_in at exactly 90%', () => {
    expect(getCampaignPhase(9000, 10000)).toBe('closing_in');
  });

  it('returns last_donor_zone at 91%', () => {
    expect(getCampaignPhase(9100, 10000)).toBe('last_donor_zone');
  });

  it('returns last_donor_zone at 100%', () => {
    expect(getCampaignPhase(10000, 10000)).toBe('last_donor_zone');
  });

  it('returns first_believers when goalAmount is 0', () => {
    expect(getCampaignPhase(5000, 0)).toBe('first_believers');
  });

  it('returns first_believers when goalAmount is negative', () => {
    expect(getCampaignPhase(5000, -100)).toBe('first_believers');
  });

  it('returns last_donor_zone when raised exceeds goal (>100%)', () => {
    expect(getCampaignPhase(15000, 10000)).toBe('last_donor_zone');
  });

  it('returns first_believers when both amounts are 0', () => {
    expect(getCampaignPhase(0, 0)).toBe('first_believers');
  });

  it('handles fractional percentage that floors to boundary', () => {
    // 2550/10000 = 25.5% → Math.floor = 25 → first_believers
    expect(getCampaignPhase(2550, 10000)).toBe('first_believers');
  });

  it('handles small amounts near boundary', () => {
    // 251/1000 = 25.1% → Math.floor = 25 → first_believers
    expect(getCampaignPhase(251, 1000)).toBe('first_believers');
  });
});

describe('getPhaseLabel', () => {
  it('returns "First Believers" for first_believers', () => {
    expect(getPhaseLabel('first_believers')).toBe('First Believers');
  });

  it('returns "The Push" for the_push', () => {
    expect(getPhaseLabel('the_push')).toBe('The Push');
  });

  it('returns "Closing In" for closing_in', () => {
    expect(getPhaseLabel('closing_in')).toBe('Closing In');
  });

  it('returns "Last Donor Zone" for last_donor_zone', () => {
    expect(getPhaseLabel('last_donor_zone')).toBe('Last Donor Zone');
  });
});

describe('getPhasePercentRange', () => {
  it('returns 0-25 for first_believers', () => {
    expect(getPhasePercentRange('first_believers')).toEqual({ min: 0, max: 25 });
  });

  it('returns 26-60 for the_push', () => {
    expect(getPhasePercentRange('the_push')).toEqual({ min: 26, max: 60 });
  });

  it('returns 61-90 for closing_in', () => {
    expect(getPhasePercentRange('closing_in')).toEqual({ min: 61, max: 90 });
  });

  it('returns 91-100 for last_donor_zone', () => {
    expect(getPhasePercentRange('last_donor_zone')).toEqual({ min: 91, max: 100 });
  });
});
