#!/usr/bin/env node
/**
 * Security Audit Script - Oblique Reasoning Protocol
 *
 * Static analysis checks that enforce:
 *   1. Defense in Depth (The Castle Doctrine)
 *   2. Principle of Least Privilege (PoLP)
 *   3. Attack Surface Reduction
 *   4. Secure by Default
 *
 * Run: node scripts/security-audit.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
let violations = [];
let warnings = [];

function walk(dir, extensions = ['.ts', '.tsx', '.js', '.mjs']) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        results.push(...walk(full, extensions));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(full);
      }
    } catch { /* skip unreadable */ }
  }
  return results;
}

function rel(path) {
  return relative(ROOT, path).replace(/\\/g, '/');
}

// ─── RULE 1: Defense in Depth ──────────────────────────────────────────
// Detect API routes accessing DB without auth checks

function checkDefenseInDepth() {
  const apiDir = join(SRC, 'app', 'api');
  const apiFiles = walk(apiDir);

  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    // Skip webhook routes (use signature verification instead)
    if (path.includes('/webhook/')) continue;
    // Skip health/status endpoints
    if (path.includes('/health') || path.includes('/stats')) continue;
    // Skip test files
    if (path.includes('.test.') || path.includes('.spec.')) continue;
    // Skip intentionally public routes
    const publicRoutes = ['/auth/register', '/auth/forgot-password', '/auth/reset-password',
      '/blog/route', '/campaigns/route', '/newsletter/', '/search/route',
      '/campaigns/[slug]/donors', '/campaigns/[slug]/messages', '/campaigns/[slug]/subscribe',
      '/campaigns/[slug]/route', '/donations/create-intent', '/donations/create-checkout',
      '/donations/confirm', '/notifications/route', '/og/'];
    if (publicRoutes.some((r) => path.includes(r))) continue;

    const hasDbAccess = /\bdb\b/.test(content) && /from\(/.test(content);
    const hasAuth = /requireRole|verifyCronAuth|auth\(\)|getServerSession/.test(content);
    const hasWebhookAuth = /constructEvent|verifySignature/.test(content);

    if (hasDbAccess && !hasAuth && !hasWebhookAuth) {
      // Check if it's a public GET-only route (campaigns list, blog list)
      const isPublicRead = /export\s+(async\s+)?function\s+GET/.test(content) &&
                          !/export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)/.test(content);
      if (!isPublicRead) {
        violations.push({
          rule: 'DEFENSE_IN_DEPTH',
          file: path,
          message: 'Route accesses database without auth/webhook verification',
          severity: 'HIGH',
        });
      }
    }

    // Check for missing error sanitization on catch blocks that return raw error.message
    const rawErrorReturn = /catch\s*\([^)]*\)\s*\{[^}]*error\.message[^}]*NextResponse\.json/s;
    if (rawErrorReturn.test(content)) {
      warnings.push({
        rule: 'DEFENSE_IN_DEPTH',
        file: path,
        message: 'Catch block may return raw error.message to client. Use sanitizeErrorMessage().',
        severity: 'MEDIUM',
      });
    }
  }
}

// ─── RULE 2: Principle of Least Privilege ──────────────────────────────
// Detect overprivileged database connections, root/admin credentials in config

