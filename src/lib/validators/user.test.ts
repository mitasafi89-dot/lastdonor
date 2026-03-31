import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, updateProfileSchema } from '@/lib/validators/user';

describe('registerSchema', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'SecurePass1',
    name: 'Test User',
  };

  it('accepts valid registration input', () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 10 characters', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'Short1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase letter', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'alllowercase1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without lowercase letter', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'ALLUPPERCASE1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without digit', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'NoDigitsHere' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...validInput, email: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name, ...noName } = validInput;
    const result = registerSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = registerSchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = registerSchema.safeParse({ ...validInput, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login input', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'pass' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'bad', password: 'pass' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts valid profile update', () => {
    const result = updateProfileSchema.safeParse({ name: 'Jane Doe' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts location update', () => {
    const result = updateProfileSchema.safeParse({ location: 'Portland, OR' });
    expect(result.success).toBe(true);
  });

  it('accepts avatarUrl update', () => {
    const result = updateProfileSchema.safeParse({ avatarUrl: 'https://example.com/avatar.jpg' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid avatarUrl', () => {
    const result = updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = updateProfileSchema.safeParse({ name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});
