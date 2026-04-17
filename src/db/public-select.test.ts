import { describe, it, expect } from 'vitest';
import {
  publicCampaignSelect,
  publicCampaignCardSelect,
  publicDonationSelect,
  publicMessageSelect,
} from './public-select';

/**
 * Security tests: ensure internal/sensitive columns are NEVER exposed
 * through public select objects.
 *
 * If any of these assertions fail, it means a sensitive column was
 * added to a public-facing query - which is a data-leak vulnerability.
 */

const FORBIDDEN_CAMPAIGN_KEYS = [
  'simulationFlag',
  'simulationConfig',
  'source',
  'campaignProfile',
] as const;

const FORBIDDEN_DONATION_KEYS = [
  'stripePaymentId',
  'donorEmail',
  'source',
] as const;

const FORBIDDEN_MESSAGE_KEYS = [
  'flagged',
  'hidden',
  'userId',
  'donationId',
] as const;

describe('publicCampaignSelect', () => {
  for (const key of FORBIDDEN_CAMPAIGN_KEYS) {
    it(`must NOT contain "${key}"`, () => {
      expect(Object.keys(publicCampaignSelect)).not.toContain(key);
    });
  }

  it('contains expected public fields', () => {
    const keys = Object.keys(publicCampaignSelect);
    expect(keys).toContain('id');
    expect(keys).toContain('title');
    expect(keys).toContain('slug');
    expect(keys).toContain('goalAmount');
    expect(keys).toContain('raisedAmount');
  });
});

describe('publicCampaignCardSelect', () => {
  for (const key of FORBIDDEN_CAMPAIGN_KEYS) {
    it(`must NOT contain "${key}"`, () => {
      expect(Object.keys(publicCampaignCardSelect)).not.toContain(key);
    });
  }
});

describe('publicDonationSelect', () => {
  for (const key of FORBIDDEN_DONATION_KEYS) {
    it(`must NOT contain "${key}"`, () => {
      expect(Object.keys(publicDonationSelect)).not.toContain(key);
    });
  }

  it('contains expected public fields', () => {
    const keys = Object.keys(publicDonationSelect);
    expect(keys).toContain('id');
    expect(keys).toContain('donorName');
    expect(keys).toContain('amount');
  });
});

describe('publicMessageSelect', () => {
  for (const key of FORBIDDEN_MESSAGE_KEYS) {
    it(`must NOT contain "${key}"`, () => {
      expect(Object.keys(publicMessageSelect)).not.toContain(key);
    });
  }

  it('contains expected public fields', () => {
    const keys = Object.keys(publicMessageSelect);
    expect(keys).toContain('id');
    expect(keys).toContain('donorName');
    expect(keys).toContain('message');
  });
});
