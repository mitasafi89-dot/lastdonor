/**
 * M11 — 7.3 Cross-Campaign Indistinguishability Test
 *
 * Verifies that the public data boundary produces identical response
 * shapes for simulated and real campaigns — no extra or missing fields.
 *
 * Strategy:
 *   1. Assert that publicCampaignSelect, publicCampaignCardSelect,
 *      publicDonationSelect, and publicMessageSelect have a fixed,
 *      known set of keys.
 *   2. Verify that a simulated campaign response and a real campaign
 *      response will have the SAME set of JSON keys (because both
 *      use the same select objects).
 *   3. Verify campaign sort keys from public listing include no
 *      simulation-related fields.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  publicCampaignSelect,
  publicCampaignCardSelect,
  publicDonationSelect,
  publicMessageSelect,
} from '@/db/public-select';

/** Expected public campaign detail keys — sorted alphabetically. */
const EXPECTED_CAMPAIGN_KEYS = [
  'campaignOrganizer',
  'category',
  'completedAt',
  'createdAt',
  'creatorId',
  'donorCount',
  'fundUsagePlan',
  'goalAmount',
  'heroImageUrl',
  'id',
  'impactTiers',
  'lastDonorAmount',
  'lastDonorId',
  'lastDonorName',
  'location',
  'pausedReason',
  'photoCredit',
  'publishedAt',
  'raisedAmount',
  'slug',
  'status',
  'storyHtml',
  'subjectHometown',
  'subjectName',
  'suspendedReason',
  'title',
  'totalReleasedAmount',
  'updatedAt',
  'verificationStatus',
  'cancellationReason',
  'cancellationNotes',
  'cancelledAt',
].sort();

/** Expected public campaign card keys — sorted. */
const EXPECTED_CARD_KEYS = [
  'category',
  'campaignOrganizer',
  'donorCount',
  'goalAmount',
  'heroImageUrl',
  'id',
  'location',
  'publishedAt',
  'raisedAmount',
  'slug',
  'status',
  'subjectHometown',
  'subjectName',
  'title',
  'verificationStatus',
].sort();

/** Expected public donation keys — sorted. */
const EXPECTED_DONATION_KEYS = [
  'amount',
  'createdAt',
  'donorLocation',
  'donorName',
  'id',
  'isAnonymous',
  'message',
].sort();

/** Expected public message keys — sorted. */
const EXPECTED_MESSAGE_KEYS = [
  'createdAt',
  'donorLocation',
  'donorName',
  'id',
  'isAnonymous',
  'message',
].sort();

/** Keys that must NEVER appear in any public select. */
const SIMULATION_KEYS = [
  'simulationFlag',
  'simulationConfig',
  'source',
  'campaignProfile',
  'stripePaymentId',
  'donorEmail',
  'flagged',
  'hidden',
  'userId',
  'donationId',
  'refunded',
  'phaseAtTime',
];

describe('Cross-Campaign Indistinguishability', () => {
  describe('publicCampaignSelect schema stability', () => {
    const keys = Object.keys(publicCampaignSelect).sort();

    it('has exactly the expected set of keys', () => {
      expect(keys).toEqual(EXPECTED_CAMPAIGN_KEYS);
    });

    for (const forbidden of SIMULATION_KEYS) {
      it(`does not contain "${forbidden}"`, () => {
        expect(keys).not.toContain(forbidden);
      });
    }
  });

  describe('publicCampaignCardSelect schema stability', () => {
    const keys = Object.keys(publicCampaignCardSelect).sort();

    it('has exactly the expected set of keys', () => {
      expect(keys).toEqual(EXPECTED_CARD_KEYS);
    });

    for (const forbidden of SIMULATION_KEYS) {
      it(`does not contain "${forbidden}"`, () => {
        expect(keys).not.toContain(forbidden);
      });
    }
  });

  describe('publicDonationSelect schema stability', () => {
    const keys = Object.keys(publicDonationSelect).sort();

    it('has exactly the expected set of keys', () => {
      expect(keys).toEqual(EXPECTED_DONATION_KEYS);
    });

    for (const forbidden of SIMULATION_KEYS) {
      it(`does not contain "${forbidden}"`, () => {
        expect(keys).not.toContain(forbidden);
      });
    }
  });

  describe('publicMessageSelect schema stability', () => {
    const keys = Object.keys(publicMessageSelect).sort();

    it('has exactly the expected set of keys', () => {
      expect(keys).toEqual(EXPECTED_MESSAGE_KEYS);
    });

    for (const forbidden of SIMULATION_KEYS) {
      it(`does not contain "${forbidden}"`, () => {
        expect(keys).not.toContain(forbidden);
      });
    }
  });

  describe('Key parity between selects', () => {
    it('campaign detail is a superset of campaign card (card has no extra keys)', () => {
      const detailKeys = new Set(Object.keys(publicCampaignSelect));
      const cardKeys = Object.keys(publicCampaignCardSelect);
      for (const key of cardKeys) {
        expect(detailKeys.has(key), `Card key "${key}" not in detail select`).toBe(true);
      }
    });

    it('donation and message selects share common fields', () => {
      const donationKeys = new Set(Object.keys(publicDonationSelect));
      const messageKeys = new Set(Object.keys(publicMessageSelect));
      // Both should have id, donorName, donorLocation, message, isAnonymous, createdAt
      for (const shared of ['id', 'donorName', 'donorLocation', 'message', 'isAnonymous', 'createdAt']) {
        expect(donationKeys.has(shared), `Donation missing "${shared}"`).toBe(true);
        expect(messageKeys.has(shared), `Message missing "${shared}"`).toBe(true);
      }
    });
  });
});
