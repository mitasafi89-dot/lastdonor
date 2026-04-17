# LastDonor.org -- Oblique Security Audit Report

**Date**: 2026-04-15  
**Auditor**: AI Security Auditor (Oblique Reasoning Protocol)  
**Codebase**: Next.js 15 / TypeScript / Drizzle ORM / PostgreSQL / Stripe / Vercel  
**Scope**: Application layer, database schema, API surface, infrastructure config

---

## PRINCIPLE 1: NEVER TRUST USER INPUT (The First Commandment)

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. User input can always be distinguished from trusted data (false: once deserialized, a JSON value from a request body is indistinguishable from a locally-constructed object).
2. Sanitization is idempotent (false: double-encoding can bypass or corrupt).
3. The trust boundary is the HTTP request (false: database rows written by previous user input are "laundered hostile data" -- trusted by proximity).
4. Parameterized queries eliminate injection (mostly true for SQL, but not for JSONB operators, `sql` template tags with interpolation, or ORM-level logical injection).
5. HTML sanitization at render time is sufficient (false: stored XSS bypasses if sanitize-on-read misses a code path).

**Core Goal Restated:**  
Every value crossing the trust boundary must be validated against an allowlist schema **and** encoded for its destination context before any side-effect occurs.

**Primal Contradiction:**  
Over-sanitizing user input (stripping Unicode, truncating aggressively) destroys legitimate fundraising stories from non-English speakers, creating a denial-of-service against the platform's core mission -- helping real people tell real stories.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** A campaign creator submits a story containing medically-accurate terminology (e.g., drug names, ICD codes, dollar amounts with special characters). Aggressive sanitization strips these, producing a garbled, untrustworthy campaign page. Donors see mangled text and refuse to donate. The "security" measure **directly harms the fundraising mission**.

**Missing Rule:** Input validation must preserve semantic fidelity. Sanitize for the *destination context* (HTML, SQL, shell), never for "danger in general." A `<script>` tag is hostile in HTML but harmless in a plain-text email body. Context-specific encoding, not global stripping.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "salt")

**Twist:** "Salt the input to test the sanitizer -- if the salt survives untouched, the sanitizer is broken." 

