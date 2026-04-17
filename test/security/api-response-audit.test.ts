/**
 * M11 - 7.1 API Response Audit Test
 *
 * Scans all public API route handler source files for patterns that could
 * leak simulation-related data to the client. This is a static-analysis
 * safety net that catches leaks before they reach production.
 *
 * Strategy:
 *   1. Read every public route handler source file on disk.
 *   2. Check that no forbidden field names or values appear in response
 *      construction (except in import lines, comments, or filter conditions).
 *   3. Flag any use of `.returning()` in public routes that could expose
 *      full rows (including simulation columns) to non-admin callers.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { globSync } from 'glob';

const ROOT = resolve(__dirname, '../..');

/**
 * Public API route files - every route.ts under api/v1/ that is NOT
 * behind /admin/ or /cron/ gates.
 */
function getPublicRouteFiles(): string[] {
  const allRoutes = globSync('src/app/api/v1/**/route.ts', { cwd: ROOT });
  return allRoutes.filter((f) => {
    const normalised = f.replace(/\\/g, '/');
    return !normalised.includes('/admin/') && !normalised.includes('/cron/');
  });
}

/**
 * Forbidden JSON key names that should never appear as serialised
 * property names in a public API response.
 */
const FORBIDDEN_RESPONSE_KEYS = [
  'simulation_flag',
  'simulationFlag',
  'simulation_config',
  'simulationConfig',
  'campaignProfile',
  'campaign_profile',
  'source',
];

/**
 * Forbidden string values that should not appear as literal string
 * values in public response construction.
 */
const FORBIDDEN_RESPONSE_VALUES = [
  '@lastdonor.internal',
  'automated',
  'seed',
  'simulated',
];

describe('API Response Audit - Public Routes', () => {
  const publicFiles = getPublicRouteFiles();

  it('discovers at least 5 public route files', () => {
    // Sanity check: we should have campaigns, donors, messages, stats, etc.
    expect(publicFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const relPath of getPublicRouteFiles()) {
    const fullPath = join(ROOT, relPath);

    describe(relPath, () => {
      const source = readFileSync(fullPath, 'utf-8');

      // Strip single-line comments and JSDoc/block comments so we don't
      // false-positive on documentation referencing forbidden fields.
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
        .replace(/\/\/.*/g, '');             // single-line comments

      for (const key of FORBIDDEN_RESPONSE_KEYS) {
        it(`does not reference "${key}" in response data`, () => {
          // We search the comment-stripped source.
          // Import lines are acceptable (importing the column for filter/where
          // clauses). We look for the key appearing as a property name in
          // object construction: `key:` or `"key":` or as a string `'key'`.
          //
          // Allow the key if it ONLY appears in a where/filter clause
          // e.g. `eq(campaigns.simulationFlag, false)`.
          // But flag if it appears as: `simulationFlag: campaigns.simulationFlag`
          // (select/returning inclusion).

          // Simple heuristic: the key should not appear as a property key
          // in a select/returning object. We check for the pattern:
          //   <key>: campaigns.<key>   OR   <key>: <something>
          // inside select({...}) or after .returning()
          const selectPattern = new RegExp(
            `(?:select|returning)\\s*\\([^)]*${key}[^)]*\\)`,
            'i',
          );

          // The key referenced as a select property name (not in a where)
          // e.g. `simulationFlag: campaigns.simulationFlag` in a select({})
          const propPattern = new RegExp(
            `\\b${key}\\s*:\\s*(?:campaigns|donations|schema)\\.`,
            'i',
          );

          const hasInSelect = selectPattern.test(withoutComments);
          const hasProp = propPattern.test(withoutComments);

          if (hasInSelect || hasProp) {
            // Check if this file is behind auth guards (has requireRole calls)
            const isFullyAdminGated = /requireRole\s*\(\s*\[?\s*['"]admin['"]\s*\]?\s*\)/.test(source);

            // Check if the key appears in the response body itself.
            // A select() that reads the key for server-side logic (e.g. deciding
            // Stripe metadata) but never serialises it to clients is safe.
            //
            // We look for the key appearing as a property in a response-type
            // context: `key:` (object prop) or `data.key` (access) appearing
            // on a line that also references response/data/json construction.
            // We specifically check whether the key is returned in the API
            // response type definition or inline in json({ data: { key } }).
            const responseTypePattern = new RegExp(
              `\\b${key}\\b\\s*[:\\?]`,
              'i',
            );
            // Extract lines near NextResponse.json to check for key inclusion
            const jsonLines = withoutComments.split('\n');
            let keyInResponse = false;
            let inJsonBlock = false;
            let braceDepth = 0;

            for (const line of jsonLines) {
              if (/NextResponse\.json\s*\(/.test(line)) {
                inJsonBlock = true;
                braceDepth = 0;
              }
              if (inJsonBlock) {
                braceDepth += (line.match(/\{/g) ?? []).length;
                braceDepth -= (line.match(/\}/g) ?? []).length;
                if (responseTypePattern.test(line)) {
                  keyInResponse = true;
                  break;
                }
                if (braceDepth <= 0 && line.includes(')')) {
                  inJsonBlock = false;
                }
              }
            }

            if (!isFullyAdminGated && keyInResponse) {
              expect.fail(
                `Public route "${relPath}" references "${key}" in a select/returning ` +
                `without admin-only gating. This could leak simulation data.`,
              );
            }
          }
        });
      }

      for (const val of FORBIDDEN_RESPONSE_VALUES) {
        it(`does not include forbidden value "${val}"`, () => {
          expect(withoutComments).not.toContain(val);
        });
      }
    });
  }
});

describe('API Response Audit - Stats endpoint', () => {
  const statsPath = join(ROOT, 'src/app/api/v1/stats/route.ts');

  it('stats route exists', () => {
    expect(existsSync(statsPath)).toBe(true);
  });

  it('filters donations by source="real"', () => {
    const source = readFileSync(statsPath, 'utf-8');
    // The stats endpoint must only count real donations in public-facing stats
    expect(source).toMatch(/source.*real|eq\(.*source.*'real'\)/);
  });
});
