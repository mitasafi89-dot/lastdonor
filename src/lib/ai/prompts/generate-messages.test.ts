import { describe, it, expect } from 'vitest';
import { buildGenerateMessagesPrompt } from '@/lib/ai/prompts/generate-messages';
import type { CampaignCategory, DonationPhase } from '@/types';

const BASE_INPUT = {
  name: 'Michael Torres',
  age: 34,
  event: 'Injured in warehouse collapse',
  hometown: 'Houston, TX',
  family: ['wife Maria', 'son Diego (8)', 'daughter Sofia (5)'],
  goal: 25000,
  category: 'medical' as CampaignCategory,
  phase: 'first_believers' as DonationPhase,
};

describe('buildGenerateMessagesPrompt', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
    expect(result.systemPrompt).toContain('JSON array');
  });

  it('defaults count to 30', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.systemPrompt).toContain('30');
    expect(result.userPrompt).toContain('Generate 30');
  });

  it('uses provided count', () => {
    const result = buildGenerateMessagesPrompt({ ...BASE_INPUT, count: 15 });
    expect(result.systemPrompt).toContain('15');
    expect(result.userPrompt).toContain('Generate 15');
  });

  it('includes subject name by first and last for specificity', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('"Michael"');
    expect(result.userPrompt).toContain('"Torres"');
  });

  it('includes hometown reference for location specificity', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('"Houston"');
  });

  it('includes family references', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('"wife Maria"');
  });

  it('includes phase guidance for first_believers', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('pioneer spirit');
    expect(result.userPrompt).toContain('EARLY donors');
  });

  it('includes phase guidance for last_donor_zone', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      phase: 'last_donor_zone',
    });
    expect(result.userPrompt).toContain('Maximum urgency');
    expect(result.userPrompt).toContain('LAST donor');
  });

  it('includes campaign age context when provided', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      campaignAgeDays: 5,
      donorCount: 42,
      percentage: 35,
    });
    expect(result.userPrompt).toContain('Campaign Age: 5 days old');
    expect(result.userPrompt).toContain('Total Donors So Far: 42');
    expect(result.userPrompt).toContain('Funded: 35%');
  });

  it('includes campaign age guidance for new campaigns', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      campaignAgeDays: 0,
      donorCount: 0,
      percentage: 0,
    });
    expect(result.userPrompt).toContain('BRAND NEW');
  });

  it('includes campaign age guidance for established campaigns', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      campaignAgeDays: 30,
      donorCount: 200,
      percentage: 65,
    });
    expect(result.userPrompt).toContain('ESTABLISHED');
  });

  it('includes existing messages for tonal continuity', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      existingMessages: [
        'Stay strong Michael!',
        'Praying for the Torres family',
        'Houston stands with you',
      ],
    });
    expect(result.userPrompt).toContain('EXISTING MESSAGES');
    expect(result.userPrompt).toContain('Stay strong Michael!');
    expect(result.userPrompt).toContain('Houston stands with you');
  });

  it('includes category-specific persona emphasis for medical', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('nurses');
    expect(result.userPrompt).toContain('fellow patients');
  });

  it('includes category-specific persona emphasis for military', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      category: 'military',
    });
    expect(result.userPrompt).toContain('veterans');
    expect(result.userPrompt).toContain('battle buddies');
  });

  it('omits context fields that are undefined', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).not.toContain('Campaign Age:');
    expect(result.userPrompt).not.toContain('Total Donors So Far:');
    expect(result.userPrompt).not.toContain('Funded:');
  });

  it('includes the NEVER rules', () => {
    const result = buildGenerateMessagesPrompt(BASE_INPUT);
    expect(result.userPrompt).toContain('Mention donation amounts');
    expect(result.userPrompt).toContain('Sound like an AI');
    expect(result.userPrompt).toContain('corporate statement');
  });

  it('includes unit and department when provided', () => {
    const result = buildGenerateMessagesPrompt({
      ...BASE_INPUT,
      unit: '82nd Airborne',
      department: 'Charlie Company',
    });
    expect(result.userPrompt).toContain('82nd Airborne');
    expect(result.userPrompt).toContain('Charlie Company');
  });
});