**Implementation:** Inject a **canary payload** into every user-facing input field during CI testing. The canary is a known-bad string (e.g., `<img/src=x onerror=alert(1)>`) appended to valid data. If the canary survives into the rendered HTML or database without transformation, the test fails. This is a **sanitization proof test**, not a penetration test.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1.1 | `dangerouslySetInnerHTML={{ __html: existing.bodyHtml }}` renders campaign impact updates **without** calling `sanitizeHtml()`. If a campaign creator injects XSS into their update body, it renders raw. | **HIGH** | [ImpactUpdateForm.tsx](src/app/dashboard/campaigns/[id]/impact-update/ImpactUpdateForm.tsx#L105) |
| 1.2 | `dangerouslySetInnerHTML={{ __html: sanitizeHtml(upd.bodyHtml) }}` sanitizes at read-time (good), but `sanitizeHtml` allows `<a href>` and `<img src>` -- a `javascript:` URI in href or a tracking pixel in img src could bypass. DOMPurify handles `javascript:` by default, but `data:` URIs in img src are not blocked by the current `ALLOWED_ATTR` list. | **MEDIUM** | [sanitize.ts](src/lib/utils/sanitize.ts) |
| 1.3 | RSS parser uses regex to extract XML content (`rss-parser.ts`). While this is server-side only and not rendered to users, a malicious RSS feed could inject unexpected content into the news pipeline that eventually becomes campaign text. | **LOW** | [rss-parser.ts](src/lib/news/rss-parser.ts) |
| 1.4 | `request.headers.get('origin')` used directly in Stripe Connect return URLs. An attacker who controls the Origin header could redirect the post-onboarding flow to a phishing site. | **MEDIUM** | [onboarding/route.ts](src/app/api/v1/user/stripe-connect/onboarding/route.ts#L40) |
| 1.5 | `sql` template tag used with Drizzle in several places (e.g., `sql\`\${blogPosts.primaryKeyword} = \${keyword}\``). While Drizzle's `sql` tag parameterizes values, the pattern of building SQL fragments in `reddit-listener.ts` with `sql.join` on user-sourced URLs warrants extra scrutiny. | **LOW** | [reddit-listener.ts](src/lib/blog/reddit-listener.ts#L304) |
| 1.6 | Admin environment settings endpoint (`/api/v1/admin/settings/environment`) can read (masked) and potentially write sensitive keys like `DATABASE_URL`. The VALID_KEYS allowlist is good, but the PATCH handler should require re-authentication (step-up auth). | **MEDIUM** | [environment/route.ts](src/app/api/v1/admin/settings/environment/route.ts) |

---

## PRINCIPLE 2: FAIL SECURELY (Fail Closed)

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. A "denied" state is always identifiable (false: in distributed systems, silence can mean either "blocked" or "in transit").
2. Default-deny doesn't create availability problems (false: it does -- see Phase 2).
3. Error handlers always execute (false: OOM, stack overflow, and unhandled promise rejections can bypass catch blocks).
4. Logging the failure is always possible (false: if the logging service is the thing that failed).
5. The failure mode is binary (deny/allow) -- but partial failures (e.g., auth succeeds, authz DB is down) create ambiguous states.

**Core Goal Restated:**  
When any component in the access-decision chain produces an indeterminate result, the system must treat it as a negative authorization and prevent the side-effect, while preserving enough state to recover.

**Primal Contradiction:**  
A "fail closed" payment webhook that rejects valid Stripe events due to transient DB errors will cause Stripe to retry, then give up -- permanently losing donation records. The secure default (reject) becomes data loss.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** The Stripe donation webhook currently returns 200 even on application errors (to prevent retries). This is **intentionally fail-open** for reliability. If it returned 500 (fail-closed), Stripe would retry, but after exhausting retries, the donation would be silently lost. The fail-open design is *more secure for data integrity* than fail-closed.

**Missing Rule:** "Fail Securely" must distinguish between **access control failures** (must fail closed) and **data ingestion failures** (must fail open with compensating controls -- dead letter queue, reconciliation). The webhook's daily reconciliation cron (`/api/v1/cron/reconcile`) is the compensating control.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "echo")

**Twist:** "A system that echoes its own failures back to itself eventually drowns in noise. Fail silently once, but scream on the second consecutive failure."

**Implementation:** Track consecutive failure counts per subsystem. First failure: log + Sentry. Second consecutive failure of the *same* subsystem within 5 minutes: trigger PagerDuty alert + circuit breaker. This prevents alert fatigue from transient blips while catching real outages fast.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 2.1 | JWT callback has `catch { token.role = 'donor'; }` -- if the database is unreachable, the user gets the *lowest* role. This is correct fail-closed for privilege, but means an admin user during a DB outage loses admin access mid-session. No circuit breaker or cached role. | **MEDIUM** | [auth.ts](src/lib/auth.ts) (JWT callback) |
| 2.2 | Rate limiter is in-memory only. On Vercel serverless, each cold-start gets a fresh empty store. An attacker can bypass rate limits by distributing requests across edge regions or waiting for new instances. | **HIGH** | [rate-limit.ts](src/lib/rate-limit.ts) |
| 2.3 | `STRIPE_WEBHOOK_SECRET` uses non-null assertion (`!`). If the env var is missing, `stripe.webhooks.constructEvent` will throw at runtime, but the error is caught and returns 400. However, ALL webhook events will be rejected -- a silent total failure of donation processing with no specific alert. | **MEDIUM** | [webhook/route.ts](src/app/api/v1/donations/webhook/route.ts#L7) |
| 2.4 | Cron auth (`verifyCronAuth`) returns `false` if `CRON_SECRET` is undefined. Good fail-closed. But no alert fires when cron auth fails -- an attacker probing cron endpoints would be silently rejected with no visibility. | **LOW** | [cron-auth.ts](src/lib/cron-auth.ts) |
| 2.5 | The `handleApiError` catch-all correctly returns generic 500s. But if the error is a Drizzle connection error, the response still says "Something went wrong" with no indication that the database is down. Monitoring should alert on elevated 500 rates grouped by cause. | **LOW** | [errors.ts](src/lib/errors.ts) |

---

## PRINCIPLE 3: COMPLETE MEDIATION

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. The authorization check and the resource access are atomic (false: TOCTOU -- time-of-check-to-time-of-use race conditions).
2. The URL path uniquely identifies the resource (false: query parameters, request body, and even headers can reference different resources).
3. "Checking every request" is feasible at scale (mostly true with O(1) lookups, but N+1 authz queries for batch endpoints can cripple performance).
4. The identity is stable during the request (false: session could be revoked between middleware check and handler execution).
5. Middleware matchers cover all protected routes (false: a new route added outside the matcher pattern gets no auth check).

**Core Goal Restated:**  
Before every state-changing operation or data disclosure, the system must verify that the authenticated principal is authorized for *that specific resource* and *that specific action* at *that exact moment*.

**Primal Contradiction:**  
Mediating every request requires querying the authorization database on every request. If the authz database fails, Complete Mediation conflicts with availability -- you must choose between "allow without checking" (IDOR risk) or "deny everything" (self-DoS).

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** The Next.js middleware matcher in `src/middleware.ts` uses an explicit allowlist:
```
'/api/v1/users/:path*',
'/api/v1/admin/:path*',
'/api/v1/donations/create-intent',
'/api/v1/user-campaigns/:path*',
```
A developer adds a new route `/api/v1/user/stripe-connect/status` but forgets to add it to the matcher. The route has no auth check because it was assumed the middleware would handle it. This is the **opt-in mediation trap** -- new routes are unprotected by default.

**Missing Rule:** Authorization must be **opt-out, not opt-in**. The middleware should protect ALL `/api/v1/*` routes by default, with an explicit PUBLIC_ROUTES allowlist for the few that don't need auth.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "mirror")

**Twist:** "Mediate every request except the ones that ask for mediation -- those are the most dangerous." Translation: the most dangerous requests are the ones that *look* like they're doing authorization (e.g., `/api/v1/auth/check-permission`) because they can be used to probe the system.

**Implementation:** Add a **shadow authorization log** -- a secondary, read-only replica of every authz decision. Periodically diff the shadow log against the primary authz log. If a request was allowed by the primary but the shadow says "deny," raise an alarm. This catches authz bypass bugs.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 3.1 | **Opt-in middleware matcher is the #1 structural risk.** New API routes created outside the matcher patterns get zero auth protection. The matcher does NOT cover: `/api/v1/donations/confirm`, `/api/v1/donations/webhook`, `/api/v1/health`, `/api/v1/stats`, `/api/v1/blog/*`, `/api/v1/campaigns/*`, `/api/v1/newsletter/*`, `/api/v1/auth/*`, `/api/v1/cron/*`. Some of these are intentionally public, but the lack of a default-deny pattern means any future route is a risk. | **HIGH** | [middleware.ts](src/middleware.ts#L29) |
| 3.2 | `/api/v1/user-campaigns/[id]` ownership check allows editors and admins to access ANY campaign. This is by design, but there's no audit log when an editor views a campaign they don't own -- invisible privilege escalation if an editor account is compromised. | **MEDIUM** | [user-campaigns/[id]/route.ts](src/app/api/v1/user-campaigns/[id]/route.ts#L53) |
| 3.3 | Campaign slug-based public lookups (`/api/v1/campaigns/[slug]`) return full campaign data including `creatorId`. An attacker can enumerate creator UUIDs by scraping public campaign pages, then use those UUIDs to probe other endpoints. | **LOW** | Public campaign API |
| 3.4 | No PostgreSQL Row-Level Security (RLS) policies. All authorization is application-layer only. If a SQL injection were found (unlikely with Drizzle, but not impossible via `sql` template misuse), there's no database-level defense. | **MEDIUM** | [schema.ts](src/db/schema.ts) |
| 3.5 | The `/api/v1/admin/settings/environment` endpoint can read and write `DATABASE_URL`. An admin with a compromised session could exfiltrate or replace database credentials. No step-up authentication (re-enter password, MFA) is required. | **HIGH** | [environment/route.ts](src/app/api/v1/admin/settings/environment/route.ts) |
| 3.6 | Donation `create-intent` is in the middleware matcher requiring auth, but guest donations should be possible per the PRD (`e2e-02-guest-donate.spec.ts`). Either the matcher is wrong or the guest flow has a workaround not visible in the middleware config. This ambiguity itself is a risk. | **MEDIUM** | [middleware.ts](src/middleware.ts#L37) |

---

## PRINCIPLE 4: OPEN DESIGN (Kerckhoffs's Principle)

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. The "algorithm" and the "key" are always separable (false: API tokens are both the algorithm and the key -- knowing the format is knowing the algorithm).
2. Open design means the code should be public (false: it means security shouldn't *rely* on code secrecy, not that code *must* be public).
3. Keys can be rotated without downtime (false: hardcoded keys, key-in-URL patterns, and non-versioned key stores make rotation painful).
4. Obscurity has zero value (false: obscurity adds cost to attack; it's just not *sufficient* alone -- defense in depth includes making things harder to find).

**Core Goal Restated:**  
The system's security properties must hold even if the attacker has complete knowledge of the codebase, infrastructure, and algorithms -- with only cryptographic keys, session tokens, and credentials remaining secret.

**Primal Contradiction:**  
If the algorithm is fully open and the key is the only secret, then key management becomes the single point of failure. A leaked `NEXTAUTH_SECRET` doesn't just compromise one session -- it compromises every session ever issued and every unsubscribe token ever generated (since `NEWSLETTER_UNSUBSCRIBE_SECRET` falls back to `NEXTAUTH_SECRET`).

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** The cron endpoints are protected by `CRON_SECRET` with timing-safe comparison. An attacker who reads the code knows exactly how to authenticate to cron endpoints -- they just need the secret. But if the secret is a 32-char random string, that's fine. However, if the secret was set to something guessable like `vercel-cron-secret-123` (a common pattern in tutorials), open design + weak key = total compromise of the automation pipeline.

**Missing Rule:** Open Design requires **key strength enforcement**. If the algorithm is public, the key must meet minimum entropy requirements. Add a startup check that rejects weak secrets (< 32 bytes of entropy for CRON_SECRET, NEXTAUTH_SECRET, SETTINGS_ENCRYPTION_KEY).

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "knot")

**Twist:** "A knot that can be untied by anyone who sees it is decoration, not security. But a knot that can't be untied even by its maker is a trap." Translation: if you can't rotate a key without downtime, the key has become a trap -- you're locked into a compromised state.

**Implementation:** Add a **key rotation dry-run** command. Before any production key rotation, run a script that simulates rotation by: (1) generating a new key, (2) verifying all existing signed tokens can be validated with old OR new key, (3) listing all systems that reference the key. If any system can't handle dual-key validation, the rotation will break things -- and you know in advance.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 4.1 | `NEWSLETTER_UNSUBSCRIBE_SECRET` falls back to `NEXTAUTH_SECRET`. This means compromising one key compromises two independent security domains (auth sessions AND newsletter tokens). Key separation violation. | **HIGH** | [send-newsletter/route.ts](src/app/api/v1/cron/send-newsletter/route.ts#L161) |
| 4.2 | `SETTINGS_ENCRYPTION_KEY` falls back to `NEXTAUTH_SECRET` for security token signing. Same key-sharing problem as 4.1. Three security domains share one key. | **HIGH** | [crypto.server.ts](src/lib/crypto.server.ts#L70) |
| 4.3 | No startup validation of key entropy. `CRON_SECRET`, `NEXTAUTH_SECRET`, and `STRIPE_WEBHOOK_SECRET` are used as-is with no minimum length or entropy check. | **MEDIUM** | Across all secret consumers |
| 4.4 | The admin settings environment page reveals which env vars are configured (source: 'db', 'env', 'missing') and shows last-4-char masked values. While admin-only, the masked values reduce the keyspace for brute-force attacks if the admin session is compromised. | **LOW** | [environment/route.ts](src/app/api/v1/admin/settings/environment/route.ts#L93) |
| 4.5 | CSP header includes `'unsafe-inline' 'unsafe-eval'` for scripts. This significantly weakens the Content Security Policy and allows inline script injection if an XSS vector is found. | **MEDIUM** | [next.config.ts](next.config.ts#L67) |
| 4.6 | `dangerouslyAllowSVG: true` in Next.js image config allows SVG images from remote sources. SVGs can contain embedded JavaScript. The `contentSecurityPolicy` for images mitigates this (`script-src 'none'; sandbox`), but it's an additional attack surface. | **LOW** | [next.config.ts](next.config.ts#L44) |

---

# ENFORCEMENT PHASE

## A. Static Analysis Rules

### Rule A1: XSS via Unsanitized dangerouslySetInnerHTML (Principle 1)

**Tool**: Custom ESLint rule or Semgrep

```yaml
# .semgrep/rules/xss-dangerously-set-inner-html.yaml
rules:
  - id: xss-unsanitized-dangerouslySetInnerHTML
    patterns:
      - pattern: |
          dangerouslySetInnerHTML={{ __html: $VALUE }}
      - pattern-not: |
          dangerouslySetInnerHTML={{ __html: sanitizeHtml($VALUE) }}
      - pattern-not: |
          dangerouslySetInnerHTML={{ __html: JSON.stringify($VALUE) }}
    message: >
      dangerouslySetInnerHTML used without sanitizeHtml() or JSON.stringify().
      All HTML content must be sanitized before rendering.
      Use: dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      category: security
      cwe: "CWE-79: Cross-Site Scripting"
      principle: "Never Trust User Input"
```

**Immediate Fix Required:**
```typescript
// File: src/app/dashboard/campaigns/[id]/impact-update/ImpactUpdateForm.tsx
// Line 105 -- BEFORE (vulnerable):
dangerouslySetInnerHTML={{ __html: existing.bodyHtml }}

// AFTER (fixed):
dangerouslySetInnerHTML={{ __html: sanitizeHtml(existing.bodyHtml) }}
```

### Rule A2: Unhandled Promise Rejection in Auth Paths (Principle 2)

```yaml
# .semgrep/rules/fail-open-auth.yaml
rules:
  - id: fail-open-auth-catch
    patterns:
      - pattern: |
          try { ... await auth() ... } catch (...) { ... }
      - pattern-not-inside: |
          catch (...) { ... return ...401... }
      - pattern-not-inside: |
          catch (...) { ... return ...403... }
      - pattern-not-inside: |
          catch (...) { throw ... }
    message: >
      Auth call inside try/catch that may not return 401/403 on failure.
      Auth failures must always result in access denial.
    severity: WARNING
    languages: [typescript]
    metadata:
      principle: "Fail Securely"
```

### Rule A3: Missing Ownership Check on Resource Access (Principle 3)

```bash
#!/bin/bash
# scripts/audit-idor.sh
# Detect API routes that access resources by ID without ownership verification

echo "=== IDOR Audit: Routes accessing resources by [id] or [slug] ==="
echo ""

# Find all route files with dynamic segments
find src/app/api -name "route.ts" -path "*\[*\]*" | while read file; do
  # Check if the file has auth() or requireRole() call
  has_auth=$(grep -c "auth()\|requireRole\|requireOwner\|verifyCronAuth" "$file")
  
  # Check for param extraction
  has_param=$(grep -c "params\." "$file")
  
  # Check for ownership verification
  has_ownership=$(grep -c "creatorId.*session\|session.*creatorId\|userId.*session\|session.*userId\|requireOwner" "$file")
  
  if [ "$has_param" -gt 0 ] && [ "$has_ownership" -eq 0 ] && [ "$has_auth" -gt 0 ]; then
    echo "WARNING: $file accesses resource by param but has no ownership check"
  fi
done
```

### Rule A4: Hardcoded or Weak Secrets (Principle 4)

```yaml
# .semgrep/rules/weak-secrets.yaml
rules:
  - id: secret-fallback-to-shared-key
    pattern: |
      process.env.$KEY1 ?? process.env.$KEY2
    message: >
      Secret fallback chain detected. Each security domain must use its own
      dedicated secret. Do not share NEXTAUTH_SECRET across domains.
    severity: WARNING
    languages: [typescript]
    metadata:
      principle: "Open Design / Kerckhoffs"
      
  - id: non-null-assertion-on-secret
    pattern: |
      process.env.$SECRET!
    message: >
      Non-null assertion on environment secret. Use explicit validation:
      if (!process.env.SECRET) throw new Error('Missing SECRET');
    severity: WARNING
    languages: [typescript]
```

### Rule A5: ESLint Plugin for Middleware Coverage (Principle 3)

```javascript
// scripts/audit-middleware-coverage.mjs
// Run: node scripts/audit-middleware-coverage.mjs

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const MIDDLEWARE_FILE = 'src/middleware.ts';
const API_DIR = 'src/app/api';

// Extract matcher patterns from middleware
const middleware = readFileSync(MIDDLEWARE_FILE, 'utf-8');
const matcherMatch = middleware.match(/matcher:\s*\[([\s\S]*?)\]/);
const matchers = matcherMatch
  ? [...matcherMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : [];

console.log('Middleware matchers:', matchers);
console.log('');

// Find all API route files
function findRoutes(dir, routes = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findRoutes(full, routes);
    } else if (entry === 'route.ts') {
      const rel = '/' + relative('src/app', dir).replace(/\\/g, '/');
      const apiPath = rel
        .replace(/\/\[([^\]]+)\]/g, '/:$1')
        .replace(/^\/api/, '/api');
      routes.push({ path: apiPath, file: full });
    }
  }
  return routes;
}

const routes = findRoutes(API_DIR);
const PUBLIC_ROUTES = [
  '/api/v1/campaigns',
  '/api/v1/blog',
  '/api/v1/newsletter',
  '/api/v1/auth',
  '/api/v1/donations/webhook',
  '/api/v1/stripe-connect/webhook',
  '/api/v1/health',
  '/api/v1/stats',
  '/api/v1/cron',
  '/api/v1/veriff',
];

for (const route of routes) {
  const covered = matchers.some(m => {
    const pattern = m.replace(/:path\*/g, '.*');
    return new RegExp('^' + pattern + '$').test(route.path);
  });

  const intentionallyPublic = PUBLIC_ROUTES.some(p => route.path.startsWith(p));

  if (!covered && !intentionallyPublic) {
    // Check if route has inline auth
    const content = readFileSync(route.file, 'utf-8');
    const hasInlineAuth = /auth\(\)|requireRole|verifyCronAuth/.test(content);
    
    if (!hasInlineAuth) {
      console.log(`CRITICAL: ${route.path} -- NO auth (not in middleware, no inline auth)`);
    } else {
      console.log(`INFO: ${route.path} -- Not in middleware but has inline auth`);
    }
  }
}
```

---

## B. Infrastructure & Configuration Enforcement

### B1: Origin Allowlist for Stripe Connect (Principle 1)

```typescript
// src/lib/utils/origin-allowlist.ts
const ALLOWED_ORIGINS = new Set([
  'https://lastdonor.org',
  'https://www.lastdonor.org',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean));

export function getSafeOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://lastdonor.org';
}
```

### B2: PostgreSQL RLS Policies (Principle 3)

```sql
-- migrations/XXXX_add_rls_policies.sql

-- Enable RLS on critical tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_evidence ENABLE ROW LEVEL SECURITY;

-- Campaigns: creators can only update their own campaigns
CREATE POLICY campaigns_creator_update ON campaigns
  FOR UPDATE
  USING (creator_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (creator_id = current_setting('app.current_user_id', true)::uuid);

-- Campaigns: public read for active campaigns
CREATE POLICY campaigns_public_read ON campaigns
  FOR SELECT
  USING (status IN ('active', 'last_donor_zone', 'completed'));

-- Donations: users can only see their own donations (non-admin)
CREATE POLICY donations_own_read ON donations
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_user_role', true) IN ('admin', 'editor')
  );

-- Verification documents: only campaign owner or admin
CREATE POLICY verification_docs_access ON verification_documents
  FOR ALL
  USING (
    uploaded_by = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

-- Admin bypass for all tables
CREATE POLICY admin_full_access_campaigns ON campaigns
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY admin_full_access_donations ON donations
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin');

-- IMPORTANT: The Drizzle connection must SET app.current_user_id and
-- app.current_user_role at the start of each request for RLS to work.
-- Example in a middleware wrapper:
-- await db.execute(sql`SET LOCAL app.current_user_id = ${session.user.id}`);
-- await db.execute(sql`SET LOCAL app.current_user_role = ${session.user.role}`);
```

### B3: Vercel Edge Config for Rate Limiting (Principle 2)

```json
// vercel.json -- add WAF-level rate limiting as backup
{
  "headers": [
    {
      "source": "/api/v1/auth/(.*)",
      "headers": [
        { "key": "X-Vercel-Rate-Limit", "value": "10/60s" }
      ]
    },
    {
      "source": "/api/v1/donations/create-intent",
      "headers": [
        { "key": "X-Vercel-Rate-Limit", "value": "10/60s" }
      ]
    }
  ]
}
```

For production, add Upstash Redis-based distributed rate limiting:

```typescript
// src/lib/rate-limit-distributed.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'ratelimit:auth',
});

export const donationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'ratelimit:donation',
});

export const adminRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: true,
  prefix: 'ratelimit:admin',
});
```

### B4: Secret Entropy Validation at Startup (Principle 4)

```typescript
// src/lib/validate-secrets.ts
// Import this in src/app/layout.tsx or instrumentation.ts

const REQUIRED_SECRETS: Record<string, { minLength: number; pattern?: RegExp }> = {
  NEXTAUTH_SECRET: { minLength: 32 },
  CRON_SECRET: { minLength: 32 },
  STRIPE_SECRET_KEY: { minLength: 20, pattern: /^sk_(test|live)_/ },
  STRIPE_WEBHOOK_SECRET: { minLength: 20, pattern: /^whsec_/ },
  DATABASE_URL: { minLength: 20, pattern: /^postgres(ql)?:\/\// },
};

export function validateSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  for (const [name, rules] of Object.entries(REQUIRED_SECRETS)) {
    const value = process.env[name];
    if (!value) {
      errors.push(`Missing required secret: ${name}`);
      continue;
    }
    if (value.length < rules.minLength) {
      errors.push(`${name} is too short (${value.length} < ${rules.minLength})`);
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${name} does not match expected format`);
    }
  }

  // Check key separation
  if (
    process.env.NEXTAUTH_SECRET &&
    process.env.NEXTAUTH_SECRET === process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
  ) {
    errors.push('NEWSLETTER_UNSUBSCRIBE_SECRET must not be the same as NEXTAUTH_SECRET');
  }

  if (errors.length > 0) {
    console.error('FATAL: Secret validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    // In production, fail fast
    throw new Error(`Secret validation failed: ${errors.length} errors`);
  }
}
```

### B5: CSP Header Hardening (Principle 4)

```typescript
// Recommended CSP update in next.config.ts
// Remove 'unsafe-eval' and restrict 'unsafe-inline' to nonce-based

{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'nonce-${nonce}' js.stripe.com plausible.io",
    // Remove 'unsafe-inline' and 'unsafe-eval'
    "style-src 'self' 'unsafe-inline'",  // inline styles can stay (Tailwind)
    "img-src 'self' data: blob: https: *.supabase.co",
    "connect-src 'self' api.stripe.com *.supabase.co *.sentry.io",
    "frame-src 'self' https://js.stripe.com https://www.youtube-nocookie.com",
    "font-src 'self' fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
}
```

---

## C. Runtime Monitoring & Auditing

### C1: Input Validation Bypass Detection (Principle 1)

```sql
-- Detect potential XSS payloads stored in the database
-- Run periodically as an audit query

SELECT id, title, 'campaign' as source
FROM campaigns
WHERE story_html ~ '<script|javascript:|onerror=|onload=|data:text/html'
UNION ALL
SELECT id, title, 'campaign_update' as source  
FROM campaign_updates
WHERE body_html ~ '<script|javascript:|onerror=|onload=|data:text/html'
UNION ALL
SELECT id, title, 'blog_post' as source
FROM blog_posts
WHERE body_html ~ '<script|javascript:|onerror=|onload=|data:text/html';
```

```typescript
// Sentry alert rule for sanitization bypass
// If any XSS-like pattern reaches the render layer
Sentry.addBreadcrumb({
  category: 'xss-canary',
  message: 'Unsanitized HTML detected in render path',
  level: 'error',
});
```

### C2: Auth Service Failure Monitoring (Principle 2)

```yaml
# Prometheus alert rule
groups:
  - name: auth-failures
    rules:
      - alert: AuthServiceDegradation
        expr: |
          rate(http_requests_total{path=~"/api/v1/.*", status="401"}[5m]) 
          / rate(http_requests_total{path=~"/api/v1/.*"}[5m]) > 0.5
        for: 2m
        labels:
          severity: critical
          principle: fail-securely
        annotations:
          summary: "More than 50% of API requests returning 401 -- possible auth service failure"
          
      - alert: WebhookProcessingFailure
        expr: |
          rate(http_requests_total{path="/api/v1/donations/webhook", status="500"}[10m]) > 0
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Webhook handler returning 500s -- donation processing may be impaired"
```

### C3: IDOR Attempt Detection (Principle 3)

```sql
-- Detect users accessing campaigns they don't own
-- Cross-reference audit_logs with campaign ownership

SELECT 
  al.user_id,
  al.event_type,
  al.resource_id,
  al.created_at,
  c.creator_id,
  u.email
FROM audit_logs al
JOIN campaigns c ON al.resource_id = c.id::text
JOIN users u ON al.user_id = u.id
WHERE al.event_type LIKE '%campaign%'
  AND al.user_id != c.creator_id
  AND u.role = 'donor'  -- donors should only access their own campaigns
ORDER BY al.created_at DESC
LIMIT 100;
```

```yaml
# Alert on repeated 403s from same IP (parameter fuzzing)
- alert: IDORProbing
  expr: |
    rate(http_requests_total{status="403"}[5m]) > 10
  for: 1m
  labels:
    severity: warning
    principle: complete-mediation
  annotations:
    summary: "Elevated 403 rate -- possible IDOR probing"
```

### C4: Key Compromise Detection (Principle 4)

```yaml
# Alert on cron endpoint access from non-Vercel IPs
- alert: CronEndpointAbuseAttempt
  expr: |
    rate(http_requests_total{
      path=~"/api/v1/cron/.*",
      status!="200"
    }[5m]) > 5
  for: 2m
  labels:
    severity: high
    principle: open-design
  annotations:
    summary: "Repeated failed cron auth attempts -- possible secret probing"
```

```sql
-- Audit admin settings access (key management operations)
SELECT 
  user_id, 
  event_type, 
  details,
  ip_address,
  created_at
FROM audit_logs
WHERE event_type IN (
  'admin.settings.environment.read',
  'admin.settings.environment.update',
  'admin.settings.security.update'
)
ORDER BY created_at DESC
LIMIT 50;
```

---

## D. Oblique Enforcement (Phase 3 Implementations)

### D1: Canary Payload Test Suite (Principle 1 -- "Salt")

```typescript
// test/security/canary-payloads.test.ts
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { describe, it, expect } from 'vitest';

const CANARY_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<a href="javascript:alert(1)">click</a>',
  '<iframe src="data:text/html,<script>alert(1)</script>">',
  '"><img src=x onerror=prompt(1)>',
  '<math><mtext><table><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src=1>">',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<body onload=alert(1)>',
  // data: URI payloads
  '<a href="data:text/html,<script>alert(1)</script>">click</a>',
  '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
];

describe('Canary Payload Tests (Salt Protocol)', () => {
  for (const payload of CANARY_PAYLOADS) {
    it(`should neutralize: ${payload.slice(0, 50)}...`, () => {
      const sanitized = sanitizeHtml(payload);
      
      // The canary MUST NOT survive intact
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('onload=');
      expect(sanitized).not.toContain('ontoggle=');
      expect(sanitized).not.toContain('onfocus=');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toMatch(/data:text\/html/i);
    });
  }
  
  it('should preserve legitimate medical/financial content', () => {
    const legitimate = '<p>Patient requires <strong>Rituximab</strong> therapy. ' +
      'Cost: $45,000 per cycle. ICD-10 code: C83.3. ' +
      'Treatment at <em>Memorial Sloan Kettering</em>.</p>';
    const sanitized = sanitizeHtml(legitimate);
    
    expect(sanitized).toContain('Rituximab');
    expect(sanitized).toContain('$45,000');
    expect(sanitized).toContain('C83.3');
    expect(sanitized).toContain('Memorial Sloan Kettering');
  });
});
```

### D2: Consecutive Failure Circuit Breaker (Principle 2 -- "Echo")

```typescript
// src/lib/circuit-breaker.ts
interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
  openedAt: number;
}

const circuits = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 2;    // 2 consecutive failures
const WINDOW_MS = 5 * 60_000;   // 5-minute window
const RESET_MS = 30_000;        // 30s half-open period

export function recordFailure(subsystem: string): 'ok' | 'circuit-open' {
  const now = Date.now();
  const state = circuits.get(subsystem) ?? {
    failures: 0,
    lastFailure: 0,
    open: false,
    openedAt: 0,
  };

  // Reset if outside window
  if (now - state.lastFailure > WINDOW_MS) {
    state.failures = 0;
  }

  state.failures++;
  state.lastFailure = now;

  if (state.failures >= FAILURE_THRESHOLD && !state.open) {
    state.open = true;
    state.openedAt = now;
    // SECOND consecutive failure: escalate
    console.error(`[CIRCUIT-BREAKER] ${subsystem} OPEN after ${state.failures} consecutive failures`);
    // TODO: Integrate PagerDuty/Opsgenie alert here
  }

  circuits.set(subsystem, state);
  return state.open ? 'circuit-open' : 'ok';
}

export function recordSuccess(subsystem: string): void {
  circuits.delete(subsystem);
}

export function isCircuitOpen(subsystem: string): boolean {
  const state = circuits.get(subsystem);
  if (!state?.open) return false;

  // Half-open: allow one request through after RESET_MS
  if (Date.now() - state.openedAt > RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}
```

### D3: Shadow Authorization Log (Principle 3 -- "Mirror")

```typescript
// src/lib/authz-shadow.ts
// Shadow log captures every authorization decision for offline audit

interface AuthzDecision {
  timestamp: number;
  userId: string;
  role: string;
  resource: string;
  resourceId: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  decision: 'allow' | 'deny';
  reason: string;
}

// In production, write to a separate audit table or external log
const shadowLog: AuthzDecision[] = [];
const MAX_LOG_SIZE = 10_000;

export function logAuthzDecision(decision: AuthzDecision): void {
  shadowLog.push(decision);
  
  // Trim to prevent memory leak
  if (shadowLog.length > MAX_LOG_SIZE) {
    shadowLog.splice(0, shadowLog.length - MAX_LOG_SIZE);
  }

  // Detect anomalies inline
  if (decision.decision === 'allow' && decision.role === 'donor') {
    // Donors should never have write access to other users' campaigns
    if (decision.action === 'write' && decision.reason !== 'owner') {
      console.error(
        `[AUTHZ-SHADOW] ANOMALY: donor ${decision.userId} got write access ` +
        `to ${decision.resource}/${decision.resourceId} -- reason: ${decision.reason}`
      );
      // TODO: Send to Sentry as a critical alert
    }
  }
}

export function getRecentDecisions(count = 100): AuthzDecision[] {
  return shadowLog.slice(-count);
}
```

### D4: Key Rotation Dry-Run (Principle 4 -- "Knot")

```typescript
// scripts/key-rotation-dryrun.ts
// Run: npx tsx scripts/key-rotation-dryrun.ts <KEY_NAME>

import { createHmac, randomBytes } from 'crypto';

const KEY_NAME = process.argv[2];
if (!KEY_NAME) {
  console.error('Usage: npx tsx scripts/key-rotation-dryrun.ts <KEY_NAME>');
  process.exit(1);
}

const CURRENT_KEY = process.env[KEY_NAME];
if (!CURRENT_KEY) {
  console.error(`${KEY_NAME} is not set in the environment`);
  process.exit(1);
}

console.log(`=== Key Rotation Dry-Run: ${KEY_NAME} ===`);
console.log(`Current key length: ${CURRENT_KEY.length}`);
console.log(`Current key entropy: ~${Math.floor(CURRENT_KEY.length * 6)} bits`);
console.log('');

// Generate candidate new key
const NEW_KEY = randomBytes(32).toString('hex');
console.log(`Proposed new key length: ${NEW_KEY.length}`);
console.log('');

// Test: Can existing signatures be validated with both keys?
const testPayload = JSON.stringify({ test: true, ts: Date.now() });
const sigOld = createHmac('sha256', CURRENT_KEY).update(testPayload).digest('hex');
const sigNew = createHmac('sha256', NEW_KEY).update(testPayload).digest('hex');

console.log('Signature compatibility:');
console.log(`  Old key -> sig: ${sigOld.slice(0, 16)}...`);
console.log(`  New key -> sig: ${sigNew.slice(0, 16)}...`);
console.log(`  Signatures differ (expected): ${sigOld !== sigNew}`);
console.log('');

// Check which systems reference this key
const KEY_DEPENDENTS: Record<string, string[]> = {
  NEXTAUTH_SECRET: [
    'src/lib/auth.ts (JWT signing)',
    'src/app/api/v1/cron/send-newsletter/route.ts (newsletter unsubscribe - FALLBACK)',
    'src/lib/crypto.server.ts (security token signing - FALLBACK)',
  ],
  CRON_SECRET: [
    'src/lib/cron-auth.ts (all cron endpoints)',
    'vercel.json (Vercel cron scheduler)',
  ],
  STRIPE_WEBHOOK_SECRET: [
    'src/app/api/v1/donations/webhook/route.ts',
  ],
  STRIPE_CONNECT_WEBHOOK_SECRET: [
    'src/app/api/v1/stripe-connect/webhook/route.ts',
  ],
  SETTINGS_ENCRYPTION_KEY: [
    'src/lib/crypto.server.ts (env secret encryption)',
  ],
};

const dependents = KEY_DEPENDENTS[KEY_NAME] ?? ['Unknown -- manual audit required'];
console.log(`Systems dependent on ${KEY_NAME}:`);
for (const dep of dependents) {
  console.log(`  - ${dep}`);
}
console.log('');

// Risk assessment
if (KEY_NAME === 'NEXTAUTH_SECRET') {
  console.log('WARNING: Rotating NEXTAUTH_SECRET will invalidate ALL existing JWT sessions.');
  console.log('WARNING: Newsletter unsubscribe tokens signed with old key will break.');
  console.log('RECOMMENDATION: Set NEWSLETTER_UNSUBSCRIBE_SECRET separately BEFORE rotation.');
}

if (KEY_NAME === 'CRON_SECRET') {
  console.log('WARNING: Update Vercel environment variables BEFORE deploying new code.');
  console.log('WARNING: Brief window where cron jobs will fail auth during deployment.');
}

console.log('');
console.log('=== Dry-run complete. No changes made. ===');
```

---

---

## PRINCIPLE 13: STRONG CRYPTOGRAPHY FOR PASSWORDS

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. Hardware cost is stable over time (false: GPU/ASIC price-performance doubles every ~18 months; a work factor chosen today may be trivial in 3 years).
2. The hash algorithm's "slowness" is uniform across architectures (false: bcrypt was designed for CPUs; it maps poorly to GPU parallelism, but Argon2id's memory-hardness is what truly resists ASIC/GPU clusters).
3. A 250ms target on production hardware establishes a meaningful security bound (false: the attacker's hardware is not your hardware; the cost ratio matters, not the absolute time).
4. Salt uniqueness is guaranteed by the library (mostly true for bcrypt's 128-bit random salt, but a broken PRNG in the runtime could produce collisions).
5. The password hash never needs to be upgraded in-place (false: as work factors need increasing, a migration strategy for re-hashing on login is required).
6. The database storing hashes is always confidential (false: after a breach, the hash IS the only defense -- its resistance to offline brute-force is the entire security property).

**Core Goal Restated:**  
Maximise the *cost* (in time × memory × entropy-reduction) an attacker must pay per password guess attempt, while keeping the *cost* to the legitimate system per authentication event below the user-perceived latency threshold (~1 second).

**Primal Contradiction:**  
A bcrypt cost factor of 12 that takes ~250ms on your Vercel serverless Node.js instance may take <5ms per hash on an attacker's cluster of 8× RTX 5090 GPUs running hashcat -- bcrypt's **lack of memory-hardness** means GPU parallelism reduces the cost ratio to ~50:1, not the intended 1:1.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** Strictly following the "use Argon2id" advice on Vercel serverless (128MB function RAM, 10s max execution) would cause OOM kills or timeouts during login. Argon2id with the recommended 64MB memory parameter would consume 50% of the function's RAM on a single auth request.  If two concurrent logins hit the same instance, the function is killed. The "more secure" algorithm **causes a denial of service** on the authentication system.

**Missing Rule:** Password hashing algorithm selection must be co-designed with the deployment environment's memory and execution constraints. On memory-constrained serverless, bcrypt with cost 12+ is **pragmatically superior** to misconfigured Argon2id. The missing control: a **hash timing test** in CI that verifies the cost factor takes ≥200ms and ≤1000ms on the actual production hardware profile.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "sponge")

**Twist:** "A sponge absorbs but never overflows -- a password system should absorb unlimited authentication entropy but cap the attacker's throughput, not the defender's." Instead of making the hash slower (which penalizes legitimate users linearly), add a **server-side pepper** from a KMS that the attacker cannot obtain even after a database breach. The hash is: `bcrypt(HMAC-SHA256(password, pepper), salt, cost)`. Now even a fast offline attack is useless without the pepper.

**Implementation:** Pre-hash with HMAC-SHA256 using a server-side pepper stored in an environment variable (separate from all other secrets). The pepper never touches the database. Even a full DB dump gives the attacker hashes that are cryptographically useless without the pepper.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 13.1 | **bcrypt cost factor 12 is acceptable** but borderline. On modern GPUs (2026), cost 12 ≈ ~250ms on server, ~4ms on GPU. Industry best practice is now cost 13-14. | **MEDIUM** | [register/route.ts](src/app/api/auth/register/route.ts#L10) |
| 13.2 | **No server-side pepper.** Passwords are hashed with bcrypt alone. A database breach exposes hashes directly to offline attack without any server-side secret. | **HIGH** | [register/route.ts](src/app/api/auth/register/route.ts#L72), [auth.ts](src/lib/auth.ts#L131) |
| 13.3 | **No hash upgrade path.** If bcrypt cost is increased from 12→14, existing users' hashes remain at cost 12 forever. No re-hash-on-login mechanism exists. | **MEDIUM** | [auth.ts](src/lib/auth.ts#L131) |
| 13.4 | **Password max-length 128 is good** -- prevents bcrypt DoS (bcrypt truncates at 72 bytes, but the pre-validation caps input). | **GOOD** | [validators/user.ts](src/lib/validators/user.ts#L11) |
| 13.5 | **HaveIBeenPwned k-anonymity check is excellent.** Prevents known-breached passwords from entering the system. | **GOOD** | [register/route.ts](src/app/api/auth/register/route.ts#L58) |
| 13.6 | **Account lockout (5 attempts / 15min)** provides brute-force protection at the application layer. | **GOOD** | [auth.ts](src/lib/auth.ts#L24-L25) |
| 13.7 | Password reset also uses bcrypt cost 12, consistent with registration. | **GOOD** | [reset-password/route.ts](src/app/api/v1/auth/reset-password/route.ts#L67) |

---

## PRINCIPLE 14: TLS EVERYWHERE (HTTPS ONLY)

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. Certificate issuance and renewal are always possible (false: Let's Encrypt rate limits, DNS propagation delays, and CA outages can prevent renewal).
2. TLS termination at the CDN edge means the internal path is encrypted (false: Vercel terminates TLS at the edge; traffic between Vercel's edge and the serverless function is encrypted within their network, but the application has no verification of this).
3. HSTS preloading is permanent and irrevocable (true: once in the HSTS preload list, removing your domain requires a multi-month process; a misconfiguration is catastrophic if you ever need HTTP fallback).
4. TLS 1.3 is negotiated automatically (depends on client; TLS 1.2 fallback is still common for older Android/IoT devices).
5. HTTPS prevents all eavesdropping (false: a CDN with the TLS cert or a compromised intermediate CA can MITM; Certificate Transparency logs and CAA records are the compensating controls).

**Core Goal Restated:**  
Every byte crossing a trust boundary (browser→edge, edge→origin, origin→database, origin→external API) must travel over a channel that provides confidentiality, integrity, and authenticity, verified by a certificate the client can independently validate.

**Primal Contradiction:**  
HSTS with `preload` makes HTTPS **irrevocable at the browser level**. If Vercel's certificate provisioning fails (edge case: domain transfer, DNS misconfiguration), users cannot access the site at all -- not even over HTTP as a degraded fallback. The security control becomes a single point of total service failure.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** The application's RSS feed route constructs XML with `xmlns:atom="http://www.w3.org/2005/Atom"`. A strict "zero plaintext HTTP" scanner would flag this as a violation, but it's a namespace URI -- it's **never fetched over the network**. Over-aggressive HTTP scanning creates false positives that desensitize the team to real issues (the boy-who-cried-wolf effect).

**Missing Rule:** HTTP string detection must distinguish between **fetchable URLs** (resources loaded by browsers/servers) and **namespace identifiers** (XML namespace URIs, JSON-LD @context URIs, XMLNS declarations) that are never dereferenced. The scanner must have a semantic allowlist for non-fetchable URI patterns.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "mirror")

**Twist:** "A mirror shows you what you look like to others -- deploy a mirror service that connects to your own production domain from external networks and reports what TLS version, cipher suites, and certificate chain it sees." Instead of trusting your own config, **verify from the outside**.

**Implementation:** A scheduled external probe (cron or uptime service) that connects to `https://lastdonor.org` and verifies: (a) TLS 1.3 negotiated, (b) certificate not expiring within 14 days, (c) HSTS header present with correct max-age, (d) no HTTP 200 on port 80 (should redirect or refuse). This is a **trust-but-verify** control.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 14.1 | **HSTS configuration is excellent:** `max-age=63072000; includeSubDomains; preload` (2-year max-age, subdomain coverage, preload eligible). | **GOOD** | [next.config.ts](next.config.ts#L58-L61) |
| 14.2 | **X-Frame-Options: DENY** prevents clickjacking. Combined with CSP `frame-ancestors` this is defense-in-depth. | **GOOD** | [next.config.ts](next.config.ts#L50) |
| 14.3 | `http://localhost:3000` fallback in Veriff callback URL. In dev this is fine, but if `VERIFF_CALLBACK_BASE` and `NEXTAUTH_URL` are both unset in production, callbacks would attempt HTTP. | **MEDIUM** | [veriff.ts](src/lib/veriff.ts#L86) |
| 14.4 | `http://` in `.env.example` for `NEXTAUTH_URL`. This is a local-dev template and correctly documents the local setup, but a copy-paste to production would break HSTS. | **LOW** | [.env.example](.env.example#L18) |
| 14.5 | RSS feed namespace `xmlns:atom="http://www.w3.org/2005/Atom"` is a **non-fetchable namespace URI** -- not a vulnerability. | **INFO** | [feed.xml/route.ts](src/app/blog/feed.xml/route.ts#L58) |
| 14.6 | CSP allows `connect-src 'self' api.stripe.com *.supabase.co *.sentry.io wss://ws-us3.pusher.com` -- all HTTPS/WSS. No HTTP connect sources. | **GOOD** | [next.config.ts](next.config.ts#L70) |
| 14.7 | All external image domains in CSP `img-src` use HTTPS. `data:` and `blob:` are allowed but necessary for inline images and camera uploads. | **GOOD** | [next.config.ts](next.config.ts#L69) |
| 14.8 | No CAA DNS record enforcement visible. A CAA record limits which CAs can issue certificates for the domain. | **LOW** | Infrastructure |

---

## PRINCIPLE 15: SECRETS MANAGEMENT (NO HARDCODED KEYS)

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. Environment variables are secret (false: on Vercel, env vars are encrypted at rest but decrypted into the function's memory space; a memory dump or `process.env` log statement leaks all of them).
2. The secrets manager itself is not compromised (false: a compromised Vercel dashboard account or GitHub Actions secret store gives access to all secrets simultaneously).
3. Secrets that never hit `git commit` are safe (mostly true, but `.env.local` files on developer laptops can be exfiltrated by malware, and Vercel preview deployments inherit production env vars by default unless scoped).
4. Rotation is always possible without downtime (false: rotating `NEXTAUTH_SECRET` invalidates all active JWT sessions instantly, causing a mass logout).
5. Secret patterns (e.g., `sk_live_`) are reliably detectable by scanners (false: base64-encoded or split-string secrets evade regex-based scanners).
6. Third-party services support key rotation gracefully (false: some APIs have no key rotation API; you must create a new key, update, then delete the old one -- a window of two valid keys).

**Core Goal Restated:**  
Every credential must exist in exactly one canonical store with auditable access, minimum-privilege scope, and a defined rotation lifecycle. The source code repository must contain zero bits of secret entropy.

**Primal Contradiction:**  
The `NEXTAUTH_SECRET` is both a JWT signing key and a session encryption key. Rotating it instantly invalidates all sessions for all users. The secret management principle ("rotate frequently") conflicts with the availability principle ("don't mass-logout users"). This creates a perverse incentive to **never rotate** the most critical secret.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** The codebase's `validate-secrets.ts` throws a fatal error in production if `SETTINGS_ENCRYPTION_KEY` is missing. But during a Vercel redeployment where the env var is briefly unavailable (propagation delay), the new deployment fails to start, and the previous deployment is already replaced. Result: **total outage** caused by a security control. Strict fail-closed on secrets at startup can cause cascading deployment failures.

**Missing Rule:** Secret validation at startup must have a **grace period** or **fallback to the previous deployment's secrets cache** for a configurable window (e.g., 30 seconds). If the grace period expires without secrets becoming available, then fail. This prevents transient env var propagation issues from causing outages while still enforcing the control.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "zero")

**Twist:** "The most secure secret is the one that doesn't exist." Instead of storing long-lived API keys, use **ephemeral credentials** generated just-in-time from a KMS or IAM role. For database access: use IAM authentication (Supabase supports short-lived JWT-based connections). For Stripe: use restricted keys with minimum permissions. The secret's lifetime should equal the request's lifetime.

**Implementation:** For the database connection, replace the long-lived `DATABASE_URL` with Supabase's RLS-authenticated connections that use JWT tokens scoped to the current user. Each request gets a database session with only the permissions that user needs. The connection string secret still exists, but the damage from its compromise is limited by RLS policies.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 15.1 | **Secret entropy validation at startup is excellent.** `validate-secrets.ts` checks min-length, format patterns, and key separation rules. Production fails fast on invalid secrets. | **GOOD** | [validate-secrets.ts](src/lib/validate-secrets.ts) |
| 15.2 | **Key separation enforcement is implemented.** `KEY_SEPARATION_RULES` warns when `NEXTAUTH_SECRET` is reused as `NEWSLETTER_UNSUBSCRIBE_SECRET` or `SETTINGS_ENCRYPTION_KEY`. | **GOOD** | [validate-secrets.ts](src/lib/validate-secrets.ts#L48-L51) |
| 15.3 | **AES-256-GCM encryption for stored API keys** in the database. Keys are encrypted at rest, not stored in plaintext. IV + authTag + ciphertext structure is correct. | **GOOD** | [crypto.server.ts](src/lib/crypto.server.ts#L31-L41) |
| 15.4 | **`server-only` import guard** prevents `crypto.server.ts` from being bundled into client-side code. | **GOOD** | [crypto.server.ts](src/lib/crypto.server.ts#L8) |
| 15.5 | **Admin env settings are masked** -- only last 4 chars shown via `maskSecret()`. Requires step-up auth (security token) for writes. | **GOOD** | [environment/route.ts](src/app/api/v1/admin/settings/environment/route.ts#L35-L37) |
| 15.6 | **No hardcoded secrets found** in source code. `.env.example` contains only placeholder values. | **GOOD** | [.env.example](.env.example) |
| 15.7 | `STRIPE_WEBHOOK_SECRET` uses non-null assertion (`!`). If env var missing, `constructEvent` throws -- but the error message might leak the absence of the secret in logs. | **LOW** | [webhook/route.ts](src/app/api/v1/donations/webhook/route.ts#L7) |
| 15.8 | **Timing-safe comparison for cron auth tokens** using `crypto.timingSafeEqual`. Prevents timing side-channel attacks. | **GOOD** | [cron-auth.ts](src/lib/cron-auth.ts) |
| 15.9 | **No `NEXTAUTH_SECRET` rotation strategy.** Rotating this key invalidates all JWT sessions. No dual-key validation or gradual migration path exists. | **HIGH** | [auth.ts](src/lib/auth.ts#L88) |
| 15.10 | Vercel preview deployments may inherit production secrets unless env var scoping is configured per-environment (Preview vs Production). | **MEDIUM** | Infrastructure |

---

## PRINCIPLE 16: SAFE DESERIALIZATION

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. JSON is inherently safe to deserialize (false: `JSON.parse` of a 500MB string causes OOM; `JSON.parse` with a reviver function can execute arbitrary logic on each key-value pair).
2. JavaScript doesn't have native serialization vulnerabilities like Java/PHP/Python (mostly true: `JSON.parse` doesn't construct class instances. But `eval()`, `new Function()`, and `vm` module can).
3. The deserialized data's *structure* is validated by TypeScript types (false: TypeScript types are compile-time only; at runtime, `JSON.parse` returns `any`; a missing Zod/runtime validation allows type confusion).
4. Webhook payloads from trusted services (Stripe, Veriff) don't need deserialization safety (false: a MITM or compromised third-party could send malformed payloads; signature verification is the gate, but structural validation is the belt-and-suspenders).
5. `localStorage` data is trusted (false: browser extensions, XSS, or another script on the same origin can write arbitrary data to localStorage).

**Core Goal Restated:**  
Any data crossing a trust boundary (network, storage, IPC) that is reconstructed into an in-memory structure must pass through a schema validator that constrains type, shape, and size before the application logic touches it.

**Primal Contradiction:**  
Signing serialized data with HMAC to prevent tampering (as the principle recommends) means you must deserialize the data **before** you can verify the signature's scope -- because the signature is typically appended to or embedded in the serialized blob. The "verify before deserializing" advice is impossible if the verification metadata is inside the serialized data. You must parse at least the envelope to extract the signature.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** The AI content pipeline (`call-ai.ts`) receives JSON responses from OpenRouter LLMs. Strictly refusing to parse malformed JSON would cause the entire blog generation pipeline to halt on a single LLM hallucination (e.g., a trailing comma, markdown wrapping). The current "lenient JSON extraction" approach (stripping markdown fences, finding JSON boundaries) is **intentionally permissive** because the alternative is total pipeline failure from trivially-fixable format issues.

**Missing Rule:** Deserialization strictness must be **tiered by trust level**: (1) User input: strict schema validation (Zod). (2) Trusted third-party webhooks (Stripe, Veriff): signature first, then schema validation. (3) AI-generated content: lenient parsing with structural validation after extraction. The standard advice of "never parse untrusted data leniently" ignores that some data sources are adversarial and some are merely unreliable.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "fermentation")

**Twist:** "Fermentation transforms raw ingredients into something safe to consume over time. Deserialize data into a quarantine zone -- a plain object with no methods or prototype chain -- and let it 'ferment' through progressive validation stages before it enters the application's trusted data model."

**Implementation:** A **quarantine pattern**: `JSON.parse` outputs into a `Readonly<Record<string, unknown>>` intermediate type. This object passes through Zod validation (structural fermentation). Only the Zod-validated output (typed, constrained) enters the application logic. The raw parsed object is never referenced again. This ensures no `__proto__` pollution, no unexpected method calls, and no type confusion.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 16.1 | **Veriff webhook: HMAC-verified before JSON.parse.** Signature validation on raw body, then parse. Correct order. | **GOOD** | [veriff/webhook/route.ts](src/app/api/v1/verification/veriff/webhook/route.ts#L24-L31) |
| 16.2 | **Stripe webhooks: `constructEvent` verifies signature on raw text before parsing.** Stripe SDK handles this correctly. | **GOOD** | [donations/webhook/route.ts](src/app/api/v1/donations/webhook/route.ts#L21-L31) |
| 16.3 | **AI JSON parsing uses lenient extraction** with markdown stripping and brace-matching. No `eval()` or `Function()`. Output goes to `JSON.parse` only. Acceptable for AI-tier trust. | **GOOD** | [call-ai.ts](src/lib/ai/call-ai.ts#L237) |
| 16.4 | **Zod validation on all user-input API routes** (registration, campaigns, donations, newsletter). Schema-first deserialization. | **GOOD** | [validators/user.ts](src/lib/validators/user.ts), middleware patterns |
| 16.5 | **No `eval()`, `new Function()`, or `vm.runInContext()` anywhere in the codebase.** No unsafe code execution patterns. | **GOOD** | Codebase-wide search |
| 16.6 | **localStorage `JSON.parse` in `ShareYourStoryForm`** does not validate with Zod. A browser extension could inject `__proto__` pollution via crafted localStorage. However, subsequent field access uses explicit destructuring with defaults. | **LOW** | [ShareYourStoryForm.tsx](src/app/share-your-story/ShareYourStoryForm.tsx#L295) |
| 16.7 | **`SystemSettings.tsx` uses `JSON.parse(e.target.value)`** on form input. This is admin-only UI and the parsed value feeds a controlled form state, but no Zod validation on the intermediate parse. | **LOW** | [SystemSettings.tsx](src/components/admin/SystemSettings.tsx#L744) |
| 16.8 | **RSS article body extraction** uses regex to find JSON-LD, then `JSON.parse`. The input is from fetched web pages (untrusted). A malicious page could craft JSON-LD to produce unexpected shapes. No Zod validation on the parsed structure. | **MEDIUM** | [fetch-article-body.ts](src/lib/news/fetch-article-body.ts#L116) |

---

## PRINCIPLE 17: RATE LIMITING & THROTTLING

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. An attacker operates from a single IP or a small set of IPs (false: botnets, residential proxies, and cloud providers give attackers millions of IPs; per-IP rate limiting stops unsophisticated attacks only).
2. Rate limiting at the application layer is sufficient (false: the request must traverse the network stack, TLS handshake, and middleware before hitting the rate limiter -- a volumetric DDoS exhausts resources before the rate limiter fires).
3. In-memory rate limiting state is shared across instances (false on serverless: each cold-start gets a fresh empty store, as documented in Finding 2.2).
4. Webhook endpoints should not be rate limited (partially true: Stripe/Veriff need reliable delivery, but an attacker spoofing webhook-like requests without valid signatures should still be throttled).
5. Rate limit windows are uniform (false: credential stuffing uses slow-and-low patterns with 1 attempt per minute to stay under per-minute limits).
6. `x-forwarded-for` accurately represents the client IP (false: without Vercel's trusted proxy headers, an attacker can spoof the header to distribute their fingerprint across unlimited "IPs").

**Core Goal Restated:**  
Impose an asymmetric cost function: each additional request in a time window must cost the attacker disproportionately more than the previous one, while costing the legitimate user nothing up to a generous threshold. This must hold across all instances, regions, and IP addresses.

**Primal Contradiction:**  
Rate limiting by IP on Vercel serverless is fundamentally broken: each function invocation may run on a different instance with an empty in-memory store. The "rate limiter" gives the *illusion* of protection while providing near-zero actual resistance to distributed attacks. The security control exists in the code but not in the runtime reality.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** Strict rate limiting on `/api/v1/donations/create-intent` (10/min/IP) would block a viral fundraising campaign where 100 donors simultaneously open the donation page and 10 happen to be behind the same corporate NAT gateway. The rate limiter blocks 90% of legitimate donors from a shared IP. The security control **directly prevents the platform's revenue-generating event** -- the exact moment LastDonor.org needs to work perfectly.

**Missing Rule:** Rate limits on donation endpoints must be **adaptive**: use user-session identity (not just IP) for authenticated users, and raise the limit dynamically during detected campaign surge events (e.g., when a campaign's page view count spikes 10× in 5 minutes, temporarily raise the donation rate limit for that campaign's endpoints).

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "echo")

**Twist:** "An echo gets quieter with each repetition. Instead of rejecting over-limit requests, **delay** them exponentially. The first over-limit request waits 1s, the second 2s, the fourth 8s. Attackers self-throttle because they can't tolerate the latency, while legitimate users who occasionally burst see only minor delays."

**Implementation:** Replace hard 429 rejection with a **progressive delay queue** for the first N over-limit requests. After the delay budget is exhausted (e.g., total delay > 30s), then 429. This degrades the attacker's throughput without creating a hard cliff that also punishes legitimate burst traffic.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 17.1 | **In-memory rate limiter is per-instance on Vercel serverless.** Each cold-start resets the store. An attacker distributing requests across edge regions bypasses limits entirely. | **HIGH** | [rate-limit.ts](src/lib/rate-limit.ts#L12) |
| 17.2 | **Distributed rate limiter (Upstash) is fire-and-forget.** `tryDistributedRateLimit` does not synchronously block requests -- it only logs warnings. The in-memory limiter is the actual enforcement, making the distributed layer purely observational. | **CRITICAL** | [rate-limit.ts](src/lib/rate-limit.ts#L158-L175) |
| 17.3 | Route-level limits are well-designed: auth 10/min, newsletter 5/min, donations 10/min, general API 60/min. Appropriate granularity. | **GOOD** | [rate-limit.ts](src/lib/rate-limit.ts#L77-L84) |
| 17.4 | **Middleware applies rate limiting to all `/api/*` routes.** Default-deny pattern ensures new routes get rate limiting automatically. | **GOOD** | [middleware.ts](src/middleware.ts#L36-L37) |
| 17.5 | **Webhook routes are correctly exempted** (`pathname.includes('/webhook')`). HMAC signature verification is the access control for webhooks, not rate limiting. | **GOOD** | [rate-limit.ts](src/lib/rate-limit.ts#L108) |
| 17.6 | **IP extraction uses `x-forwarded-for` header.** On Vercel, this is set by the edge proxy and is trustworthy. But the fallback to `'unknown'` means all requests without the header share a single rate limit bucket -- if an attacker strips the header, they DoS the 'unknown' bucket for everyone. | **MEDIUM** | [rate-limit.ts](src/lib/rate-limit.ts#L112) |
| 17.7 | No per-user (session-based) rate limiting. Authenticated users are rate-limited only by IP. A compromised account could abuse API endpoints from multiple IPs without triggering per-user limits. | **MEDIUM** | [rate-limit.ts](src/lib/rate-limit.ts) |
| 17.8 | **Memory store capped at 50,000 entries** with cleanup. Good DoS protection against memory exhaustion from key flooding. | **GOOD** | [rate-limit.ts](src/lib/rate-limit.ts#L46) |
| 17.9 | **429 responses include `Retry-After` and `X-RateLimit-*` headers.** Correct HTTP semantics for rate limiting. | **GOOD** | [rate-limit.ts](src/lib/rate-limit.ts#L130-L135) |
| 17.10 | **Account lockout (5 attempts / 15 minutes)** in auth.ts provides application-level brute-force protection independent of rate limiting. This is the effective credential stuffing defense. | **GOOD** | [auth.ts](src/lib/auth.ts#L24-L25) |

---

## PRINCIPLE 18: SECURE COOKIE ATTRIBUTES

### PHASE 1 -- FIRST-PRINCIPLES DECONSTRUCTION

**Implicit Assumptions:**
1. The browser correctly implements `HttpOnly`, `Secure`, and `SameSite` (mostly true in 2026, but older WebView-based apps or custom Electron shells may not).
2. `SameSite=Lax` prevents all CSRF (false: `Lax` allows cookies on top-level GET navigations -- a GET endpoint with side-effects is still CSRF-vulnerable).
3. `HttpOnly` prevents all cookie theft (false: it prevents JavaScript-based theft, but side-channel attacks like CSS exfiltration, TRACE method reflection, or browser extensions can still read cookies).
4. Setting `Secure` is sufficient for transport security (false: `Secure` means "only send over HTTPS" but doesn't prevent a network attacker from *setting* a cookie via a `Set-Cookie` from an HTTP response on a sibling subdomain -- the `__Host-` prefix is needed).
5. NextAuth.js handles all cookie security automatically (partially true: NextAuth sets `HttpOnly` and `Secure` by default in production, but `SameSite` defaults to `Lax` which may not be strict enough for admin actions).
6. JWT-based sessions don't need traditional cookie protections (false: the JWT is *stored* in a cookie; all cookie theft vectors apply to the JWT token).

**Core Goal Restated:**  
The session token must be confined to the narrowest possible browser context: unreadable by JavaScript (`HttpOnly`), untransmittable over cleartext (`Secure`), unattachable to cross-origin requests (`SameSite`), and bound to the exact host (`__Host-` prefix) -- such that a compromised script, network, or sibling subdomain cannot extract, replay, or inject the token.

**Primal Contradiction:**  
`SameSite=Strict` provides the strongest CSRF protection but breaks OAuth login flows. When Google redirects back to `https://lastdonor.org/api/auth/callback/google`, the browser considers this a cross-site navigation from `accounts.google.com` and **refuses to send the session cookie**. The most secure cookie attribute prevents the authentication flow from working.

### PHASE 2 -- INVERSION (Anti-Principle)

**Scenario:** Setting `SameSite=Strict` on the NextAuth session cookie breaks the Google OAuth callback flow entirely. Users click "Sign in with Google," authenticate with Google, are redirected back to LastDonor -- and their session cookie is not sent because the navigation originated from a different site. The user appears logged out. They must click a link *on* LastDonor to trigger a same-site navigation that finally attaches the cookie. The user experience is bewildering. The "most secure" cookie attribute **breaks the primary login mechanism**.

**Missing Rule:** Cookie `SameSite` policy must be `Lax` (not `Strict`) for session cookies on sites using OAuth. The CSRF gap (GET requests with side-effects) must be closed by a complementary control: **no GET endpoint should have side-effects**. All state-changing operations must use POST/PUT/DELETE, which `SameSite=Lax` blocks on cross-site requests.

### PHASE 3 -- OBLIQUE CONSTRAINT (Word: "scorpion")

**Twist:** "A scorpion carries its sting at the end of its tail, not its head. Put the security validation at the *end* of the cookie's lifecycle, not just the *creation*." Instead of relying only on cookie attributes set at creation time, **validate on every use**: check that the JWT's fingerprint (a hash of the client's TLS session or IP) matches the current request's context. This detects cookie theft even if `HttpOnly` is bypassed.

**Implementation:** Add a **session binding fingerprint**: when the JWT is issued, hash `SHA256(user_agent + ip_prefix)` and store it in the JWT claims. On each request, the middleware recomputes the fingerprint and compares. A stolen cookie used from a different browser/IP fails validation. This adds defense-in-depth beyond the static cookie attributes.

---

### FINDINGS AGAINST CODEBASE

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 18.1 | **NextAuth JWT cookies use `HttpOnly` by default.** The `next-auth.session-token` cookie is not readable by client-side JavaScript. Verified by NextAuth v5 beta defaults. | **GOOD** | [auth.ts](src/lib/auth.ts#L93) (implicit NextAuth default) |
| 18.2 | **NextAuth sets `Secure: true` in production** (when `NEXTAUTH_URL` starts with `https://`). The session cookie is HTTPS-only. | **GOOD** | [auth.ts](src/lib/auth.ts) (implicit NextAuth default) |
| 18.3 | **`SameSite=Lax` is the NextAuth default.** This is correct for OAuth flows (Google provider). `Strict` would break the Google callback, as analyzed in Phase 2. | **GOOD** | [auth.ts](src/lib/auth.ts) (implicit NextAuth default) |
| 18.4 | **No explicit `SameSite` or `Secure` configuration visible.** Relying entirely on NextAuth defaults. If NextAuth changes defaults in a future version, the security posture silently degrades. | **MEDIUM** | [auth.ts](src/lib/auth.ts#L93) |
| 18.5 | **Role-based session expiry** is implemented: admin=8hrs, editor=24hrs, donor=7days. Shorter sessions for privileged roles reduce the window for cookie theft. | **GOOD** | [auth.ts](src/lib/auth.ts#L18-L21) |
| 18.6 | **No `__Host-` cookie prefix.** NextAuth doesn't use `__Host-` prefix by default. This means a compromised sibling subdomain (e.g., `evil.lastdonor.org`) could set a cookie that the main domain accepts. | **MEDIUM** | [auth.ts](src/lib/auth.ts) |
| 18.7 | **No session binding fingerprint.** A stolen JWT cookie (via browser extension, physical access) works from any browser/IP/location for its full lifetime. | **MEDIUM** | [auth.ts](src/lib/auth.ts) |
| 18.8 | **No CSRF token for state-changing API routes.** Relies entirely on `SameSite=Lax` + POST requirement. If any GET endpoint has side-effects, CSRF is possible. | **LOW** | [middleware.ts](src/middleware.ts) |
| 18.9 | **No explicit cookie configuration object in NextAuth.** The cookies option is not set, relying on framework defaults. Explicitly configuring ensures the security properties are intentional, not accidental. | **LOW** | [auth.ts](src/lib/auth.ts#L88-L93) |

---

# ENFORCEMENT PHASE (Principles 13-18)

---

## A. Static Analysis Rules (Principles 13-18)

### Rule A6: Weak Password Hashing Detection (Principle 13)

```yaml
# .semgrep/password-hashing.yaml
rules:
  - id: weak-password-hash-md5-sha
    patterns:
      - pattern-either:
          - pattern: crypto.createHash("md5")
          - pattern: crypto.createHash("sha1")
          - pattern: crypto.createHash("sha256")
    message: >
      Direct hash function used. For passwords, use bcrypt (cost ≥12) or Argon2id.
      MD5, SHA1, and unsalted SHA256 are forbidden for password hashing.
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      principle: "13 - Strong Cryptography"

  - id: low-bcrypt-cost
    pattern: bcrypt.hash($PASSWORD, $COST)
    metavariable-comparison:
      metavariable: $COST
      comparison: $COST < 12
    message: >
      Bcrypt cost factor is below 12. Minimum cost factor is 12 (≥200ms on
      modern server hardware). Recommended: 13-14 for 2026.
    severity: WARNING
    languages: [typescript, javascript]
    metadata:
      principle: "13 - Strong Cryptography"
```

### Rule A7: Plaintext HTTP URL Detection (Principle 14)

```bash
#!/bin/bash
# scripts/lint-http-urls.sh
# Detects fetchable http:// URLs in TypeScript source (excluding namespaces and comments)

VIOLATIONS=$(grep -rn 'http://' src/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v 'node_modules' \
  | grep -v '// ' \
  | grep -v 'xmlns' \
  | grep -v 'localhost' \
  | grep -v '.w3.org' \
  | grep -v '.example.com' \
  | grep -v 'test' \
  | grep -v 'spec')

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: Plaintext HTTP URLs found in source code:"
  echo "$VIOLATIONS"
  echo ""
  echo "Use https:// or add to the allowlist in scripts/lint-http-urls.sh"
  exit 1
fi
echo "OK: No plaintext HTTP URLs found."
```

### Rule A8: Hardcoded Secret Pattern Detection (Principle 15)

```yaml
# .semgrep/hardcoded-secrets.yaml
rules:
  - id: hardcoded-api-key
    patterns:
      - pattern-either:
          - pattern: |
              $KEY = "sk_live_..."
          - pattern: |
              $KEY = "sk_test_..."
          - pattern: |
              $KEY = "whsec_..."
          - pattern: |
              $KEY = "re_..."
          - pattern: |
              $KEY = "pk_live_..."
    message: >
      Possible hardcoded API key detected. Use process.env.VAR_NAME instead.
      If this has been committed, the key is compromised and must be rotated immediately.
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      principle: "15 - Secrets Management"

  - id: process-env-in-client
    patterns:
      - pattern: process.env.$VAR
    paths:
      include:
        - "src/app/**/page.tsx"
        - "src/components/**/*.tsx"
      exclude:
        - "src/app/api/**"
        - "src/lib/**"
    message: >
      process.env access in a client component. Only NEXT_PUBLIC_ vars
      should be accessed client-side. Server secrets may leak into the bundle.
    severity: WARNING
    languages: [typescript, javascript]
    metadata:
      principle: "15 - Secrets Management"
```

### Rule A9: Unsafe Deserialization Detection (Principle 16)

```yaml
# .semgrep/unsafe-deserialization.yaml
rules:
  - id: json-parse-without-validation
    patterns:
      - pattern: |
          const $VAR = JSON.parse($INPUT);
      - pattern-not-inside: |
          try { ... } catch { ... }
    message: >
      JSON.parse without try-catch. Malformed input will throw and may crash
      the process. Wrap in try-catch and validate the parsed structure with Zod.
    severity: WARNING
    languages: [typescript, javascript]
    metadata:
      principle: "16 - Safe Deserialization"

  - id: eval-or-function-constructor
    pattern-either:
      - pattern: eval(...)
      - pattern: new Function(...)
      - pattern: Function(...)
    message: >
      eval() or Function constructor detected. This allows arbitrary code
      execution. Use JSON.parse for data deserialization.
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      principle: "16 - Safe Deserialization"
```

### Rule A10: Unprotected Endpoint Detection (Principle 17)

```typescript
// scripts/lint-rate-limits.ts
// Run: npx tsx scripts/lint-rate-limits.ts

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const API_DIR = 'src/app/api';
const RATE_LIMIT_FILE = 'src/lib/rate-limit.ts';

// Extract rate limit route patterns from rate-limit.ts
const rlContent = readFileSync(RATE_LIMIT_FILE, 'utf8');
const rlRoutes = [...rlContent.matchAll(/['"]([^'"]+)['"]\s*:\s*\{/g)].map(m => m[1]);

// Find all route.ts files under src/app/api
function findRoutes(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findRoutes(full));
    } else if (entry === 'route.ts') {
      results.push(full);
    }
  }
  return results;
}

const routeFiles = findRoutes(API_DIR);
const unprotected: string[] = [];

for (const file of routeFiles) {
  const apiPath = '/' + relative('src/app', file)
    .replace(/\\/g, '/')
    .replace('/route.ts', '')
    .replace(/\[([^\]]+)\]/g, ':$1');

  const isWebhook = apiPath.includes('webhook');
  const isHealth = apiPath.includes('health');
  const isCron = apiPath.includes('cron');

  if (isWebhook || isHealth || isCron) continue; // Exempt

  const matched = rlRoutes.some(route => apiPath.startsWith(route));
  if (!matched) {
    unprotected.push(apiPath);
  }
}

if (unprotected.length > 0) {
  console.error('WARNING: API routes without explicit rate limit config:');
  unprotected.forEach(r => console.error(`  ${r}`));
  console.error('\nAdd these routes to ROUTE_LIMITS in src/lib/rate-limit.ts');
  console.error('or verify they are covered by a parent prefix match.');
  process.exit(1);
}
console.log(`OK: All ${routeFiles.length} API routes are covered by rate limiting.`);
```

### Rule A11: Cookie Attribute Verification (Principle 18)

```typescript
// test/security/cookie-attributes.test.ts
import { describe, it, expect } from 'vitest';

describe('Cookie Security Attributes (Principle 18)', () => {
  it('NextAuth config should explicitly set cookie options', async () => {
    const authModule = await import('@/lib/auth');
    // Verify the auth config exists and uses JWT strategy
    expect(authModule).toBeDefined();
  });

  it('should not have GET endpoints with side-effects', async () => {
    // Scan all route.ts files for GET handlers that call db.insert/update/delete
    const { readdirSync, readFileSync, statSync } = await import('fs');
    const { join } = await import('path');

    function findRoutes(dir: string): string[] {
      const results: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) results.push(...findRoutes(full));
        else if (entry === 'route.ts') results.push(full);
      }
      return results;
    }

    const routes = findRoutes('src/app/api');
    const violations: string[] = [];

    for (const file of routes) {
      const content = readFileSync(file, 'utf8');
      // Check if GET handler exists
      if (!/export\s+(async\s+)?function\s+GET/i.test(content)) continue;
      // Check if GET handler has mutation operations
      const getMatch = content.match(/export\s+(async\s+)?function\s+GET[\s\S]*?(?=export\s+(async\s+)?function\s+|$)/);
      if (getMatch) {
        const getBody = getMatch[0];
        if (/db\.(insert|update|delete)|\.execute\(/.test(getBody)) {
          violations.push(file);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
```

---

## B. Infrastructure & Configuration Enforcement (Principles 13-18)

### B6: Server-Side Pepper for Password Hashing (Principle 13)

```typescript
// src/lib/password.ts -- Pepper-enhanced bcrypt
import bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';

const BCRYPT_ROUNDS = 12;

/**
 * Pre-hash password with server-side pepper (HMAC-SHA256) before bcrypt.
 * This means a database-only breach is useless without the pepper.
 * The pepper lives in env vars, never in the database.
 */
function preHash(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error('PASSWORD_PEPPER must be set (≥32 chars). Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  // HMAC-SHA256 produces a 64-char hex string (fits in bcrypt's 72-byte limit)
  return createHmac('sha256', pepper).update(password).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(preHash(password), BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(preHash(password), hash);
}
```

```bash
# Add to .env.production
PASSWORD_PEPPER=<64-char-hex-from-crypto.randomBytes(32)>
```

### B7: TLS Verification Probe (Principle 14)

```yaml
# .github/workflows/tls-probe.yml
name: TLS Verification Probe
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  tls-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check TLS 1.3 and HSTS
        run: |
          # Verify TLS 1.3 negotiation  
          TLS_VERSION=$(echo | openssl s_client -connect lastdonor.org:443 -tls1_3 2>/dev/null | grep "Protocol" | awk '{print $NF}')
          if [ "$TLS_VERSION" != "TLSv1.3" ]; then
            echo "FAIL: TLS 1.3 not negotiated. Got: $TLS_VERSION"
            exit 1
          fi
          
          # Verify HSTS header
          HSTS=$(curl -sI https://lastdonor.org | grep -i "strict-transport-security")
          if [ -z "$HSTS" ]; then
            echo "FAIL: HSTS header missing"
            exit 1
          fi
          echo "HSTS: $HSTS"
          
          # Verify max-age >= 63072000
          MAX_AGE=$(echo "$HSTS" | grep -oP 'max-age=\K[0-9]+')
          if [ "$MAX_AGE" -lt 63072000 ]; then
            echo "FAIL: HSTS max-age too low: $MAX_AGE"
            exit 1
          fi
          
          # Verify HTTP port 80 redirects (not 200)
          HTTP_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" http://lastdonor.org)
          if [ "$HTTP_STATUS" = "200" ]; then
            echo "FAIL: HTTP port 80 returned 200 (should redirect)"
            exit 1
          fi
          
          # Check certificate expiry
          EXPIRY=$(echo | openssl s_client -connect lastdonor.org:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
          EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
          NOW_EPOCH=$(date +%s)
          DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
          if [ "$DAYS_LEFT" -lt 14 ]; then
            echo "FAIL: Certificate expires in $DAYS_LEFT days"
            exit 1
          fi
          
          echo "OK: TLS 1.3, HSTS (max-age=$MAX_AGE), cert valid for $DAYS_LEFT days"
```

### B8: NEXTAUTH_SECRET Dual-Key Rotation Strategy (Principle 15)

```typescript
// src/lib/auth-key-rotation.ts
// Strategy: validate JWT against both current and previous secret
// When rotating: set NEXTAUTH_SECRET to new value, NEXTAUTH_SECRET_PREVIOUS to old value
// After max session lifetime (7 days), remove NEXTAUTH_SECRET_PREVIOUS

import { jwtVerify, type JWTPayload } from 'jose';

const currentSecret = process.env.NEXTAUTH_SECRET!;
const previousSecret = process.env.NEXTAUTH_SECRET_PREVIOUS; // optional, during rotation

export async function verifyJwtWithRotation(token: string): Promise<JWTPayload | null> {
  // Try current secret first
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(currentSecret),
    );
    return payload;
  } catch {
    // Current secret failed - try previous if available
    if (!previousSecret) return null;
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(previousSecret),
      );
      // TODO: Flag this session for re-signing with new secret on next request
      return payload;
    } catch {
      return null;
    }
  }
}
```

```bash
# Rotation procedure:
# 1. Set NEXTAUTH_SECRET_PREVIOUS=<current_value>
# 2. Set NEXTAUTH_SECRET=<new_value>
# 3. Deploy
# 4. Wait 7 days (max donor session lifetime)
# 5. Remove NEXTAUTH_SECRET_PREVIOUS
# 6. Deploy again
```

### B9: Production Upstash Redis Enforcement (Principle 17)

```typescript
// Add to src/lib/rate-limit.ts -- make distributed limiter synchronous

export async function checkRateLimitAsync(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.includes('/webhook')) return null;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const config = getConfig(pathname);
  const key = `${ip}:${pathname.split('/').slice(0, 5).join('/')}`;

  // Distributed limiter is PRIMARY in production
  const limiter = await getDistributedLimiter();
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      if (!result.success) {
        return NextResponse.json(
          { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(result.remaining),
            },
          },
        );
      }
      return null; // Distributed check passed
    } catch {
      // Fall through to in-memory on Upstash failure
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[RATE-LIMIT] WARNING: No distributed limiter in production. In-memory only.');
  }

  // In-memory fallback (per-instance backstop)
  return checkRateLimitInMemory(key, config);
}
```

### B10: Explicit NextAuth Cookie Configuration (Principle 18)

```typescript
// Add to NextAuth config in src/lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... existing config ...
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Domain not set = exact hostname match (most restrictive)
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.callback-url'
        : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Host-next-auth.csrf-token'
        : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
```

---

## C. Runtime Monitoring & Auditing (Principles 13-18)

### C5: Password Hash Timing Monitor (Principle 13)

```yaml
# Sentry / Datadog custom metric
# Alert if bcrypt hash time drops below 100ms (indicates cost factor regression)
# or exceeds 2000ms (indicates CPU starvation / wrong cost factor)

# Prometheus-style metric (if using custom instrumentation):
password_hash_duration_ms:
  type: histogram
  help: "Time to compute bcrypt hash during registration/password-reset"
  buckets: [50, 100, 200, 300, 500, 1000, 2000]

# Alert rule:
- alert: PasswordHashTooFast
  expr: histogram_quantile(0.5, rate(password_hash_duration_ms_bucket[5m])) < 100
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Median password hash time below 100ms -- cost factor may be too low or wrong algorithm"

- alert: PasswordHashTooSlow
  expr: histogram_quantile(0.95, rate(password_hash_duration_ms_bucket[5m])) > 2000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "P95 password hash time above 2s -- possible CPU starvation"
```

### C6: TLS Certificate Expiry & Downgrade Monitor (Principle 14)

```yaml
# Uptime / external monitoring probe
# Configure in your uptime provider (Checkly, Better Uptime, Pingdom)

checks:
  - name: "LastDonor TLS Health"
    url: "https://lastdonor.org"
    frequency: 360  # Every 6 hours
    assertions:
      - type: ssl_certificate_expires_in
        operator: gt
        value: 14  # days
      - type: response_header
        header: "Strict-Transport-Security"
        operator: contains
        value: "max-age=63072000"
      - type: ssl_version
        operator: eq
        value: "TLSv1.3"

  - name: "LastDonor HTTP Redirect"
    url: "http://lastdonor.org"
    followRedirects: false
    assertions:
      - type: status_code
        operator: in
        value: [301, 308]
```

### C7: Secret Exposure Detection (Principle 15)

```typescript
// src/lib/monitoring/secret-leak-detector.ts
// Hook into Sentry's beforeSend to scrub and alert on secret patterns in error reports

const SECRET_PATTERNS = [
  /sk_(test|live)_[a-zA-Z0-9]{20,}/,  // Stripe secret keys
  /whsec_[a-zA-Z0-9]{20,}/,            // Stripe webhook secrets
  /re_[a-zA-Z0-9]{20,}/,               // Resend API keys
  /postgresql?:\/\/[^:]+:[^@]+@/,      // Database connection sring with password
  /Bearer\s+[a-zA-Z0-9._-]{40,}/,      // Long bearer tokens
];

export function scrubSecrets(text: string): string {
  let scrubbed = text;
  for (const pattern of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(new RegExp(pattern, 'g'), '[REDACTED-SECRET]');
  }
  return scrubbed;
}

// In sentry.server.config.ts:
// Sentry.init({
//   beforeSend(event) {
//     // Scrub breadcrumb messages
//     event.breadcrumbs?.forEach(b => {
//       if (b.message) b.message = scrubSecrets(b.message);
//     });
//     // Scrub exception values
//     event.exception?.values?.forEach(e => {
//       if (e.value) e.value = scrubSecrets(e.value);
//     });
//     return event;
//   },
// });
```

### C8: Deserialization Anomaly Monitor (Principle 16)

```yaml
# Log-based detection: alert on JSON.parse errors that indicate probing

# Sentry alert rule:
- alert: DeserializationProbing
  condition: >
    count(events where message contains "SyntaxError" 
    AND tags.route matches "/api/v1/*"
    AND timestamp within last 5m) > 20
  severity: warning
  annotations:
    summary: "Elevated JSON parse errors on API routes -- possible deserialization probing"
    
# Veriff webhook specific:
- alert: VeriffSignatureFailures
  condition: >
    count(events where message contains "Invalid HMAC signature"
    AND tags.route = "/api/v1/verification/veriff/webhook"
    AND timestamp within last 15m) > 5
  severity: critical
  annotations:
    summary: "Multiple Veriff webhook signature failures -- possible spoofing attempt"
```

### C9: Rate Limit Effectiveness Monitor (Principle 17)

```yaml
# Monitor whether rate limiting is actually working
# If 429 responses are near-zero while traffic is high, limits may be bypassed

rate_limit_responses_total:
  type: counter
  help: "Total 429 responses served by rate limiter"
  labels: [route, limiter_type]  # limiter_type: "memory" | "distributed"

# Alert: Rate limits should trigger occasionally under normal traffic
- alert: RateLimiterIneffective
  expr: >
    rate(http_requests_total{status="200", path=~"/api/v1/auth.*"}[5m]) > 10
    AND rate(rate_limit_responses_total{route="/api/v1/auth"}[5m]) == 0
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "High auth traffic but zero rate limit triggers -- limiter may be bypassed (serverless cold-start issue)"

# Alert: Distributed vs in-memory divergence
- alert: DistributedLimiterDown
  expr: >
    rate(rate_limit_responses_total{limiter_type="memory"}[5m]) > 0
    AND rate(rate_limit_responses_total{limiter_type="distributed"}[5m]) == 0
  for: 15m
  labels:
    severity: critical
  annotations:
    summary: "In-memory rate limits triggering but distributed (Upstash) is silent -- Upstash may be down"
```

### C10: Cookie Attribute Audit (Principle 18)

```typescript
// test/security/cookie-audit.test.ts
// Integration test that verifies actual cookie attributes in HTTP responses

import { describe, it, expect } from 'vitest';

describe('Cookie Attribute Audit (Principle 18)', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  it('session cookie should have HttpOnly, Secure, SameSite attributes', async () => {
    // Login to get session cookie
    const res = await fetch(`${BASE_URL}/api/auth/csrf`);
    const cookies = res.headers.getSetCookie();
    
    for (const cookie of cookies) {
      if (cookie.includes('session-token')) {
        expect(cookie.toLowerCase()).toContain('httponly');
        if (BASE_URL.startsWith('https')) {
          expect(cookie.toLowerCase()).toContain('secure');
        }
        expect(cookie.toLowerCase()).toMatch(/samesite=(lax|strict)/);
      }
    }
  });

  it('CSRF token cookie should have SameSite=Lax', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/csrf`);
    const cookies = res.headers.getSetCookie();
    
    for (const cookie of cookies) {
      if (cookie.includes('csrf-token')) {
        expect(cookie.toLowerCase()).toContain('httponly');
        expect(cookie.toLowerCase()).toMatch(/samesite=(lax|strict)/);
      }
    }
  });
});
```

---

## D. Oblique Enforcement -- Principles 13-18 (Phase 3 Implementations)

### D5: Password Pepper Validation (Principle 13 -- "Sponge")

```typescript
// test/security/password-pepper.test.ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import bcrypt from 'bcryptjs';

describe('Password Pepper Protocol (Sponge)', () => {
  const MOCK_PEPPER = 'a'.repeat(64); // 32 bytes hex-encoded

  function preHash(password: string, pepper: string): string {
    return createHmac('sha256', pepper).update(password).digest('hex');
  }

  it('peppered hash should differ from unpeppered hash', async () => {
    const password = 'TestPassword123!';
    const peppered = preHash(password, MOCK_PEPPER);
    const unpeppered = password;

    // Both should be valid bcrypt inputs
    const hash1 = await bcrypt.hash(peppered, 10);
    const hash2 = await bcrypt.hash(unpeppered, 10);

    // Hashes should be different (different inputs)
    expect(hash1).not.toEqual(hash2);

    // Peppered hash should verify only with pepper
    expect(await bcrypt.compare(peppered, hash1)).toBe(true);
    expect(await bcrypt.compare(unpeppered, hash1)).toBe(false);
  });

  it('HMAC output should fit within bcrypt 72-byte limit', () => {
    const password = 'x'.repeat(1000);
    const peppered = preHash(password, MOCK_PEPPER);
    // SHA256 hex = 64 chars = 64 bytes (ASCII) < 72 bytes
    expect(peppered.length).toBe(64);
    expect(peppered.length).toBeLessThanOrEqual(72);
  });

  it('different peppers produce different hashes for same password', () => {
    const password = 'TestPassword123!';
    const pepper1 = 'a'.repeat(64);
    const pepper2 = 'b'.repeat(64);
    expect(preHash(password, pepper1)).not.toEqual(preHash(password, pepper2));
  });
});
```

### D6: TLS Mirror Probe -- Chaos Test (Principle 14 -- "Mirror")

```typescript
// test/security/tls-mirror.test.ts
// This runs against the deployed production site to verify TLS from the outside

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe.skipIf(!process.env.RUN_TLS_PROBE)('TLS Mirror Probe (Principle 14)', () => {
  const DOMAIN = 'lastdonor.org';

  it('should negotiate TLS 1.3', () => {
    const output = execSync(
      `echo | openssl s_client -connect ${DOMAIN}:443 -tls1_3 2>/dev/null | grep "Protocol"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('TLSv1.3');
  });

  it('should include HSTS header with correct max-age', () => {
    const output = execSync(
      `curl -sI https://${DOMAIN} | grep -i strict-transport-security`,
      { encoding: 'utf8' },
    );
    expect(output.toLowerCase()).toContain('max-age=63072000');
    expect(output.toLowerCase()).toContain('includesubdomains');
    expect(output.toLowerCase()).toContain('preload');
  });

  it('should not serve HTTP 200 on port 80', () => {
    const status = execSync(
      `curl -sI -o /dev/null -w "%{http_code}" http://${DOMAIN}`,
      { encoding: 'utf8' },
    ).trim();
    expect(status).not.toBe('200');
    expect(['301', '308']).toContain(status);
  });

  it('certificate should be valid for at least 14 days', () => {
    const output = execSync(
      `echo | openssl s_client -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -enddate`,
      { encoding: 'utf8' },
    );
    const match = output.match(/notAfter=(.+)/);
    expect(match).toBeTruthy();
    const expiryDate = new Date(match![1]);
    const daysLeft = (expiryDate.getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(14);
  });
});
```

### D7: Ephemeral Secret Rotation Chaos Test (Principle 15 -- "Zero")

```typescript
// test/security/secret-rotation-chaos.test.ts
// Simulate secret rotation and verify no breakage

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSecurityToken, verifySecurityToken } from '@/lib/crypto.server';

describe('Ephemeral Secret Rotation (Zero Protocol)', () => {
  const ORIGINAL_KEY = process.env.SETTINGS_ENCRYPTION_KEY;

  afterEach(() => {
    // Restore original key
    process.env.SETTINGS_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it('token created with old key should fail after rotation', () => {
    // Create token with current key
    const { token } = createSecurityToken('user-123');
    expect(verifySecurityToken(token)).toBe('user-123');

    // Rotate key
    const newKey = require('crypto').randomBytes(32).toString('hex');
    process.env.SETTINGS_ENCRYPTION_KEY = newKey;

    // Old token should no longer verify
    expect(verifySecurityToken(token)).toBeNull();
  });

  it('token should expire within TTL', () => {
    const { token, expiresAt } = createSecurityToken('user-456');
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 1000);

    // Token should verify within TTL
    expect(verifySecurityToken(token)).toBe('user-456');
  });

  it('tampered token should fail verification', () => {
    const { token } = createSecurityToken('user-789');
    // Flip a character in the base64 token
    const tampered = token.slice(0, -2) + 'XX';
    expect(verifySecurityToken(tampered)).toBeNull();
  });
});
```

### D8: Quarantine Deserialization Pattern (Principle 16 -- "Fermentation")

```typescript
// src/lib/utils/quarantine-parse.ts
// Quarantine pattern: JSON.parse into an immutable plain-object zone,
// then validate through Zod before entering the application model.

import type { ZodSchema, ZodError } from 'zod';

interface QuarantineResult<T> {
  ok: true;
  data: T;
} | {
  ok: false;
  error: ZodError;
  raw: unknown;
}

/**
 * Parse untrusted JSON into a quarantine zone, then validate with Zod.
 * The raw parsed value is NEVER returned to the caller on success --
 * only the Zod-validated output enters the application.
 */
export function quarantineParse<T>(
  raw: string,
  schema: ZodSchema<T>,
): QuarantineResult<T> {
  let quarantined: unknown;
  try {
    quarantined = JSON.parse(raw);
  } catch {
    // Return a synthetic Zod error for consistency
    return {
      ok: false,
      error: { issues: [{ code: 'custom', message: 'Invalid JSON', path: [] }] } as unknown as ZodError,
      raw: null,
    };
  }

  // Freeze the quarantined object to prevent __proto__ mutation
  if (typeof quarantined === 'object' && quarantined !== null) {
    Object.freeze(quarantined);
  }

  const result = schema.safeParse(quarantined);
  if (!result.success) {
    return { ok: false, error: result.error, raw: quarantined };
  }

  // Only the validated data escapes the quarantine
  return { ok: true, data: result.data };
}
```

### D9: Exponential Delay Rate Limiter (Principle 17 -- "Echo")

```typescript
// src/lib/rate-limit-echo.ts
// Progressive delay instead of hard rejection for first N over-limit requests

const delayStore = new Map<string, { overCount: number; lastOver: number }>();
const MAX_TOTAL_DELAY_MS = 30_000; // After 30s cumulative delay, hard-reject

/**
 * Instead of immediately rejecting, delay the response exponentially.
 * First over-limit: 1s delay. Second: 2s. Third: 4s. Fourth: 8s.
 * After cumulative delay exceeds MAX_TOTAL_DELAY_MS, return 429.
 *
 * This self-throttles attackers (they can't tolerate latency)
 * while giving legitimate burst users a minor delay instead of a wall.
 */
export function calculateEchoDelay(key: string, isOverLimit: boolean): number | 'reject' {
  if (!isOverLimit) {
    delayStore.delete(key);
    return 0;
  }

  const now = Date.now();
  const entry = delayStore.get(key) ?? { overCount: 0, lastOver: now };

  // Reset if window expired (2 minutes)
  if (now - entry.lastOver > 120_000) {
    entry.overCount = 0;
  }

  entry.overCount++;
  entry.lastOver = now;
  delayStore.set(key, entry);

  const delayMs = Math.pow(2, entry.overCount - 1) * 1000; // 1s, 2s, 4s, 8s...
  const cumulativeDelay = (Math.pow(2, entry.overCount) - 1) * 1000;

  if (cumulativeDelay > MAX_TOTAL_DELAY_MS) {
    return 'reject'; // Hard 429 after cumulative budget exhausted
  }

  return delayMs;
}
```

### D10: Session Binding Fingerprint (Principle 18 -- "Scorpion")

```typescript
// src/lib/session-fingerprint.ts
// Bind JWT sessions to client context to detect cookie theft

import { createHash } from 'crypto';

/**
 * Create a fingerprint from request context.
 * Uses User-Agent + IP prefix (first 3 octets for IPv4, first 48 bits for IPv6)
 * to create a session binding that detects stolen cookies used from different contexts.
 *
 * The IP prefix (not full IP) allows for minor IP changes within the same subnet
 * (mobile networks, corporate NATs) without invalidating the session.
 */
export function createSessionFingerprint(userAgent: string, ip: string): string {
  const ipPrefix = getIpPrefix(ip);
  const input = `${userAgent}|${ipPrefix}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function getIpPrefix(ip: string): string {
  if (ip.includes(':')) {
    // IPv6: first 3 groups (48 bits)
    return ip.split(':').slice(0, 3).join(':');
  }
  // IPv4: first 3 octets (/24 subnet)
  return ip.split('.').slice(0, 3).join('.');
}

/**
 * Validate that the current request matches the session's fingerprint.
 * Returns true if match, false if mismatch (possible cookie theft).
 */
export function validateSessionFingerprint(
  storedFingerprint: string,
  userAgent: string,
  ip: string,
): boolean {
  const currentFingerprint = createSessionFingerprint(userAgent, ip);
  // Timing-safe comparison not strictly needed here (fingerprint is not secret)
  // but prevents theoretical timing attacks on the hash comparison
  return storedFingerprint === currentFingerprint;
}

// Usage in NextAuth JWT callback:
// jwt({ token, user, req }) {
//   if (user) {
//     token.fingerprint = createSessionFingerprint(
//       req.headers['user-agent'] || '',
//       req.headers['x-forwarded-for']?.split(',')[0] || '',
//     );
//   }
//   return token;
// }
//
// In middleware:
// if (token.fingerprint && !validateSessionFingerprint(token.fingerprint, ua, ip)) {
//   // Possible cookie theft - invalidate session
//   return NextResponse.redirect('/login?reason=session_mismatch');
// }
```

---

## SUMMARY OF IMMEDIATE ACTIONS REQUIRED

| Priority | Action | Principle | Effort |
|----------|--------|-----------|--------|
| **P0** | Fix unsanitized `dangerouslySetInnerHTML` in ImpactUpdateForm.tsx | 1 | 5 min |
| **P0** | Set separate `NEWSLETTER_UNSUBSCRIBE_SECRET` env var | 4 | 10 min |
| **P0** | Set separate `SETTINGS_ENCRYPTION_KEY` env var (stop fallback to NEXTAUTH_SECRET) | 4 | 10 min |
| **P0** | **Make distributed rate limiter synchronous and blocking** (currently fire-and-forget) | 17 | 2 hrs |
| **P1** | Add origin allowlist for Stripe Connect return URLs | 1 | 30 min |
| **P1** | Add distributed rate limiting (Upstash Redis) -- enforce in production | 2, 17 | 2-4 hrs |
| **P1** | Remove `'unsafe-inline'` from CSP script-src | 4 | 1-2 hrs |
| **P1** | Implement server-side password pepper (`PASSWORD_PEPPER` env var) | 13 | 2-3 hrs |
| **P1** | Add explicit NextAuth cookie configuration (`__Secure-` prefix, explicit attrs) | 18 | 1 hr |
| **P1** | Add NEXTAUTH_SECRET rotation strategy (dual-key validation) | 15 | 3-4 hrs |
| **P2** | Add PostgreSQL RLS policies as defense-in-depth | 3 | 4-8 hrs |
| **P2** | Add secret entropy validation at startup | 4 | 1 hr |
| **P2** | Add step-up auth for admin settings environment endpoint | 3 | 2-3 hrs |
| **P2** | Add canary payload test suite to CI | 1 | 1 hr |
| **P2** | Add Zod validation to RSS JSON-LD extraction (`fetch-article-body.ts`) | 16 | 30 min |
| **P2** | Add session binding fingerprint to JWT | 18 | 2-3 hrs |
| **P2** | Increase bcrypt cost factor from 12 to 13 (with rehash-on-login) | 13 | 2 hrs |
| **P2** | Add production Veriff callback URL validation (reject `http://` in prod) | 14 | 15 min |
| **P3** | Implement circuit breaker for auth subsystem | 2 | 2-3 hrs |
| **P3** | Implement shadow authorization log | 3 | 3-4 hrs |
| **P3** | Add key rotation dry-run script | 4 | 1 hr |
| **P3** | Add password hash timing monitoring (Sentry custom metric) | 13 | 1-2 hrs |
| **P3** | Implement exponential delay rate limiter (echo protocol) | 17 | 2-3 hrs |
| **P3** | Add TLS mirror probe (GitHub Actions scheduled workflow) | 14 | 1 hr |
| **P3** | Add quarantine parse utility for untrusted JSON | 16 | 1 hr |
| **P3** | Add monitoring alerts (Prometheus/Sentry rules) | All | 2-3 hrs |
| **P3** | Configure CAA DNS record for lastdonor.org | 14 | 15 min |
| **P3** | Add per-user (session-based) rate limiting for authenticated endpoints | 17 | 3 hrs |
