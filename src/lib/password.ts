/**
 * Pepper-enhanced password hashing.
 *
 * Pre-hashes the password with HMAC-SHA256 using a server-side pepper before
 * bcrypt. This means a database-only breach is useless without the pepper,
 * which lives only in env vars (never in the database).
 *
 * HMAC-SHA256 output is 64 hex chars (64 bytes ASCII) which is within bcrypt's
 * 72-byte input limit, so no truncation occurs.
 *
 * When PASSWORD_PEPPER is not set (local dev without it configured), falls
 * back to raw bcrypt with a warning. In production, absence is a fatal error.
 */
import bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';

const BCRYPT_ROUNDS = 12;

function preHash(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER;

  if (!pepper) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PASSWORD_PEPPER must be set in production. ' +
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    // Dev fallback: no pepper (bcrypt-only, matches legacy behaviour)
    return password;
  }

  if (pepper.length < 32) {
    throw new Error('PASSWORD_PEPPER must be at least 32 characters.');
  }

  return createHmac('sha256', pepper).update(password).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(preHash(password), BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(preHash(password), hash);
}

/**
 * Check a password against a legacy (unpeppered) bcrypt hash.
 * Used only to detect whether a user still has a pre-pepper hash so we can
 * force them through the password-reset flow.  Never used to grant access.
 */
export async function verifyLegacyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
