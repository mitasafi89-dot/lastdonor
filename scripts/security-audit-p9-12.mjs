#!/usr/bin/env node
/**
 * Security Audit Script - Principles 9-12 (Oblique Reasoning Protocol)
 *
 * Enforces:
 *   9.  Economy of Mechanism (Keep It Simple)
 *   10. Separation of Privilege (Two-Person Control)
 *   11. Parameterized Queries (Anti-Injection)
 *   12. Context-Aware Output Encoding (Anti-XSS)
 *
 * Run: node scripts/security-audit-p9-12.mjs
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

// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPLE 9: Economy of Mechanism (Keep It Simple)
// ═══════════════════════════════════════════════════════════════════════════
// Detect custom cryptography, custom hashing, hand-rolled auth, or
// unnecessarily complex security code that should use standard libraries.

function checkEconomyOfMechanism() {
  const allFiles = walk(SRC);

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    if (path.includes('.test.') || path.includes('.spec.')) continue;

    const lines = content.split('\n');

    // Rule 9.1: Detect custom crypto implementations (not from standard lib)
    // Flag any file that imports 'crypto' and implements its own hashing scheme
    // OUTSIDE of the approved crypto.server.ts module
    if (
      /from\s+['"]crypto['"]/.test(content) &&
      !path.includes('crypto.server') &&
      !path.includes('cron-auth') &&
      !path.includes('validate-secrets')
    ) {
      // Check for hand-rolled hash patterns (not just import)
      if (/createHash\(/.test(content) && !/bcrypt/.test(content)) {
        violations.push({
          rule: 'ECONOMY_OF_MECHANISM',
          file: path,
          message: 'Hand-rolled hashing detected outside approved crypto module. Use bcryptjs for passwords or crypto.server.ts for HMAC.',
          severity: 'HIGH',
        });
      }
    }

    // Rule 9.2: Detect custom JWT parsing (should use NextAuth)
    if (/jwt\.decode|jwt\.verify|jsonwebtoken/.test(content) && !path.includes('auth')) {
      violations.push({
        rule: 'ECONOMY_OF_MECHANISM',
        file: path,
        message: 'Custom JWT handling detected. Use NextAuth session management instead.',
        severity: 'HIGH',
      });
    }

    // Rule 9.3: Detect hand-rolled CSRF tokens (should use framework)
    if (/csrf|xsrf/i.test(content) && !path.includes('.test') && !path.includes('middleware')) {
      if (/generate.*csrf|create.*csrf|csrf.*token/i.test(content)) {
        warnings.push({
          rule: 'ECONOMY_OF_MECHANISM',
          file: path,
          message: 'Custom CSRF implementation detected. Verify it uses framework-level CSRF protection.',
          severity: 'MEDIUM',
        });
      }
    }

    // Rule 9.4: Detect complex auth guard code (>50 lines of auth logic in a route)
    if (path.includes('src/app/api/')) {
      const authLines = lines.filter((l) =>
        /session|auth|role|permission|token|authorized/i.test(l)
      );
      if (authLines.length > 50) {
        warnings.push({
          rule: 'ECONOMY_OF_MECHANISM',
          file: path,
          message: `${authLines.length} lines of auth logic in single route. Consider extracting to shared middleware.`,
          severity: 'LOW',
        });
      }
    }

    // Rule 9.5 (Oblique - "salt"): Detect encryption/hashing without proper salt/IV
    // A simple bcrypt call is fine; a custom AES without random IV is broken
    if (/createCipheriv|createCipher\(/.test(content) && !path.includes('crypto.server')) {
      violations.push({
        rule: 'ECONOMY_OF_MECHANISM_OBLIQUE',
        file: path,
        message: 'Cipher usage outside approved crypto.server.ts. Centralize all encryption in one module.',
        severity: 'HIGH',
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPLE 10: Separation of Privilege (Two-Person Control)
// ═══════════════════════════════════════════════════════════════════════════
// Detect single-admin operations on high-risk financial or destructive
// actions that should require approval from a second actor.

function checkSeparationOfPrivilege() {
  const apiFiles = walk(join(SRC, 'app', 'api'));

  // High-risk operations that should require two-person control
  const HIGH_RISK_PATTERNS = [
    { pattern: /fundRelease|fund.*release|release.*fund/i, label: 'fund release', contextCheck: /\.insert\(fundReleases\)|status:\s*['"](?:approved|released)['"]/ },
    { pattern: /disburse|disbursement/i, label: 'fund disbursement', contextCheck: /\.insert\(|\.update\(/ },
    { pattern: /\.delete\(campaigns\)|DROP\s+TABLE|TRUNCATE/i, label: 'campaign deletion', contextCheck: null },
    { pattern: /\.set\(\{[^}]*role:\s*['"]admin['"]/, label: 'admin role assignment', contextCheck: null },
  ];

  const TWO_PERSON_MARKERS = [
    /secondApprover|secondAdmin|dualApproval|twoPersonControl/i,
    /approvedBy.*!==.*session|approvedBy.*!==.*adminId/,
    /requireSecondApproval/,
    /REQUIRES_SECOND_ADMIN/,
  ];

  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    if (path.includes('.test.') || path.includes('.spec.')) continue;

    for (const { pattern, label, contextCheck } of HIGH_RISK_PATTERNS) {
      if (pattern.test(content)) {
        // If there's a context check, verify the pattern is actually performing the operation
        if (contextCheck && !contextCheck.test(content)) continue;

        const hasTwoPersonControl = TWO_PERSON_MARKERS.some((m) => m.test(content));

        if (!hasTwoPersonControl) {
          // Check if it's a state-changing operation (not just a read)
          const isWrite = /POST|PUT|PATCH|DELETE/.test(content) &&
                         /\.insert\(|\.update\(|\.delete\(/.test(content);

          if (isWrite) {
            violations.push({
              rule: 'SEPARATION_OF_PRIVILEGE',
              file: path,
              message: `High-risk operation (${label}) without two-person control. A single admin can complete this alone.`,
              severity: 'HIGH',
            });
          }
        }
      }
    }

    // Rule 10.1: Detect admin self-privilege-escalation vectors
    if (/\.update\(users\)/.test(content) && /role/.test(content)) {
      if (!/session\.user\.id\s*!==|adminId\s*!==/.test(content)) {
        warnings.push({
          rule: 'SEPARATION_OF_PRIVILEGE',
          file: path,
          message: 'Admin can change roles without self-exclusion check.',
          severity: 'MEDIUM',
        });
      }
    }
  }

  // Rule 10.2 (Oblique - "mirror"): Check CI/CD for required reviewers
  try {
    const ciConfig = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf-8');
    if (!/required_reviewers|required-reviewers|review.*required/i.test(ciConfig)) {
      warnings.push({
        rule: 'SEPARATION_OF_PRIVILEGE_OBLIQUE',
        file: '.github/workflows/ci.yml',
        message: 'CI pipeline does not enforce required reviewers. Add branch protection rule with required_reviewers >= 1.',
        severity: 'MEDIUM',
      });
    }
  } catch { /* no CI config */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPLE 11: Parameterized Queries (Anti-Injection)
