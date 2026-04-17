/**
 * Middleware Coverage Audit
 *
 * Detects API routes that are:
 * 1. Not covered by the Next.js middleware matcher
 * 2. Not in the known public routes list
 * 3. Missing inline auth checks
 *
 * Run: node scripts/audit-middleware-coverage.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const MIDDLEWARE_FILE = 'src/middleware.ts';
const API_DIR = 'src/app/api';

// Known intentionally public routes (no auth required)
const PUBLIC_ROUTES = [
  '/api/auth',              // NextAuth routes
  '/api/v1/campaigns',
  '/api/v1/blog',
  '/api/v1/newsletter',
  '/api/v1/auth',
  '/api/v1/donations/webhook',
  '/api/v1/donations/confirm',
  '/api/v1/donations/create-checkout',
  '/api/v1/stripe-connect/webhook',
  '/api/v1/health',
  '/api/v1/stats',
  '/api/v1/search',
  '/api/v1/cron',
];

// Extract matcher patterns from middleware
const middleware = readFileSync(MIDDLEWARE_FILE, 'utf-8');
const matcherMatch = middleware.match(/matcher:\s*\[([\s\S]*?)\]/);
const matchers = matcherMatch
  ? [...matcherMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : [];

console.log('=== Middleware Coverage Audit ===\n');
console.log('Middleware matchers:');
matchers.forEach((m) => console.log(`  ${m}`));
console.log('');

// Find all API route files
function findRoutes(dir, routes = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findRoutes(full, routes);
    } else if (entry === 'route.ts') {
      const rel = '/' + relative('src/app', dir).replace(/\\/g, '/');
      const apiPath = rel.replace(/\/\[([^\]]+)\]/g, '/:$1');
      routes.push({ path: apiPath, file: full });
    }
  }
  return routes;
}

const routes = findRoutes(API_DIR);

let criticalCount = 0;
let infoCount = 0;
let coveredCount = 0;

for (const route of routes) {
  // Check if covered by middleware matcher
  const covered = matchers.some((m) => {
    const pattern = m
      .replace(/:path\*/g, '.*')
      .replace(/\//g, '\\/')
      .replace(/\*/g, '.*');
    return new RegExp('^' + pattern + '$').test(route.path) ||
      new RegExp('^' + pattern).test(route.path);
  });

  const intentionallyPublic = PUBLIC_ROUTES.some((p) => route.path.startsWith(p));

  if (covered) {
    coveredCount++;
  } else if (intentionallyPublic) {
    // OK: public by design
  } else {
    // Not covered by middleware, not in public list -- check for inline auth
    const content = readFileSync(route.file, 'utf-8');
    const hasInlineAuth = /auth\(\)|requireRole|requireAuth|verifyCronAuth|validateWebhookSignature/.test(content);

    if (!hasInlineAuth) {
      console.log(`CRITICAL: ${route.path}`);
      console.log(`  File: ${route.file}`);
      console.log(`  NO auth protection (not in middleware, no inline auth)\n`);
      criticalCount++;
    } else {
      console.log(`INFO: ${route.path}`);
      console.log(`  File: ${route.file}`);
      console.log(`  Not in middleware but has inline auth\n`);
      infoCount++;
    }
  }
}

console.log('=== Summary ===');
console.log(`Total API routes: ${routes.length}`);
console.log(`Covered by middleware: ${coveredCount}`);
console.log(`Inline auth only (INFO): ${infoCount}`);
console.log(`UNPROTECTED (CRITICAL): ${criticalCount}`);

if (criticalCount > 0) {
  console.log('\n!! ACTION REQUIRED: Add auth to unprotected routes or add them to PUBLIC_ROUTES !!');
  process.exit(1);
}
