/**
 * Lightweight server-side logger for pipeline/cron operations.
 *
 * Logs to stdout (Vercel function logs) with structured prefixes.
 * Suppressed during test runs to keep test output clean.
 */
const isSilent = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export function pipelineLog(tag: string, message: string): void {
  if (isSilent) return;
  console.log(`  [${tag}] ${message}`);
}

export function pipelineWarn(tag: string, message: string): void {
  if (isSilent) return;
  console.warn(`  [${tag}] ${message}`);
}

export function pipelineError(tag: string, message: string): void {
  // Always log errors, even in tests
  console.error(`  [${tag}] ${message}`);
}