// ═══════════════════════════════════════════════════════════════════════════
// Detect string concatenation in SQL/NoSQL queries, sql.raw() usage,
// and template literal injection vectors.

function checkParameterizedQueries() {
  const allFiles = walk(SRC);

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    if (path.includes('.test.') || path.includes('.spec.')) continue;

    // Rule 11.1: Detect sql.raw() - almost always unsafe
    if (/sql\.raw\(/.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/sql\.raw\(/.test(line)) {
          violations.push({
            rule: 'PARAMETERIZED_QUERIES',
            file: path,
            line: i + 1,
            message: `sql.raw() detected. This bypasses parameterization. Use Drizzle ORM operators (inArray, eq, like) instead.`,
            severity: 'CRITICAL',
          });
        }
      });
    }

    // Rule 11.2: Detect string concatenation in SQL template tags
    // Pattern: sql`... ${variable} ... ${'string' + userInput} ...`
    // Safe: sql`${table.column} = ${value}` (Drizzle parameterizes these)
    const sqlConcatPattern = /sql`[^`]*\$\{[^}]*\+[^}]*\}[^`]*`/;
    if (sqlConcatPattern.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (sqlConcatPattern.test(line)) {
          // Exclude safe patterns: LIKE with '%' + value
          if (!/LIKE.*'%'\s*\+/.test(line) && !/\+\s*'%'/.test(line)) {
            violations.push({
              rule: 'PARAMETERIZED_QUERIES',
              file: path,
              line: i + 1,
              message: 'String concatenation inside sql`` template tag. Use parameterized placeholders.',
              severity: 'HIGH',
            });
          }
        }
      });
    }

    // Rule 11.3: Detect traditional SQL injection patterns
    const classicInjection = /query\(["']SELECT.*\+|query\(["']INSERT.*\+|query\(["']UPDATE.*\+|query\(["']DELETE.*\+/i;
    if (classicInjection.test(content)) {
      violations.push({
        rule: 'PARAMETERIZED_QUERIES',
        file: path,
        message: 'Classic SQL injection pattern: string concatenation in raw query() call.',
        severity: 'CRITICAL',
      });
    }

    // Rule 11.4: Detect db.execute with template literals containing user-controlled values
    if (/db\.execute\(/.test(content) && !/db\.execute\(sql`/.test(content)) {
      violations.push({
        rule: 'PARAMETERIZED_QUERIES',
        file: path,
        message: 'db.execute() called without sql`` template tag. Potential raw query.',
        severity: 'HIGH',
      });
    }

    // Rule 11.5 (Oblique - "knot"): Check for dynamic ORDER BY / table names
    // The "knot" twist: even parameterized queries can be injected via identifiers
    const orderByFromInput = /orderBy.*\breq\b|sortBy.*\breq\b|sort.*query|order.*query/i;
    if (orderByFromInput.test(content)) {
      // Check if there's an allowlist for the sort column
      const hasAllowlist = /allowedSort|validSort|SORT_FIELDS|sortColumns|sortOptions/i.test(content);
      if (!hasAllowlist) {
        warnings.push({
          rule: 'PARAMETERIZED_QUERIES_OBLIQUE',
          file: path,
          message: 'Dynamic ORDER BY derived from request input without column allowlist. Column names cannot be parameterized.',
          severity: 'MEDIUM',
        });
      }
    }
  }

  // Also check scripts directory
  const scriptDir = join(ROOT, 'scripts');
  try {
    const scripts = walk(scriptDir, ['.ts', '.js', '.mjs', '.cjs']);
    for (const file of scripts) {
      const content = readFileSync(file, 'utf-8');
      const path = rel(file);

      // Skip audit scripts themselves (they contain detection patterns, not actual sql.raw usage)
      if (path.includes('security-audit')) continue;

      if (/sql\.raw\(/.test(content)) {
        violations.push({
          rule: 'PARAMETERIZED_QUERIES',
          file: path,
          message: 'sql.raw() in scripts. Verify no user input reaches this code path.',
          severity: 'MEDIUM',
        });
      }
    }
  } catch { /* no scripts dir */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPLE 12: Context-Aware Output Encoding (Anti-XSS)
// ═══════════════════════════════════════════════════════════════════════════
// Detect dangerouslySetInnerHTML without sanitization, innerHTML assignments,
// and missing DOMPurify usage. Verify encoding matches output context.

function checkOutputEncoding() {
  const allFiles = walk(SRC);

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = rel(file);

    if (path.includes('.test.') || path.includes('.spec.')) continue;

    // Rule 12.1: dangerouslySetInnerHTML without sanitizeHtml()
    if (/dangerouslySetInnerHTML/.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/dangerouslySetInnerHTML/.test(line)) {
          // Check if this is JSON-LD structured data (safe - hardcoded schema)
          const context = lines.slice(Math.max(0, i - 5), i + 5).join('\n');
          const isJsonLd = /application\/ld\+json|JSON\.stringify/.test(context);

          // Check for hardcoded inline scripts (no user input, e.g. theme detection)
          const isHardcodedScript = /dangerouslySetInnerHTML=\{\{\s*__html:\s*`[^$]*`/.test(context) ||
            /dangerouslySetInnerHTML=\{\{\s*__html:\s*['"][^'"]*['"]/.test(line);

          // Check if the value is a variable that was previously sanitized
          // Pattern: variable named sanitized*, clean*, preview* (set via setState(sanitizeHtml(...)))
          const varMatch = line.match(/__html:\s*(\w+)/);
          const isSanitizedVar = varMatch && /^(sanitized|clean|safe|preview)/.test(varMatch[1]);

          if (!isJsonLd && !isHardcodedScript && !isSanitizedVar) {
            // Check if sanitizeHtml() or DOMPurify.sanitize() wraps the value
            const hasSanitize = /sanitizeHtml\(|DOMPurify\.sanitize\(/.test(context);
            if (!hasSanitize) {
              violations.push({
                rule: 'OUTPUT_ENCODING',
                file: path,
                line: i + 1,
                message: 'dangerouslySetInnerHTML without sanitizeHtml(). Stored XSS vector.',
                severity: 'CRITICAL',
              });
            }
          }
        }
      });
    }

    // Rule 12.2: Direct innerHTML assignment
    if (/\.innerHTML\s*=/.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/\.innerHTML\s*=/.test(line)) {
          violations.push({
            rule: 'OUTPUT_ENCODING',
            file: path,
            line: i + 1,
            message: 'Direct innerHTML assignment. Use React rendering or sanitizeHtml().',
            severity: 'CRITICAL',
          });
        }
      });
    }

    // Rule 12.3: User-provided content in href/src without validation
    // This catches: href={userInput} or src={userInput} that could be javascript: URIs
    if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // Detect href={variable} patterns (not static strings)
        if (/href=\{[^}]*\b(url|link|href|src)\b/.test(line)) {
          const context = lines.slice(Math.max(0, i - 3), i + 3).join('\n');
          // Check for javascript: URI protection
          if (!/javascript:|startsWith\(['"]http|isValidUrl|validateUrl|URL\(/.test(context)) {
            warnings.push({
              rule: 'OUTPUT_ENCODING',
              file: path,
              line: i + 1,
              message: 'Dynamic href without URL validation. Potential javascript: URI injection.',
              severity: 'MEDIUM',
            });
          }
        }
      });
    }

    // Rule 12.4: Check that API responses don't echo user input without encoding
    if (path.includes('src/app/api/') && /req\.body|req\.query|searchParams/.test(content)) {
      if (/NextResponse\.json.*message.*req\.body|NextResponse\.json.*message.*searchParams/.test(content)) {
        warnings.push({
          rule: 'OUTPUT_ENCODING',
          file: path,
          message: 'API response may echo user input in error messages. Ensure no HTML context consumers.',
          severity: 'LOW',
        });
      }
    }

    // Rule 12.5 (Oblique - "sponge"): Verify double-encoding protection
    // The "sponge" twist: data sanitized at write time may be re-encoded on read
    // causing entities like &amp;lt; - check for double sanitization
    if (/sanitizeHtml\(sanitizeHtml\(|DOMPurify\.sanitize\(DOMPurify\.sanitize\(/.test(content)) {
      warnings.push({
        rule: 'OUTPUT_ENCODING_OBLIQUE',
        file: path,
        message: 'Double sanitization detected. This causes garbled output (&amp;lt; instead of &lt;). Sanitize ONCE at render time only.',
        severity: 'MEDIUM',
      });
    }
  }

  // Rule 12.6: CSP validation
  try {
    const nextConfig = readFileSync(join(ROOT, 'next.config.ts'), 'utf-8');

    if (/unsafe-inline/.test(nextConfig) && /script-src/.test(nextConfig)) {
      warnings.push({
        rule: 'OUTPUT_ENCODING',
        file: 'next.config.ts',
        message: "CSP script-src includes 'unsafe-inline'. This weakens XSS mitigations. Use nonces or hashes instead.",
        severity: 'HIGH',
      });
    }

    if (!/script-src/.test(nextConfig)) {
      violations.push({
        rule: 'OUTPUT_ENCODING',
        file: 'next.config.ts',
        message: 'No script-src directive in CSP. All script sources are allowed.',
        severity: 'CRITICAL',
      });
    }
  } catch { /* no next.config */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTE ALL CHECKS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== Security Audit: Principles 9-12 (Oblique Reasoning) ===\n');

checkEconomyOfMechanism();
checkSeparationOfPrivilege();
checkParameterizedQueries();
checkOutputEncoding();

// ─── REPORT ────────────────────────────────────────────────────────────

const criticalCount = violations.filter((v) => v.severity === 'CRITICAL').length;
const highCount = violations.filter((v) => v.severity === 'HIGH').length;
const mediumCount = [...violations, ...warnings].filter((v) => v.severity === 'MEDIUM').length;
const lowCount = [...violations, ...warnings].filter((v) => v.severity === 'LOW').length;

console.log(`Violations: ${violations.length} | Warnings: ${warnings.length}`);
console.log(`  CRITICAL: ${criticalCount} | HIGH: ${highCount} | MEDIUM: ${mediumCount} | LOW: ${lowCount}\n`);

if (violations.length > 0) {
  console.log('--- VIOLATIONS (build blockers) ---\n');
  for (const v of violations) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.log(`  [${v.severity}] ${v.rule} - ${loc}`);
    console.log(`    ${v.message}\n`);
  }
}

if (warnings.length > 0) {
  console.log('--- WARNINGS (review recommended) ---\n');
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
  console.log('All Principle 9-12 checks passed.\n');
}

process.exit(0);