function checkLeastPrivilege() {
  // Check .env.example for root/admin in connection strings
  try {
    const envExample = readFileSync(join(ROOT, '.env.example'), 'utf-8');
    if (/postgres:\/\/(root|admin|postgres):/.test(envExample)) {
      warnings.push({
        rule: 'LEAST_PRIVILEGE',
        file: '.env.example',
        message: 'DATABASE_URL example uses privileged user (root/admin/postgres). Use a restricted DB user.',
        severity: 'HIGH',
      });
    }
  } catch { /* no .env.example */ }

  // Check for admin-only operations in non-admin routes
  const apiFiles = walk(join(SRC, 'app', 'api'));
  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    // Skip test files
    if (path.includes('.test.') || path.includes('.spec.')) continue;

    // Detect DELETE operations on tables without admin check
    if (path.includes('/admin/') === false) {
      if (/\.delete\(/.test(content) && /requireRole\(\['admin/.test(content) === false) {
        const hasOwnerCheck = /creatorId.*session|session.*creatorId|session\.user\.id/.test(content);
        // Exclude webhook routes (use signature auth), auth routes (token cleanup), SET operations
        const isWebhookOrAuth = path.includes('/webhook/') || path.includes('/auth/');
        if (!hasOwnerCheck && !/\/users\/me\//.test(path) && !isWebhookOrAuth) {
          warnings.push({
            rule: 'LEAST_PRIVILEGE',
            file: path,
            message: 'DELETE operation without admin role or ownership check',
            severity: 'HIGH',
          });
        }
      }
    }

    // Check for `db.execute(sql` with dynamic interpolation (should use parameterized)
    if (/db\.execute\(sql`[^`]*\$\{(?!table\.|schema\.|campaigns\.|users\.|donations\.)/.test(content)) {
      violations.push({
        rule: 'LEAST_PRIVILEGE',
        file: path,
        message: 'Raw SQL execute with dynamic interpolation - verify parameterization',
        severity: 'MEDIUM',
      });
    }
  }
}

// ─── RULE 3: Attack Surface Reduction ──────────────────────────────────
// Detect console.log, debug routes, exposed admin interfaces

function checkAttackSurfaceReduction() {
  const allFiles = walk(SRC);

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    // Skip test files
    if (path.includes('.test.') || path.includes('.spec.') || path.includes('__test')) continue;

    // console.log in production API routes
    if (path.includes('src/app/api/')) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/console\.log\(/.test(line)) {
          violations.push({
            rule: 'ATTACK_SURFACE',
            file: path,
            line: i + 1,
            message: `console.log() in API route. Use structured logging (Sentry/logError) instead.`,
            severity: 'MEDIUM',
          });
        }
      });
    }

    // Detect debug/test endpoints in production
    if (path.includes('src/app/api/') && /\/(debug|test|_internal|phpmyadmin|\.git)\//i.test(path)) {
      violations.push({
        rule: 'ATTACK_SURFACE',
        file: path,
        message: 'Debug/test endpoint detected in API routes. Remove before production.',
        severity: 'HIGH',
      });
    }

    // Check for `unsafe-eval` or `unsafe-inline` in CSP (already known, track it)
    if (path.includes('next.config') && /unsafe-eval/.test(content)) {
      warnings.push({
        rule: 'ATTACK_SURFACE',
        file: path,
        message: "CSP includes 'unsafe-eval'. Monitor for XSS vectors.",
        severity: 'LOW',
      });
    }
  }

  // Check for exposed .git or sensitive files
  const publicDir = join(ROOT, 'public');
  try {
    const publicFiles = walk(publicDir, ['.git', '.env', '.sql', '.dump']);
    for (const file of publicFiles) {
      violations.push({
        rule: 'ATTACK_SURFACE',
        file: rel(file),
        message: 'Sensitive file in public directory',
        severity: 'CRITICAL',
      });
    }
  } catch { /* no public dir */ }
}

// ─── RULE 4: Secure by Default ─────────────────────────────────────────
// Detect insecure defaults: permissions, feature flags, config

