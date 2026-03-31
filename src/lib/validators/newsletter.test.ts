import { describe, it, expect } from 'vitest';
import { subscribeSchema } from '@/lib/validators/newsletter';

describe('subscribeSchema', () => {
  it('accepts valid email', () => {
    const result = subscribeSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts valid email with source', () => {
    const result = subscribeSchema.safeParse({ email: 'test@example.com', source: 'homepage' });
    expect(result.success).toBe(true);
  });

  it('accepts all valid sources', () => {
    for (const source of ['homepage', 'campaign', 'blog', 'footer'] as const) {
      const result = subscribeSchema.safeParse({ email: 'test@example.com', source });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid email', () => {
    const result = subscribeSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = subscribeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty email', () => {
    const result = subscribeSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source', () => {
    const result = subscribeSchema.safeParse({ email: 'test@example.com', source: 'twitter' });
    expect(result.success).toBe(false);
  });
});
