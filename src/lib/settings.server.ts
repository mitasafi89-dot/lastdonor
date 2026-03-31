/**
 * Server-side settings operations (DB reads/writes).
 * Only import from server components / API routes.
 */
import 'server-only';

import { db } from '@/db';
import { siteSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SETTING_DEFAULTS, type SettingKey, type SettingsMap } from './settings';
import { decryptSecret } from './crypto.server';

/** Env keys that can be stored encrypted in the DB. */
export type ManagedEnvKey =
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'RESEND_API_KEY'
  | 'OPENROUTER_API_KEY'
  | 'SENTRY_DSN'
  | 'DATABASE_URL';

/**
 * Resolve an environment variable: DB override (decrypted) → process.env fallback.
 */
export async function resolveEnvVar(envKey: ManagedEnvKey): Promise<string | undefined> {
  try {
    const row = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, `env.${envKey}`))
      .limit(1);

    if (row.length > 0) {
      const encrypted = row[0].value as string;
      return decryptSecret(encrypted);
    }
  } catch {
    // Fall through to env var if decryption fails
  }
  return process.env[envKey];
}

/** Get a single setting value, falling back to the coded default. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  const row = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  if (row.length === 0) return SETTING_DEFAULTS[key];
  return row[0].value as SettingsMap[K];
}

/** Get all settings, merging DB overrides onto defaults. */
export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.key in SETTING_DEFAULTS) {
      merged[row.key] = row.value;
    }
  }
  return merged as unknown as SettingsMap;
}

/** Update one or more settings atomically. */
export async function updateSettings(
  updates: Partial<SettingsMap>,
  updatedBy?: string,
): Promise<void> {
  const now = new Date();
  const entries = Object.entries(updates).filter(([key]) => key in SETTING_DEFAULTS);
  if (entries.length === 0) return;

  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(siteSettings)
        .values({ key, value: value as Record<string, unknown>, updatedAt: now, updatedBy: updatedBy ?? null })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: value as Record<string, unknown>, updatedAt: now, updatedBy: updatedBy ?? null },
        });
    }
  });
}
