import { describe, it, expect } from 'vitest';
import { buildGenerateImpactPrompt, type GenerateImpactInput } from './generate-impact';

describe('buildGenerateImpactPrompt', () => {
  const baseInput: GenerateImpactInput = {
    subjectName: 'Maria Garcia',
    event: 'Maria was injured in a car accident and needs help with medical bills',
    category: 'medical',
    goalAmount: 500000, // $5,000
    raisedAmount: 520000, // $5,200
    donorCount: 87,
  };

  it('returns systemPrompt and userPrompt', () => {
    const result = buildGenerateImpactPrompt(baseInput);
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
    expect(typeof result.systemPrompt).toBe('string');
    expect(typeof result.userPrompt).toBe('string');
  });

  it('includes campaign details in userPrompt', () => {
    const result = buildGenerateImpactPrompt(baseInput);
    expect(result.userPrompt).toContain('Maria Garcia');
    expect(result.userPrompt).toContain('medical');
    expect(result.userPrompt).toContain('87');
    expect(result.userPrompt).toContain('$5,000');
    expect(result.userPrompt).toContain('$5,200');
  });

  it('includes last donor name when provided', () => {
    const result = buildGenerateImpactPrompt({
      ...baseInput,
      lastDonorName: 'James Wilson',
    });
    expect(result.userPrompt).toContain('James Wilson');
    expect(result.userPrompt).toContain('Last Donor');
  });

  it('omits last donor data line when not provided', () => {
    const result = buildGenerateImpactPrompt(baseInput);
    // The prompt instructions mention "Last Donor" generically, but there should be
    // no "Last Donor: <name>" data line when lastDonorName is omitted
    expect(result.userPrompt).not.toMatch(/^Last Donor:/m);
  });

  it('systemPrompt instructs 3-paragraph impact report', () => {
    const result = buildGenerateImpactPrompt(baseInput);
    expect(result.systemPrompt).toContain('impact report');
    expect(result.systemPrompt).toContain('3-paragraph');
  });

  it('userPrompt requests recap, disbursement, and thank-you sections', () => {
    const result = buildGenerateImpactPrompt(baseInput);
    expect(result.userPrompt).toContain('Recap');
    expect(result.userPrompt).toContain('Disbursement');
    expect(result.userPrompt).toContain('Thank you');
  });

  it('handles edge case of zero donors', () => {
    const result = buildGenerateImpactPrompt({ ...baseInput, donorCount: 0 });
    expect(result.userPrompt).toContain('Total Donors: 0');
  });

  it('formats large dollar amounts with commas', () => {
    const result = buildGenerateImpactPrompt({
      ...baseInput,
      goalAmount: 10000000, // $100,000
      raisedAmount: 10500000, // $105,000
    });
    expect(result.userPrompt).toContain('$100,000');
    expect(result.userPrompt).toContain('$105,000');
  });

  it('works with all campaign categories', () => {
    const categories = [
      'medical', 'disaster', 'military', 'veterans', 'memorial',
      'first-responders', 'community', 'essential-needs', 'emergency',
      'charity', 'education', 'animal', 'environment', 'business',
      'competition', 'creative', 'event', 'faith', 'family',
      'sports', 'travel', 'volunteer', 'wishes',
    ] as const;

    for (const category of categories) {
      const result = buildGenerateImpactPrompt({ ...baseInput, category });
      expect(result.userPrompt).toContain(category);
    }
  });
});
