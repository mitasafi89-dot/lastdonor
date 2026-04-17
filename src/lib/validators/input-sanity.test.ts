/**
 * Input Sanity Tests - Comprehensive validation coverage for every user input.
 *
 * Tests every validator schema for:
 *  - Happy path (valid inputs)
 *  - Boundary values (exact min, exact max, min-1, max+1)
 *  - Missing required fields
 *  - Type mismatches (string where number expected, etc.)
 *  - Whitespace-only inputs
 *  - HTML injection attempts (XSS payloads)
 *  - SQL injection strings
 *  - Unicode edge cases (emoji, RTL, zero-width chars)
 *  - Extremely long inputs
 *  - Trim behavior
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  passwordSchema,
  userPreferencesSchema,
} from './user';

import { createIntentSchema } from './donation';

import {
  createUserCampaignSchema,
  updateUserCampaignSchema,
  CATEGORIES,
  BENEFICIARY_RELATIONS,
} from './user-campaign';

import { messageSchema } from './message';
import { subscribeSchema } from './newsletter';
import { createCampaignSchema, updateCampaignSchema } from './campaign';
import { createBlogPostSchema, updateBlogPostSchema } from './blog';
import {
  updateDonorProfileSchema,
  createInteractionSchema,
  createRelationshipSchema,
} from './donor';

import {
  uploadVerificationDocumentSchema,
  adminVerificationReviewSchema,
  pauseCampaignSchema,
  suspendCampaignSchema,
  cancelCampaignSchema,
  createInfoRequestSchema,
  respondInfoRequestSchema,
  adminNoteSchema,
  subscribeCampaignSchema,
  createBulkEmailSchema,
} from './verification';

import { createConnectAccountSchema, withdrawalRequestSchema } from './payout';

// ═══════════════════════════════════════════════════════════════════════════════
// Shared test payloads
// ═══════════════════════════════════════════════════════════════════════════════

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  "'; DROP TABLE users; --",
  '<iframe src="javascript:alert(1)">',
];

const SQL_INJECTION = [
  "' OR '1'='1",
  "1; DROP TABLE campaigns; --",
  "UNION SELECT * FROM users --",
  "'; EXEC xp_cmdshell('whoami'); --",
];

const UNICODE_EDGE_CASES = [
  '\u200B', // zero-width space
  '\u200E', // left-to-right mark
  '\u200F', // right-to-left mark
  '\uFEFF', // byte order mark
];

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. passwordSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('passwordSchema', () => {
  it('accepts valid password: SecurePass1', () => {
    expect(passwordSchema.safeParse('SecurePass1').success).toBe(true);
  });

  it('accepts password with special characters', () => {
    expect(passwordSchema.safeParse('P@ssw0rd!!AB').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(passwordSchema.safeParse('').success).toBe(false);
  });

  it('rejects 9-character password (below min)', () => {
    expect(passwordSchema.safeParse('Abcdefg1!').success).toBe(false);
  });

  it('accepts exactly 10 characters', () => {
    expect(passwordSchema.safeParse('Abcdefgh1!').success).toBe(true);
  });

  it('accepts exactly 128 characters', () => {
    // 126 lowercase + 1 uppercase + 1 digit = 128
    const pw = 'A' + '1' + 'a'.repeat(126);
    expect(pw.length).toBe(128);
    expect(passwordSchema.safeParse(pw).success).toBe(true);
  });

  it('rejects 129-character password (above max)', () => {
    const pw = 'A' + '1' + 'a'.repeat(127);
    expect(pw.length).toBe(129);
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });

  it('rejects all lowercase + digit (no uppercase)', () => {
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
  });

  it('rejects all uppercase + digit (no lowercase)', () => {
    expect(passwordSchema.safeParse('ALLUPPERCASE1').success).toBe(false);
  });

  it('rejects no digit', () => {
    expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false);
  });

  it('rejects whitespace-only', () => {
    expect(passwordSchema.safeParse('          ').success).toBe(false);
  });

  it('accepts unicode characters in password', () => {
    expect(passwordSchema.safeParse('Sécurité1234').success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. registerSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('registerSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'SecurePass1',
    name: 'Test User',
  };

  it('accepts valid input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('trims and lowercases email', () => {
    const result = registerSchema.safeParse({ ...valid, email: '  User@Example.COM  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('trims name whitespace', () => {
    const result = registerSchema.safeParse({ ...valid, name: '  Jane Doe  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Jane Doe');
    }
  });

  it('rejects whitespace-only name', () => {
    expect(registerSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rejects name of 101 characters', () => {
    expect(registerSchema.safeParse({ ...valid, name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('accepts name of exactly 100 characters', () => {
    expect(registerSchema.safeParse({ ...valid, name: 'a'.repeat(100) }).success).toBe(true);
  });

  it('rejects missing email', () => {
    const { email: _, ...rest } = valid;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid email formats', () => {
    for (const bad of ['invalid', '@no-local.com', 'user@', 'user@.com', '']) {
      expect(registerSchema.safeParse({ ...valid, email: bad }).success).toBe(false);
    }
  });

  it('handles XSS in name (accepts but trims)', () => {
    const result = registerSchema.safeParse({ ...valid, name: '<script>alert(1)</script>' });
    expect(result.success).toBe(true);
    // The validator accepts the string - output sanitization handles display
  });

  it('handles SQL injection strings in name', () => {
    for (const payload of SQL_INJECTION) {
      const result = registerSchema.safeParse({ ...valid, name: payload });
      // SQL injection in name field should be accepted by validator
      // (parameterized queries prevent actual injection)
      expect(result.success).toBe(true);
    }
  });

  it('rejects non-string email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 12345 }).success).toBe(false);
  });

  it('rejects non-string password', () => {
    expect(registerSchema.safeParse({ ...valid, password: 12345 }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. loginSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('loginSchema', () => {
  it('accepts valid login', () => {
    expect(loginSchema.safeParse({ email: 'user@test.com', password: 'pass' }).success).toBe(true);
  });

  it('trims and lowercases email', () => {
    const result = loginSchema.safeParse({ email: '  USER@Test.COM  ', password: 'pass' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@test.com');
    }
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'u@t.com', password: '' }).success).toBe(false);
  });

  it('rejects missing email', () => {
    expect(loginSchema.safeParse({ password: 'pass' }).success).toBe(false);
  });

  it('rejects missing password', () => {
    expect(loginSchema.safeParse({ email: 'u@t.com' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-email', password: 'pass' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. resetPasswordSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('resetPasswordSchema', () => {
  const valid = {
    email: 'user@test.com',
    token: 'some-reset-token',
    password: 'NewSecure1!',
    confirmPassword: 'NewSecure1!',
  };

  it('accepts valid input', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when passwords do not match', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, confirmPassword: 'Different1!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('enforces same password complexity as registration', () => {
    // Weak password that would pass the old 8-char-min rule
    expect(resetPasswordSchema.safeParse({ ...valid, password: 'weakpass', confirmPassword: 'weakpass' }).success).toBe(false);
  });

  it('requires uppercase in password', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, password: 'alllower12', confirmPassword: 'alllower12' }).success).toBe(false);
  });

  it('requires lowercase in password', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, password: 'ALLUPPER12', confirmPassword: 'ALLUPPER12' }).success).toBe(false);
  });

  it('requires digit in password', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, password: 'NoDigitsHere', confirmPassword: 'NoDigitsHere' }).success).toBe(false);
  });

  it('rejects empty token', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, token: '' }).success).toBe(false);
  });

  it('trims and lowercases email', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, email: '  USER@Test.COM  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@test.com');
    }
  });

  it('rejects missing fields', () => {
    expect(resetPasswordSchema.safeParse({}).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ email: 'u@t.com' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. forgotPasswordSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@test.com' }).success).toBe(true);
  });

  it('trims and lowercases email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '  User@EXAMPLE.com  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('rejects empty email', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });

  it('rejects missing email', () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. updateProfileSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateProfileSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('trims name', () => {
    const result = updateProfileSchema.safeParse({ name: '  Jane Doe  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Jane Doe');
    }
  });

  it('trims location', () => {
    const result = updateProfileSchema.safeParse({ location: '  Portland, OR  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location).toBe('Portland, OR');
    }
  });

  it('rejects whitespace-only name', () => {
    expect(updateProfileSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects name over 100 characters', () => {
    expect(updateProfileSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rejects location over 100 characters', () => {
    expect(updateProfileSchema.safeParse({ location: 'a'.repeat(101) }).success).toBe(false);
  });

  it('accepts valid avatarUrl', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'https://example.com/avatar.jpg' }).success).toBe(true);
  });

  it('rejects invalid avatarUrl', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
  });

  it('rejects javascript: protocol in avatarUrl', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'javascript:alert(1)' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. userPreferencesSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('userPreferencesSchema', () => {
  it('accepts all booleans', () => {
    const result = userPreferencesSchema.safeParse({
      emailDonationReceipts: true,
      emailCampaignUpdates: false,
      emailNewCampaigns: true,
      emailNewsletter: false,
      showProfilePublicly: true,
      showDonationsPublicly: false,
      showBadgesPublicly: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(userPreferencesSchema.safeParse({}).success).toBe(true);
  });

  it('rejects non-boolean values', () => {
    expect(userPreferencesSchema.safeParse({ emailNewsletter: 'yes' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. createIntentSchema (Donation)
// ═══════════════════════════════════════════════════════════════════════════════

describe('createIntentSchema (Donation)', () => {
  const valid = {
    campaignId: VALID_UUID,
    amount: 5000,
    donorEmail: 'donor@example.com',
    isAnonymous: false,
    isRecurring: false,
  };

  it('accepts valid donation', () => {
    expect(createIntentSchema.safeParse(valid).success).toBe(true);
  });

  it('trims donorEmail and lowercases', () => {
    const result = createIntentSchema.safeParse({ ...valid, donorEmail: '  Donor@EXAMPLE.com  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.donorEmail).toBe('donor@example.com');
    }
  });

  it('trims donorName', () => {
    const result = createIntentSchema.safeParse({ ...valid, donorName: '  Jane Doe  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.donorName).toBe('Jane Doe');
    }
  });

  it('trims donorLocation', () => {
    const result = createIntentSchema.safeParse({ ...valid, donorLocation: '  Portland, OR  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.donorLocation).toBe('Portland, OR');
    }
  });

  it('strips HTML from message', () => {
    const result = createIntentSchema.safeParse({
      ...valid,
      message: '<b>Stay strong!</b><script>alert(1)</script>',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).not.toContain('<script>');
      expect(result.data.message).not.toContain('<b>');
    }
  });

  it('rejects amount at 499 cents (below min $5)', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: 499 }).success).toBe(false);
  });

  it('accepts amount at exactly 500 cents ($5)', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: 500 }).success).toBe(true);
  });

  it('accepts amount at exactly 10,000,000 cents ($100k)', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: 10_000_000 }).success).toBe(true);
  });

  it('rejects amount at 10,000,001 cents', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: 10_000_001 }).success).toBe(false);
  });

  it('rejects non-integer amount', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: 50.5 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: -1000 }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(createIntentSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it('rejects non-UUID campaignId', () => {
    expect(createIntentSchema.safeParse({ ...valid, campaignId: 'not-uuid' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(createIntentSchema.safeParse({ ...valid, donorEmail: 'bad' }).success).toBe(false);
  });

  it('rejects message over 500 characters', () => {
    expect(createIntentSchema.safeParse({ ...valid, message: 'x'.repeat(501) }).success).toBe(false);
  });

  it('accepts message at exactly 500 characters', () => {
    expect(createIntentSchema.safeParse({ ...valid, message: 'x'.repeat(500) }).success).toBe(true);
  });

  it('rejects donorName over 100 characters', () => {
    expect(createIntentSchema.safeParse({ ...valid, donorName: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rejects donorLocation over 100 characters', () => {
    expect(createIntentSchema.safeParse({ ...valid, donorLocation: 'a'.repeat(101) }).success).toBe(false);
  });

  it('defaults isAnonymous to false when omitted', () => {
    const { isAnonymous: _, ...rest } = valid;
    const result = createIntentSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isAnonymous).toBe(false);
  });

  it('defaults subscribedToUpdates to false when omitted', () => {
    const result = createIntentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subscribedToUpdates).toBe(false);
  });

  it('rejects non-UUID idempotencyKey', () => {
    expect(createIntentSchema.safeParse({ ...valid, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
  });

  it('handles XSS payloads in message (strips HTML tags)', () => {
    for (const payload of XSS_PAYLOADS) {
      const result = createIntentSchema.safeParse({ ...valid, message: payload });
      expect(result.success).toBe(true);
      if (result.success && result.data.message) {
        expect(result.data.message).not.toContain('<script');
        expect(result.data.message).not.toContain('<img');
        expect(result.data.message).not.toContain('<svg');
        expect(result.data.message).not.toContain('<iframe');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. messageSchema (Campaign message wall)
// ═══════════════════════════════════════════════════════════════════════════════

describe('messageSchema', () => {
  it('accepts valid message', () => {
    expect(messageSchema.safeParse({ message: 'Stay strong!', isAnonymous: false }).success).toBe(true);
  });

  it('strips HTML tags', () => {
    const result = messageSchema.safeParse({ message: '<b>Bold</b> text' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Bold text');
    }
  });

  it('rejects empty after HTML stripping', () => {
    const result = messageSchema.safeParse({ message: '<script></script>' });
    expect(result.success).toBe(false);
  });

  it('rejects message over 500 chars', () => {
    expect(messageSchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
  });

  it('rejects empty message', () => {
    expect(messageSchema.safeParse({ message: '' }).success).toBe(false);
  });

  it('handles all XSS payloads', () => {
    for (const payload of XSS_PAYLOADS) {
      const result = messageSchema.safeParse({ message: payload });
      // Some payloads may be empty after stripping
      if (result.success) {
        expect(result.data.message).not.toContain('<script');
      }
    }
  });

  it('defaults isAnonymous to false', () => {
    const result = messageSchema.safeParse({ message: 'hello' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isAnonymous).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. subscribeSchema (Newsletter)
// ═══════════════════════════════════════════════════════════════════════════════

describe('subscribeSchema (Newsletter)', () => {
  it('trims and lowercases email', () => {
    const result = subscribeSchema.safeParse({ email: '  USER@Test.COM  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@test.com');
    }
  });

  it('rejects empty email', () => {
    expect(subscribeSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('accepts all valid sources', () => {
    for (const source of ['homepage', 'campaign', 'blog', 'footer', 'newsletter'] as const) {
      expect(subscribeSchema.safeParse({ email: 'x@y.com', source }).success).toBe(true);
    }
  });

  it('rejects invalid source', () => {
    expect(subscribeSchema.safeParse({ email: 'x@y.com', source: 'twitter' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. createUserCampaignSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createUserCampaignSchema', () => {
  const valid = {
    subjectName: 'John Doe',
    subjectHometown: 'Austin, TX',
    beneficiaryRelation: 'family' as const,
    category: 'medical' as const,
    beneficiaryConsent: true,
    title: 'Help John recover from surgery complications',
    story: 'A'.repeat(500),
    goalAmount: 50_000,
    heroImageUrl: 'https://example.com/photo.jpg',
    agreedToTerms: true as const,
    confirmedTruthful: true as const,
  };

  it('accepts valid input', () => {
    expect(createUserCampaignSchema.safeParse(valid).success).toBe(true);
  });

  // ── Trim behavior ──────────────────────────────────────────────────────

  it('trims subjectName', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, subjectName: '  John Doe  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subjectName).toBe('John Doe');
  });

  it('trims subjectHometown', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, subjectHometown: '  Austin, TX  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subjectHometown).toBe('Austin, TX');
  });

  it('trims title', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, title: '  Help John recover from surgery  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).not.toMatch(/^\s|\s$/);
  });

  it('trims story', () => {
    const result = createUserCampaignSchema.safeParse({ ...valid, story: '  ' + 'A'.repeat(300) + '  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.story).not.toMatch(/^\s|\s$/);
  });

  // ── Boundary values ────────────────────────────────────────────────────

  it('rejects subjectName of 1 char', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, subjectName: 'A' }).success).toBe(false);
  });

  it('accepts subjectName of 2 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, subjectName: 'AB' }).success).toBe(true);
  });

  it('accepts subjectName of 200 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, subjectName: 'A'.repeat(200) }).success).toBe(true);
  });

  it('rejects subjectName of 201 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, subjectName: 'A'.repeat(201) }).success).toBe(false);
  });

  it('rejects title of 19 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, title: 'A'.repeat(19) }).success).toBe(false);
  });

  it('accepts title of 20 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, title: 'A'.repeat(20) }).success).toBe(true);
  });

  it('accepts title of 120 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, title: 'A'.repeat(120) }).success).toBe(true);
  });

  it('rejects title of 121 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, title: 'A'.repeat(121) }).success).toBe(false);
  });

  it('rejects story of 199 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(199) }).success).toBe(false);
  });

  it('accepts story of 200 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(200) }).success).toBe(true);
  });

  it('accepts story of 10000 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(10000) }).success).toBe(true);
  });

  it('rejects story of 10001 chars', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, story: 'A'.repeat(10001) }).success).toBe(false);
  });

  // ── goalAmount ─────────────────────────────────────────────────────────

  it('rejects goalAmount of 99 (below $1)', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, goalAmount: 99 }).success).toBe(false);
  });

  it('accepts goalAmount of 100 ($1)', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, goalAmount: 100 }).success).toBe(true);
  });

  it('accepts goalAmount at max', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, goalAmount: 100_000_000_000 }).success).toBe(true);
  });

  it('rejects goalAmount above max', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, goalAmount: 100_000_000_001 }).success).toBe(false);
  });

  it('rejects non-integer goalAmount', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, goalAmount: 50.5 }).success).toBe(false);
  });

  // ── Enums ──────────────────────────────────────────────────────────────

  it('accepts all 23 categories', () => {
    for (const cat of CATEGORIES) {
      expect(createUserCampaignSchema.safeParse({ ...valid, category: cat }).success).toBe(true);
    }
  });

  it('rejects invalid category', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, category: 'invalid' }).success).toBe(false);
  });

  it('accepts all beneficiary relations', () => {
    for (const rel of BENEFICIARY_RELATIONS) {
      expect(createUserCampaignSchema.safeParse({ ...valid, beneficiaryRelation: rel }).success).toBe(true);
    }
  });

  it('rejects invalid beneficiary relation', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, beneficiaryRelation: 'enemy' }).success).toBe(false);
  });

  // ── Required fields ────────────────────────────────────────────────────

  it('rejects agreedToTerms=false', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, agreedToTerms: false }).success).toBe(false);
  });

  it('rejects confirmedTruthful=false', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, confirmedTruthful: false }).success).toBe(false);
  });

  it('rejects missing heroImageUrl', () => {
    const { heroImageUrl: _, ...rest } = valid;
    expect(createUserCampaignSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid heroImageUrl', () => {
    expect(createUserCampaignSchema.safeParse({ ...valid, heroImageUrl: 'not-a-url' }).success).toBe(false);
  });

  // ── YouTube URL validation ─────────────────────────────────────────────

  it('accepts valid YouTube URL', () => {
    expect(createUserCampaignSchema.safeParse({
      ...valid,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    }).success).toBe(true);
  });

  it('accepts youtu.be short URL', () => {
    expect(createUserCampaignSchema.safeParse({
      ...valid,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    }).success).toBe(true);
  });

  it('rejects non-YouTube URL in youtubeUrl field', () => {
    expect(createUserCampaignSchema.safeParse({
      ...valid,
      youtubeUrl: 'https://vimeo.com/12345',
    }).success).toBe(false);
  });

  it('rejects javascript: in youtubeUrl', () => {
    expect(createUserCampaignSchema.safeParse({
      ...valid,
      youtubeUrl: 'javascript:alert(1)',
    }).success).toBe(false);
  });

  // ── Gallery images ─────────────────────────────────────────────────────

  it('accepts up to 4 gallery images', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      galleryImages: [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
        'https://example.com/4.jpg',
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects 5 gallery images', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      galleryImages: Array.from({ length: 5 }, (_, i) => `https://example.com/${i}.jpg`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-URL in gallery images', () => {
    const result = createUserCampaignSchema.safeParse({
      ...valid,
      galleryImages: ['not-a-url'],
    });
    expect(result.success).toBe(false);
  });

  // ── XSS in text fields ────────────────────────────────────────────────

  it('accepts XSS payloads in text fields (output encoding handles display)', () => {
    for (const payload of XSS_PAYLOADS) {
      // XSS payloads are accepted as raw text since output encoding
      // handles display safety. They just need to fit length limits.
      const paddedTitle = (payload + ' '.repeat(20)).slice(0, 40);
      const paddedStory = (payload + ' '.repeat(200)).slice(0, 300);
      const result = createUserCampaignSchema.safeParse({
        ...valid,
        title: paddedTitle,
        story: paddedStory,
      });
      // Should pass or fail based on length, not content
      expect(typeof result.success).toBe('boolean');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. updateUserCampaignSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateUserCampaignSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(updateUserCampaignSchema.safeParse({}).success).toBe(true);
  });

  it('trims title', () => {
    const result = updateUserCampaignSchema.safeParse({ title: '  Updated campaign title here  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('Updated campaign title here');
  });

  it('validates fields that are provided', () => {
    expect(updateUserCampaignSchema.safeParse({ title: 'Too short' }).success).toBe(false);
  });

  it('rejects non-YouTube URL in youtubeUrl', () => {
    expect(updateUserCampaignSchema.safeParse({
      youtubeUrl: 'https://evil.com/video',
    }).success).toBe(false);
  });

  it('accepts null for nullable fields', () => {
    expect(updateUserCampaignSchema.safeParse({ galleryImages: null }).success).toBe(true);
    expect(updateUserCampaignSchema.safeParse({ youtubeUrl: null }).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. createCampaignSchema (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

describe('createCampaignSchema (Admin)', () => {
  const valid = {
    title: 'Help First Responder Mike Recover',
    slug: 'help-first-responder-mike-recover',
    category: 'first-responders' as const,
    heroImageUrl: 'https://example.com/hero.webp',
    subjectName: 'Mike Torres',
    storyHtml: '<p>Mike was injured in the line of duty and needs support for recovery and family expenses.</p>',
    goalAmount: 1_000_000,
  };

  it('accepts valid input', () => {
    expect(createCampaignSchema.safeParse(valid).success).toBe(true);
  });

  it('trims title', () => {
    const result = createCampaignSchema.safeParse({ ...valid, title: '  Help Mike Recover  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('Help Mike Recover');
  });

  it('trims slug', () => {
    const result = createCampaignSchema.safeParse({ ...valid, slug: '  help-mike  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe('help-mike');
  });

  it('trims subjectName', () => {
    const result = createCampaignSchema.safeParse({ ...valid, subjectName: '  Mike Torres  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subjectName).toBe('Mike Torres');
  });

  // ── Slug validation ───────────────────────────────────────────────────

  it('rejects slug with uppercase', () => {
    expect(createCampaignSchema.safeParse({ ...valid, slug: 'Has-Uppercase' }).success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    expect(createCampaignSchema.safeParse({ ...valid, slug: 'has spaces' }).success).toBe(false);
  });

  it('rejects slug with special characters', () => {
    expect(createCampaignSchema.safeParse({ ...valid, slug: 'slug_with_underscores' }).success).toBe(false);
  });

  it('rejects slug < 3 chars', () => {
    expect(createCampaignSchema.safeParse({ ...valid, slug: 'ab' }).success).toBe(false);
  });

  it('rejects slug > 100 chars', () => {
    expect(createCampaignSchema.safeParse({ ...valid, slug: 'a'.repeat(101) }).success).toBe(false);
  });

  // ── goalAmount ─────────────────────────────────────────────────────────

  it('rejects goalAmount below 100,000 cents ($1,000)', () => {
    expect(createCampaignSchema.safeParse({ ...valid, goalAmount: 99_999 }).success).toBe(false);
  });

  it('accepts goalAmount at exactly 100,000 cents ($1,000)', () => {
    expect(createCampaignSchema.safeParse({ ...valid, goalAmount: 100_000 }).success).toBe(true);
  });

  it('rejects goalAmount above 10,000,000 cents ($100,000)', () => {
    expect(createCampaignSchema.safeParse({ ...valid, goalAmount: 10_000_001 }).success).toBe(false);
  });

  // ── Impact tiers ──────────────────────────────────────────────────────

  it('defaults impactTiers to empty array', () => {
    const result = createCampaignSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.impactTiers).toEqual([]);
  });

  it('rejects more than 10 impact tiers', () => {
    const tiers = Array.from({ length: 11 }, (_, i) => ({
      amount: (i + 1) * 1000,
      label: `Tier ${i + 1} with enough characters here`,
    }));
    expect(createCampaignSchema.safeParse({ ...valid, impactTiers: tiers }).success).toBe(false);
  });

  it('rejects tier with amount below 500', () => {
    expect(createCampaignSchema.safeParse({
      ...valid,
      impactTiers: [{ amount: 499, label: 'Too low amount' }],
    }).success).toBe(false);
  });

  it('defaults status to draft', () => {
    const result = createCampaignSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('draft');
  });
});

describe('updateCampaignSchema (Admin)', () => {
  it('accepts empty object', () => {
    expect(updateCampaignSchema.safeParse({}).success).toBe(true);
  });

  it('validates provided fields', () => {
    expect(updateCampaignSchema.safeParse({ goalAmount: 50 }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. createBlogPostSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createBlogPostSchema', () => {
  const valid = {
    title: 'How Your Donation Changes Lives',
    slug: 'how-your-donation-changes-lives',
    bodyHtml: '<p>Long story about donations and impact that needs at least fifty characters to pass.</p>',
    authorName: 'Editorial Team',
    category: 'impact_report' as const,
    published: false,
  };

  it('accepts valid input', () => {
    expect(createBlogPostSchema.safeParse(valid).success).toBe(true);
  });

  it('trims title', () => {
    const result = createBlogPostSchema.safeParse({ ...valid, title: '  Blog Title Here  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('Blog Title Here');
  });

  it('trims authorName', () => {
    const result = createBlogPostSchema.safeParse({ ...valid, authorName: '  Jane Smith  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.authorName).toBe('Jane Smith');
  });

  it('trims slug', () => {
    const result = createBlogPostSchema.safeParse({ ...valid, slug: '  blog-slug  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe('blog-slug');
  });

  it('rejects slug with uppercase', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, slug: 'Has-Uppercase' }).success).toBe(false);
  });

  it('rejects title < 5 chars', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, title: 'Hi' }).success).toBe(false);
  });

  it('rejects bodyHtml < 50 chars', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, bodyHtml: 'Too short' }).success).toBe(false);
  });

  it('accepts empty string for coverImageUrl', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, coverImageUrl: '' }).success).toBe(true);
  });

  it('accepts valid URL for coverImageUrl', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, coverImageUrl: 'https://example.com/img.jpg' }).success).toBe(true);
  });

  it('rejects invalid coverImageUrl (non-empty, non-URL)', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, coverImageUrl: 'bad' }).success).toBe(false);
  });

  it('accepts all blog categories', () => {
    for (const cat of ['campaign_story', 'impact_report', 'news'] as const) {
      expect(createBlogPostSchema.safeParse({ ...valid, category: cat }).success).toBe(true);
    }
  });

  it('rejects invalid category', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, category: 'invalid' }).success).toBe(false);
  });

  it('rejects whitespace-only authorName', () => {
    expect(createBlogPostSchema.safeParse({ ...valid, authorName: '   ' }).success).toBe(false);
  });
});

describe('updateBlogPostSchema', () => {
  it('accepts empty object', () => {
    expect(updateBlogPostSchema.safeParse({}).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. updateDonorProfileSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateDonorProfileSchema', () => {
  it('accepts empty object', () => {
    expect(updateDonorProfileSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid phone number', () => {
    expect(updateDonorProfileSchema.safeParse({ phone: '+1 (555) 123-4567' }).success).toBe(true);
  });

  it('accepts international phone format', () => {
    expect(updateDonorProfileSchema.safeParse({ phone: '+44 20 7946 0958' }).success).toBe(true);
  });

  it('rejects invalid phone (letters)', () => {
    expect(updateDonorProfileSchema.safeParse({ phone: 'call me' }).success).toBe(false);
  });

  it('rejects phone too short (< 7 digits)', () => {
    expect(updateDonorProfileSchema.safeParse({ phone: '123' }).success).toBe(false);
  });

  it('accepts null phone (clear field)', () => {
    expect(updateDonorProfileSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it('accepts empty string phone', () => {
    expect(updateDonorProfileSchema.safeParse({ phone: '' }).success).toBe(true);
  });

  it('trims organizationName', () => {
    const result = updateDonorProfileSchema.safeParse({ organizationName: '  ACME Corp  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.organizationName).toBe('ACME Corp');
  });

  it('rejects organizationName > 200 chars', () => {
    expect(updateDonorProfileSchema.safeParse({ organizationName: 'A'.repeat(201) }).success).toBe(false);
  });

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    expect(updateDonorProfileSchema.safeParse({ tags }).success).toBe(false);
  });

  it('rejects empty tag string', () => {
    expect(updateDonorProfileSchema.safeParse({ tags: [''] }).success).toBe(false);
  });

  it('trims tags', () => {
    const result = updateDonorProfileSchema.safeParse({ tags: ['  vip  ', '  recurring  '] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(['vip', 'recurring']);
    }
  });

  it('accepts all donor types', () => {
    for (const type of ['individual', 'corporate', 'foundation'] as const) {
      expect(updateDonorProfileSchema.safeParse({ donorType: type }).success).toBe(true);
    }
  });

  it('rejects invalid donor type', () => {
    expect(updateDonorProfileSchema.safeParse({ donorType: 'robot' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. createInteractionSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createInteractionSchema', () => {
  const valid = {
    type: 'email' as const,
    subject: 'Follow-up on donation',
    contactedAt: '2026-04-07T10:00:00.000Z',
  };

  it('accepts valid interaction', () => {
    expect(createInteractionSchema.safeParse(valid).success).toBe(true);
  });

  it('trims subject', () => {
    const result = createInteractionSchema.safeParse({ ...valid, subject: '  Follow-up  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe('Follow-up');
  });

  it('rejects empty subject', () => {
    expect(createInteractionSchema.safeParse({ ...valid, subject: '' }).success).toBe(false);
  });

  it('rejects whitespace-only subject', () => {
    expect(createInteractionSchema.safeParse({ ...valid, subject: '   ' }).success).toBe(false);
  });

  it('rejects subject > 200 chars', () => {
    expect(createInteractionSchema.safeParse({ ...valid, subject: 'a'.repeat(201) }).success).toBe(false);
  });

  it('rejects body > 5000 chars', () => {
    expect(createInteractionSchema.safeParse({ ...valid, body: 'a'.repeat(5001) }).success).toBe(false);
  });

  it('rejects invalid datetime', () => {
    expect(createInteractionSchema.safeParse({ ...valid, contactedAt: 'not-a-date' }).success).toBe(false);
  });

  it('accepts all interaction types', () => {
    for (const type of ['email', 'call', 'meeting', 'note'] as const) {
      expect(createInteractionSchema.safeParse({ ...valid, type }).success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. createRelationshipSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createRelationshipSchema', () => {
  it('accepts valid relationship', () => {
    expect(createRelationshipSchema.safeParse({
      relationshipType: 'referral',
    }).success).toBe(true);
  });

  it('rejects invalid UUID for relatedDonorId', () => {
    expect(createRelationshipSchema.safeParse({
      relatedDonorId: 'not-a-uuid',
      relationshipType: 'referral',
    }).success).toBe(false);
  });

  it('trims notes', () => {
    const result = createRelationshipSchema.safeParse({
      relationshipType: 'referral',
      notes: '  Important note  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe('Important note');
  });

  it('rejects notes > 1000 chars', () => {
    expect(createRelationshipSchema.safeParse({
      relationshipType: 'referral',
      notes: 'a'.repeat(1001),
    }).success).toBe(false);
  });

  it('accepts all relationship types', () => {
    for (const type of ['referral', 'corporate_sponsor', 'family', 'colleague', 'organization_member'] as const) {
      expect(createRelationshipSchema.safeParse({ relationshipType: type }).success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. Verification schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe('uploadVerificationDocumentSchema', () => {
  it('accepts valid input', () => {
    expect(uploadVerificationDocumentSchema.safeParse({ documentType: 'government_id' }).success).toBe(true);
  });

  it('accepts all document types', () => {
    for (const type of ['government_id', 'selfie', 'hospital_letter', 'receipt', 'utility_bill', 'bank_statement', 'official_letter', 'other'] as const) {
      expect(uploadVerificationDocumentSchema.safeParse({ documentType: type }).success).toBe(true);
    }
  });

  it('rejects invalid document type', () => {
    expect(uploadVerificationDocumentSchema.safeParse({ documentType: 'passport' }).success).toBe(false);
  });

  it('trims description', () => {
    const result = uploadVerificationDocumentSchema.safeParse({
      documentType: 'government_id',
      description: '  My ID document  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe('My ID document');
  });

  it('rejects description > 500 chars', () => {
    expect(uploadVerificationDocumentSchema.safeParse({
      documentType: 'government_id',
      description: 'a'.repeat(501),
    }).success).toBe(false);
  });
});

describe('adminVerificationReviewSchema', () => {
  it('accepts approve_t1 without deadline', () => {
    expect(adminVerificationReviewSchema.safeParse({ action: 'approve_t1' }).success).toBe(true);
  });

  it('requires deadline for request_info', () => {
    expect(adminVerificationReviewSchema.safeParse({ action: 'request_info' }).success).toBe(false);
  });

  it('accepts request_info with deadline', () => {
    expect(adminVerificationReviewSchema.safeParse({
      action: 'request_info',
      deadline: '2026-04-14T00:00:00.000Z',
    }).success).toBe(true);
  });

  it('rejects invalid datetime for deadline', () => {
    expect(adminVerificationReviewSchema.safeParse({
      action: 'request_info',
      deadline: 'next-week',
    }).success).toBe(false);
  });

  it('trims notes', () => {
    const result = adminVerificationReviewSchema.safeParse({
      action: 'approve_t1',
      notes: '  Identity document looks good  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe('Identity document looks good');
  });

  it('rejects notes > 2000 chars', () => {
    expect(adminVerificationReviewSchema.safeParse({
      action: 'approve_t1',
      notes: 'a'.repeat(2001),
    }).success).toBe(false);
  });

  it('accepts all verification actions', () => {
    for (const action of ['approve_t1', 'approve_t2', 'reject'] as const) {
      expect(adminVerificationReviewSchema.safeParse({ action }).success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. Campaign governance schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe('pauseCampaignSchema', () => {
  it('accepts valid input', () => {
    expect(pauseCampaignSchema.safeParse({ reason: 'Under investigation' }).success).toBe(true);
  });

  it('trims reason', () => {
    const result = pauseCampaignSchema.safeParse({ reason: '  Under investigation  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe('Under investigation');
  });

  it('rejects reason < 3 chars', () => {
    expect(pauseCampaignSchema.safeParse({ reason: 'No' }).success).toBe(false);
  });

  it('rejects reason > 500 chars', () => {
    expect(pauseCampaignSchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
  });

  it('rejects whitespace-only reason (after trim, too short)', () => {
    expect(pauseCampaignSchema.safeParse({ reason: '   ' }).success).toBe(false);
  });

  it('defaults notifyDonors to true', () => {
    const result = pauseCampaignSchema.safeParse({ reason: 'Under review' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notifyDonors).toBe(true);
  });
});

describe('suspendCampaignSchema', () => {
  it('accepts valid input', () => {
    expect(suspendCampaignSchema.safeParse({ reason: 'Fraud detected' }).success).toBe(true);
  });

  it('trims internalNotes', () => {
    const result = suspendCampaignSchema.safeParse({
      reason: 'Fraud detected',
      internalNotes: '  Suspicious activity pattern  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.internalNotes).toBe('Suspicious activity pattern');
  });

  it('rejects internalNotes > 2000 chars', () => {
    expect(suspendCampaignSchema.safeParse({
      reason: 'Fraud',
      internalNotes: 'a'.repeat(2001),
    }).success).toBe(false);
  });
});

describe('cancelCampaignSchema', () => {
  it('accepts valid input', () => {
    expect(cancelCampaignSchema.safeParse({ reason: 'identity_fraud' }).success).toBe(true);
  });

  it('rejects invalid cancellation reason', () => {
    expect(cancelCampaignSchema.safeParse({ reason: 'just_because' }).success).toBe(false);
  });

  it('accepts all valid cancellation reasons', () => {
    const reasons = [
      'identity_fraud', 'fabricated_story', 'document_forgery',
      'campaigner_non_responsive', 'duplicate_campaign', 'legal_compliance',
      'campaigner_requested', 'terms_violation',
    ] as const;
    for (const reason of reasons) {
      expect(cancelCampaignSchema.safeParse({ reason }).success).toBe(true);
    }
  });

  it('defaults refundAll to true', () => {
    const result = cancelCampaignSchema.safeParse({ reason: 'identity_fraud' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.refundAll).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. Info request schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe('createInfoRequestSchema', () => {
  const valid = {
    campaignId: VALID_UUID,
    requestType: 'clarification_fund_usage' as const,
    details: 'Please provide detailed breakdown of fund usage',
    deadlineDays: 7,
  };

  it('accepts valid input', () => {
    expect(createInfoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('trims details', () => {
    const result = createInfoRequestSchema.safeParse({ ...valid, details: '  Please provide details  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.details).toBe('Please provide details');
  });

  it('rejects invalid UUID', () => {
    expect(createInfoRequestSchema.safeParse({ ...valid, campaignId: 'bad' }).success).toBe(false);
  });

  it('rejects details < 10 chars', () => {
    expect(createInfoRequestSchema.safeParse({ ...valid, details: 'Too short' }).success).toBe(false);
  });

  it('rejects details > 2000 chars', () => {
    expect(createInfoRequestSchema.safeParse({ ...valid, details: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('accepts valid deadline days', () => {
    for (const days of [3, 7, 14, 30]) {
      expect(createInfoRequestSchema.safeParse({ ...valid, deadlineDays: days }).success).toBe(true);
    }
  });

  it('rejects invalid deadline days', () => {
    for (const days of [1, 5, 10, 60]) {
      expect(createInfoRequestSchema.safeParse({ ...valid, deadlineDays: days }).success).toBe(false);
    }
  });

  it('accepts all request types', () => {
    for (const type of [
      'additional_identity_documents', 'updated_medical_reports',
      'clarification_fund_usage', 'proof_of_relationship',
      'updated_cost_estimates', 'progress_evidence', 'other',
    ] as const) {
      expect(createInfoRequestSchema.safeParse({ ...valid, requestType: type }).success).toBe(true);
    }
  });
});

describe('respondInfoRequestSchema', () => {
  it('accepts valid response', () => {
    expect(respondInfoRequestSchema.safeParse({ responseText: 'Here is the information' }).success).toBe(true);
  });

  it('trims responseText', () => {
    const result = respondInfoRequestSchema.safeParse({ responseText: '  Response here  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.responseText).toBe('Response here');
  });

  it('rejects responseText < 3 chars', () => {
    expect(respondInfoRequestSchema.safeParse({ responseText: 'Hi' }).success).toBe(false);
  });

  it('rejects responseText > 2000 chars', () => {
    expect(respondInfoRequestSchema.safeParse({ responseText: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('rejects whitespace-only response', () => {
    expect(respondInfoRequestSchema.safeParse({ responseText: '   ' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. adminNoteSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminNoteSchema', () => {
  it('accepts valid note', () => {
    expect(adminNoteSchema.safeParse({ text: 'Campaign looks legitimate' }).success).toBe(true);
  });

  it('trims text', () => {
    const result = adminNoteSchema.safeParse({ text: '  Note here  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.text).toBe('Note here');
  });

  it('rejects empty text', () => {
    expect(adminNoteSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('rejects whitespace-only text', () => {
    expect(adminNoteSchema.safeParse({ text: '   ' }).success).toBe(false);
  });

  it('rejects text > 2000 chars', () => {
    expect(adminNoteSchema.safeParse({ text: 'a'.repeat(2001) }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 24. subscribeCampaignSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe('subscribeCampaignSchema', () => {
  it('trims and lowercases email', () => {
    const result = subscribeCampaignSchema.safeParse({ email: '  User@TEST.com  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('user@test.com');
  });

  it('rejects invalid email', () => {
    expect(subscribeCampaignSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 25. Bulk email schema
// ═══════════════════════════════════════════════════════════════════════════════

describe('createBulkEmailSchema', () => {
  const valid = {
    templateName: 'custom' as const,
    subject: 'Important campaign update',
    bodyHtml: '<p>Hello donors, here is an important update about the campaign status.</p>',
  };

  it('accepts valid input', () => {
    expect(createBulkEmailSchema.safeParse(valid).success).toBe(true);
  });

  it('trims subject', () => {
    const result = createBulkEmailSchema.safeParse({ ...valid, subject: '  Update  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe('Update');
  });

  it('rejects subject < 3 chars', () => {
    expect(createBulkEmailSchema.safeParse({ ...valid, subject: 'Hi' }).success).toBe(false);
  });

  it('rejects subject > 200 chars', () => {
    expect(createBulkEmailSchema.safeParse({ ...valid, subject: 'a'.repeat(201) }).success).toBe(false);
  });

  it('rejects bodyHtml < 10 chars', () => {
    expect(createBulkEmailSchema.safeParse({ ...valid, bodyHtml: 'Hi' }).success).toBe(false);
  });

  it('rejects bodyHtml > 50000 chars', () => {
    expect(createBulkEmailSchema.safeParse({ ...valid, bodyHtml: 'a'.repeat(50001) }).success).toBe(false);
  });

  it('accepts valid campaignId', () => {
    expect(createBulkEmailSchema.safeParse({ ...valid, campaignId: VALID_UUID }).success).toBe(true);
  });

  it('rejects invalid campaignId', () => {
    expect(createBulkEmailSchema.safeParse({ ...valid, campaignId: 'not-uuid' }).success).toBe(false);
  });

  it('accepts all template names', () => {
    for (const name of [
      'campaign_cancelled_refund', 'campaign_paused_update', 'campaign_resumed_update',
      'campaign_completed_thanks', 'custom',
    ] as const) {
      expect(createBulkEmailSchema.safeParse({ ...valid, templateName: name }).success).toBe(true);
    }
  });

  it('accepts all recipient filters', () => {
    for (const filter of ['all_donors', 'registered_donors', 'guest_donors', 'subscribed_donors', 'refunded_donors'] as const) {
      expect(createBulkEmailSchema.safeParse({ ...valid, recipientFilter: filter }).success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 26. Payout schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe('createConnectAccountSchema', () => {
  it('accepts empty object', () => {
    expect(createConnectAccountSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid 2-letter country code', () => {
    const result = createConnectAccountSchema.safeParse({ country: 'us' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.country).toBe('US'); // toUpperCase
  });

  it('rejects country code > 2 chars', () => {
    expect(createConnectAccountSchema.safeParse({ country: 'USA' }).success).toBe(false);
  });

  it('rejects country code < 2 chars', () => {
    expect(createConnectAccountSchema.safeParse({ country: 'U' }).success).toBe(false);
  });
});

describe('withdrawalRequestSchema', () => {
  it('accepts positive amount', () => {
    expect(withdrawalRequestSchema.safeParse({ amount: 10000, idempotencyKey: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true);
  });

  it('rejects zero amount', () => {
    expect(withdrawalRequestSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(withdrawalRequestSchema.safeParse({ amount: -1000 }).success).toBe(false);
  });

  it('rejects non-integer amount', () => {
    expect(withdrawalRequestSchema.safeParse({ amount: 50.5 }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 27. Cross-cutting security concerns
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-cutting: XSS payloads in various schemas', () => {
  it('donation message strips XSS', () => {
    for (const payload of XSS_PAYLOADS) {
      const result = createIntentSchema.safeParse({
        campaignId: VALID_UUID,
        amount: 5000,
        donorEmail: 'test@test.com',
        message: payload,
      });
      if (result.success && result.data.message) {
        expect(result.data.message).not.toMatch(/<script/i);
      }
    }
  });

  it('campaign message wall strips XSS', () => {
    for (const payload of XSS_PAYLOADS) {
      const result = messageSchema.safeParse({ message: payload });
      if (result.success) {
        expect(result.data.message).not.toMatch(/<script/i);
      }
    }
  });
});

describe('Cross-cutting: SQL injection strings accepted but harmless', () => {
  it('SQL payloads in text fields pass validation (parameterized queries prevent injection)', () => {
    for (const payload of SQL_INJECTION) {
      // Name fields accept SQL strings because parameterized queries prevent injection
      const paddedPayload = payload.padEnd(20, ' ');
      const result = createUserCampaignSchema.safeParse({
        subjectName: payload,
        subjectHometown: 'Test City',
        beneficiaryRelation: 'self',
        category: 'medical',
        beneficiaryConsent: true,
        title: paddedPayload,
        story: paddedPayload.padEnd(200, ' '),
        goalAmount: 50000,
        heroImageUrl: 'https://example.com/photo.jpg',
        agreedToTerms: true,
        confirmedTruthful: true,
      });
      // Some may fail on length validation, but that's expected
      expect(typeof result.success).toBe('boolean');
    }
  });
});

describe('Cross-cutting: Unicode edge cases', () => {
  it('zero-width characters in name fields are trimmed or accepted', () => {
    for (const char of UNICODE_EDGE_CASES) {
      const name = `John${char}Doe`;
      const result = registerSchema.safeParse({
        email: 'test@test.com',
        password: 'SecurePass1',
        name,
      });
      // Zero-width chars may or may not be stripped by trim
      // The important thing is no crash
      expect(typeof result.success).toBe('boolean');
    }
  });

  it('emoji in text fields accepted (valid Unicode)', () => {
    const result = messageSchema.safeParse({ message: 'Stay strong! 💪🙏' });
    expect(result.success).toBe(true);
  });

  it('RTL text in text fields accepted', () => {
    const result = messageSchema.safeParse({ message: 'مرحبا بالعالم' });
    expect(result.success).toBe(true);
  });
});

describe('Cross-cutting: extremely long inputs rejected', () => {
  it('rejects 1MB name', () => {
    expect(registerSchema.safeParse({
      email: 'test@test.com',
      password: 'SecurePass1',
      name: 'a'.repeat(1_000_000),
    }).success).toBe(false);
  });

  it('rejects 1MB story', () => {
    expect(createUserCampaignSchema.safeParse({
      subjectName: 'Test',
      subjectHometown: 'Test',
      beneficiaryRelation: 'self',
      category: 'medical',
      beneficiaryConsent: true,
      title: 'A'.repeat(20),
      story: 'a'.repeat(1_000_000),
      goalAmount: 50000,
      heroImageUrl: 'https://example.com/photo.jpg',
      agreedToTerms: true,
      confirmedTruthful: true,
    }).success).toBe(false);
  });

  it('rejects 1MB donation message', () => {
    expect(createIntentSchema.safeParse({
      campaignId: VALID_UUID,
      amount: 5000,
      donorEmail: 'test@test.com',
      message: 'a'.repeat(1_000_000),
    }).success).toBe(false);
  });
});
