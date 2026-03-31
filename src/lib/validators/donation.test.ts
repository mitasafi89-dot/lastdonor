import { describe, it, expect } from 'vitest';
import { createIntentSchema } from '@/lib/validators/donation';

describe('createIntentSchema', () => {
  const validInput = {
    campaignId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 5000,
    donorName: 'Jane Doe',
    donorEmail: 'jane@example.com',
    isAnonymous: false,
    isRecurring: false,
  };

  it('accepts valid donation input', () => {
    const result = createIntentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts valid input with all optional fields', () => {
    const result = createIntentSchema.safeParse({
      ...validInput,
      donorLocation: 'Portland, OR',
      message: 'Stay strong!',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects amount below 500 cents ($5.00)', () => {
    const result = createIntentSchema.safeParse({ ...validInput, amount: 499 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Minimum donation is $5.00');
    }
  });

  it('rejects amount above 10,000,000 cents ($100,000)', () => {
    const result = createIntentSchema.safeParse({ ...validInput, amount: 10_000_001 });
    expect(result.success).toBe(false);
  });

  it('accepts amount at exactly 500 cents', () => {
    const result = createIntentSchema.safeParse({ ...validInput, amount: 500 });
    expect(result.success).toBe(true);
  });

  it('accepts amount at exactly 10,000,000 cents', () => {
    const result = createIntentSchema.safeParse({ ...validInput, amount: 10_000_000 });
    expect(result.success).toBe(true);
  });

  it('rejects non-integer amount', () => {
    const result = createIntentSchema.safeParse({ ...validInput, amount: 50.5 });
    expect(result.success).toBe(false);
  });

  it('rejects missing donorEmail', () => {
    const { donorEmail: _donorEmail, ...noEmail } = validInput;
    const result = createIntentSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = createIntentSchema.safeParse({ ...validInput, donorEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects message over 500 characters', () => {
    const result = createIntentSchema.safeParse({
      ...validInput,
      message: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts message at exactly 500 characters', () => {
    const result = createIntentSchema.safeParse({
      ...validInput,
      message: 'x'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID for campaignId', () => {
    const result = createIntentSchema.safeParse({ ...validInput, campaignId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('accepts missing donorName (optional field)', () => {
    const { donorName: _donorName, ...noName } = validInput;
    const result = createIntentSchema.safeParse(noName);
    expect(result.success).toBe(true);
  });

  it('accepts empty donorName (optional field)', () => {
    const result = createIntentSchema.safeParse({ ...validInput, donorName: '' });
    expect(result.success).toBe(true);
  });

  it('defaults isAnonymous to false when omitted', () => {
    const { isAnonymous: _isAnonymous, ...input } = validInput;
    const result = createIntentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isAnonymous).toBe(false);
    }
  });

  it('defaults isRecurring to false when omitted', () => {
    const { isRecurring: _isRecurring, ...input } = validInput;
    const result = createIntentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRecurring).toBe(false);
    }
  });
});
