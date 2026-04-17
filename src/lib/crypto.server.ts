/**
 * AES-256-GCM encryption for storing secrets (API keys) at rest in the database.
 * Server-only - never import from client components.
 *
 * Requires SETTINGS_ENCRYPTION_KEY env var: a 64-char hex string (32 bytes).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string. Returns a base64 string containing iv + authTag + ciphertext.
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack as: iv (12) + authTag (16) + ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a base64 string produced by encryptSecret. Returns the original plaintext.
 */
export function decryptSecret(packed64: string): string {
  const key = getEncryptionKey();
  const packed = Buffer.from(packed64, 'base64');

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data: too short');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── Security Token (HMAC-based, short-lived) ─────────────────────────────

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getHmacKey(): string {
  const key = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is not set - cannot sign security tokens. Do not reuse NEXTAUTH_SECRET for this purpose.');
  }
  return key;
}

/** Create a short-lived HMAC token proving security verification. */
export function createSecurityToken(userId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${expiresAt}`;
  const hmac = createHmac('sha256', getHmacKey()).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64');
  return { token, expiresAt };
}

/** Verify a security token and return the userId if valid. */
export function verifySecurityToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;

    const [userId, expiresAtStr, providedHmac] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

    const expectedPayload = `${userId}:${expiresAt}`;
    const expectedHmac = createHmac('sha256', getHmacKey()).update(expectedPayload).digest('hex');

    // Constant-time comparison using Node builtin
    const a = Buffer.from(providedHmac, 'utf8');
    const b = Buffer.from(expectedHmac, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return userId;
  } catch {
    return null;
  }
}
