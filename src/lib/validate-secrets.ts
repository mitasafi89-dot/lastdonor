/**
 * Secret Entropy Validation
 *
 * Validates that all required secrets meet minimum security requirements
 * at application startup. Fails fast in production if secrets are weak.
 *
 * Import in src/instrumentation.ts or call during server startup.
 */

interface SecretRule {
  minLength: number;
  pattern?: RegExp;
  description: string;
}

const REQUIRED_SECRETS: Record<string, SecretRule> = {
  NEXTAUTH_SECRET: {
    minLength: 32,
    description: 'NextAuth JWT signing key',
  },
  CRON_SECRET: {
    minLength: 32,
    description: 'Vercel cron authentication token',
  },
  STRIPE_SECRET_KEY: {
    minLength: 20,
    pattern: /^sk_(test|live)_/,
    description: 'Stripe API secret key',
  },
  STRIPE_WEBHOOK_SECRET: {
    minLength: 20,
    pattern: /^whsec_/,
    description: 'Stripe webhook signing secret',
  },
  DATABASE_URL: {
    minLength: 20,
    pattern: /^postgres(ql)?:\/\//,
    description: 'PostgreSQL connection string',
  },
  PASSWORD_PEPPER: {
    minLength: 32,
    description: 'Server-side pepper for HMAC pre-hashing passwords (hex string)',
  },
};

// Secrets that must NOT share the same value (key separation)
const KEY_SEPARATION_RULES: Array<[string, string]> = [
  ['NEXTAUTH_SECRET', 'NEWSLETTER_UNSUBSCRIBE_SECRET'],
  ['NEXTAUTH_SECRET', 'SETTINGS_ENCRYPTION_KEY'],
  ['NEXTAUTH_SECRET', 'PASSWORD_PEPPER'],
];

export function validateSecrets(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required secrets
  for (const [name, rules] of Object.entries(REQUIRED_SECRETS)) {
    const value = process.env[name];
    if (!value) {
      errors.push(`Missing required secret: ${name} (${rules.description})`);
      continue;
    }
    if (value.length < rules.minLength) {
      errors.push(
        `${name} too short: ${value.length} chars (minimum ${rules.minLength})`
      );
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${name} does not match expected format`);
    }
  }

  // Check key separation
  for (const [key1, key2] of KEY_SEPARATION_RULES) {
    const val1 = process.env[key1];
    const val2 = process.env[key2];
    if (val1 && val2 && val1 === val2) {
      warnings.push(
        `${key1} and ${key2} share the same value. Use separate secrets for each security domain.`
      );
    }
    // Also warn if key2 is unset (will fall back to key1 at runtime)
    if (val1 && !val2) {
      warnings.push(
        `${key2} is not set. It may fall back to ${key1} at runtime, creating a key separation issue.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Call in production startup. Throws on critical failures.
 */
export function enforceSecrets(): void {
  const result = validateSecrets();

  if (result.warnings.length > 0) {
    console.warn('[SECRET-VALIDATION] Warnings:');
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (!result.valid) {
    console.error('[SECRET-VALIDATION] FATAL - Secret validation failed:');
    result.errors.forEach((e) => console.error(`  - ${e}`));

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Secret validation failed with ${result.errors.length} error(s). ` +
          'Fix environment variables before deploying.'
      );
    }
  }
}
