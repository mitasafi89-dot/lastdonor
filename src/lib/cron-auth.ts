import { timingSafeEqual } from 'crypto';

/**
 * Timing-safe verification of the cron Bearer token.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing-attack recovery
 * of the CRON_SECRET character by character.
 */
export function verifyCronAuth(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;

  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expected),
  );
}