function checkSecureByDefault() {
  const schemaFile = join(SRC, 'db', 'schema.ts');
  try {
    const schema = readFileSync(schemaFile, 'utf-8');

    // New users should default to least-privilege role
    if (/role.*default\('admin'\)/.test(schema)) {
      violations.push({
        rule: 'SECURE_BY_DEFAULT',
        file: 'src/db/schema.ts',
        message: 'User role defaults to admin. Must default to least-privilege role.',
        severity: 'CRITICAL',
      });
    }

    // Campaigns should default to draft, not active
    if (/status.*default\('active'\)/.test(schema) && /campaigns/.test(schema)) {
      violations.push({
        rule: 'SECURE_BY_DEFAULT',
        file: 'src/db/schema.ts',
        message: 'Campaign status defaults to active. Must default to draft.',
        severity: 'HIGH',
      });
    }

    // Verification should default to unverified
    if (/verificationStatus.*default\('verified'\)/.test(schema)) {
      violations.push({
        rule: 'SECURE_BY_DEFAULT',
        file: 'src/db/schema.ts',
        message: 'Verification defaults to verified. Must default to unverified.',
        severity: 'CRITICAL',
      });
    }

    // Fund releases should default to held
    if (/fundReleaseStatus.*default\('released'\)/.test(schema)) {
      violations.push({
        rule: 'SECURE_BY_DEFAULT',
        file: 'src/db/schema.ts',
        message: 'Fund release status defaults to released. Must default to held.',
        severity: 'CRITICAL',
      });
    }
  } catch { /* schema not found */ }

  // Check that blog pipeline defaults to off
  try {
    const envExample = readFileSync(join(ROOT, '.env.example'), 'utf-8');
    if (/BLOG_PIPELINE_ENABLED=true/.test(envExample)) {
      warnings.push({
        rule: 'SECURE_BY_DEFAULT',
        file: '.env.example',
        message: 'BLOG_PIPELINE_ENABLED defaults to true. Should be false (opt-in).',
        severity: 'MEDIUM',
      });
    }
    if (/BLOG_AUTO_PUBLISH=true/.test(envExample)) {
      warnings.push({
        rule: 'SECURE_BY_DEFAULT',
        file: '.env.example',
        message: 'BLOG_AUTO_PUBLISH defaults to true. Should be false (opt-in).',
        severity: 'MEDIUM',
      });
    }
  } catch { /* no .env.example */ }

  // Check next.config for security headers
  try {
    const nextConfig = readFileSync(join(ROOT, 'next.config.ts'), 'utf-8');
    if (!/X-Frame-Options/.test(nextConfig)) {
      violations.push({
        rule: 'SECURE_BY_DEFAULT',
        file: 'next.config.ts',
        message: 'Missing X-Frame-Options header (clickjacking protection).',
        severity: 'HIGH',
      });
    }
    if (!/Strict-Transport-Security/.test(nextConfig)) {
      violations.push({
        rule: 'SECURE_BY_DEFAULT',
        file: 'next.config.ts',
        message: 'Missing HSTS header.',
        severity: 'HIGH',
      });
    }
    if (/poweredByHeader:\s*true/.test(nextConfig) || !/poweredByHeader/.test(nextConfig)) {
      // Already set to false, so only flag if true
      if (/poweredByHeader:\s*true/.test(nextConfig)) {
        warnings.push({
          rule: 'SECURE_BY_DEFAULT',
          file: 'next.config.ts',
          message: 'poweredByHeader should be false to avoid information disclosure.',
          severity: 'LOW',
        });
      }
    }
  } catch { /* no next.config */ }
}

// ─── EXECUTE ALL CHECKS ────────────────────────────────────────────────

console.log('\n=== LastDonor Security Audit (Oblique Reasoning Protocol) ===\n');

checkDefenseInDepth();
checkLeastPrivilege();
checkAttackSurfaceReduction();
checkSecureByDefault();

// ─── REPORT ────────────────────────────────────────────────────────────

const criticalCount = violations.filter((v) => v.severity === 'CRITICAL').length;
const highCount = violations.filter((v) => v.severity === 'HIGH').length;
const mediumCount = [...violations, ...warnings].filter((v) => v.severity === 'MEDIUM').length;
const lowCount = [...violations, ...warnings].filter((v) => v.severity === 'LOW').length;

console.log(`Violations: ${violations.length} | Warnings: ${warnings.length}`);
console.log(`  CRITICAL: ${criticalCount} | HIGH: ${highCount} | MEDIUM: ${mediumCount} | LOW: ${lowCount}\n`);

for (const v of violations) {
  const loc = v.line ? `${v.file}:${v.line}` : v.file;
  console.log(`  [${v.severity}] ${v.rule} - ${loc}`);
  console.log(`    ${v.message}\n`);
}

if (warnings.length > 0) {
  console.log('--- Warnings ---\n');
  for (const w of warnings) {
    const loc = w.line ? `${w.file}:${w.line}` : w.file;
    console.log(`  [${w.severity}] ${w.rule} - ${loc}`);
    console.log(`    ${w.message}\n`);
  }
}

if (criticalCount > 0) {
  console.log('\n!!! CRITICAL violations found. Build should FAIL. !!!\n');
  process.exit(1);
}

if (violations.length === 0 && warnings.length === 0) {
  console.log('All checks passed.\n');
}

process.exit(0);
