/**
 * M11 — 7.4 Frontend Code Audit Test
 *
 * Recursively scans all frontend source files (.ts, .tsx) under
 * src/app/ and src/components/ for patterns that could reveal
 * the dual campaign simulation system.
 *
 * Excluded directories (legitimately reference simulation internals):
 *   - src/app/api/v1/admin/   (admin API routes)
 *   - src/app/api/v1/cron/    (cron job handlers)
 *   - src/app/admin/          (admin UI pages)
 *   - src/components/admin/   (admin components)
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, relative, sep } from 'path';
import { globSync } from 'glob';

const ROOT = resolve(__dirname, '../..');

/** Directories to scan for frontend source code. */
const SCAN_DIRS = ['src/app', 'src/components'];

/** Directories whose files may legitimately reference simulation internals. */
const EXCLUDED_PATHS = [
  'src/app/api/',
  'src/app/admin',
  'src/components/admin',
];

/**
 * Patterns that should not appear in any public-facing frontend file.
 * Each entry has a regex pattern and a human-readable description.
 */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\bsimulation_flag\b/i, description: 'simulation_flag field reference' },
  { pattern: /\bsimulationFlag\b/, description: 'simulationFlag property reference' },
  { pattern: /\bSimulationConfig\b/, description: 'SimulationConfig type import' },
  { pattern: /\bsimulation_config\b/i, description: 'simulation_config field reference' },
  { pattern: /\bsimulationConfig\b/, description: 'simulationConfig property reference' },
  { pattern: /\bcampaignProfile\b/, description: 'campaignProfile property reference' },
  { pattern: /\bcampaign_profile\b/, description: 'campaign_profile field reference' },
  { pattern: /['"]seed['"]/, description: 'literal "seed" string value (donation source)' },
  { pattern: /\bsource:\s*['"]seed['"]/, description: 'source: "seed" assignment' },
  { pattern: /\b@lastdonor\.internal\b/, description: '@lastdonor.internal email domain' },
  { pattern: /\bcampaigns\.source\b/, description: 'campaigns.source column access' },
];

/**
 * Collect all .ts and .tsx files under SCAN_DIRS, excluding admin/cron paths.
 */
function getFrontendFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const matches = globSync(`${dir}/**/*.{ts,tsx}`, { cwd: ROOT });
    files.push(...matches);
  }

  return files.filter((f) => {
    const normalised = f.replace(/\\/g, '/');
    if (EXCLUDED_PATHS.some((exc) => normalised.startsWith(exc))) return false;
    // Exclude test files — they legitimately reference simulation internals
    if (/\.(test|spec|integration\.test)\.(ts|tsx)$/.test(normalised)) return false;
    return true;
  });
}

describe('Frontend Code Audit — Simulation Leak Prevention', () => {
  const frontendFiles = getFrontendFiles();

  it('discovers frontend files to scan', () => {
    // Sanity check: we should have campaign pages, components, layout, etc.
    expect(frontendFiles.length).toBeGreaterThan(10);
  });

  it('excludes admin, API, and test files', () => {
    for (const f of frontendFiles) {
      const normalised = f.replace(/\\/g, '/');
      expect(normalised).not.toMatch(/src\/app\/api\//);
      expect(normalised).not.toMatch(/src\/app\/admin\//);
      expect(normalised).not.toMatch(/src\/components\/admin\//);
      expect(normalised).not.toMatch(/\.(test|spec)\.(ts|tsx)$/);
    }
  });

  for (const file of getFrontendFiles()) {
    describe(file, () => {
      const fullPath = resolve(ROOT, file);
      const source = readFileSync(fullPath, 'utf-8');

      // Strip comments to avoid false positives on documentation
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');

      for (const { pattern, description } of FORBIDDEN_PATTERNS) {
        it(`does not contain ${description}`, () => {
          const match = pattern.exec(withoutComments);
          if (match) {
            // Find line number for the match
            const upToMatch = source.slice(0, source.indexOf(match[0]));
            const lineNo = (upToMatch.match(/\n/g) ?? []).length + 1;
            expect.fail(
              `Found "${match[0]}" at ${file}:${lineNo} — ` +
              `${description}. This could leak simulation data to the client.`,
            );
          }
        });
      }
    });
  }
});
