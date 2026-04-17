# LastDonor.org â€” Infrastructure & DevOps Runbook

**Document ID**: LD-INFRA-001
**Version**: 0.1
**Date**: March 19, 2026
**Status**: Draft
**Classification**: Internal â€” Operations
**Owner**: Engineering Lead
**On-Call Rotation**: TBD

---

## 1. Environment Architecture

### 1.1 Environments

| Environment | Purpose | URL | Branch | Deploy Trigger |
|------------|---------|-----|--------|---------------|
| **Local** | Developer workstation | `localhost:3000` | Any | Manual (`npm run dev`) |
| **Preview** | PR previews, QA | `*.vercel.app` (auto-generated) | Per PR branch | Automatic on PR push |
| **Staging** | Pre-production validation | `staging.lastdonor.org` | `staging` | Merge to `staging` branch |
| **Production** | Live site | `lastdonor.org` | `main` | Merge to `main` |

### 1.2 Environment Parity

All environments use the same:
- Next.js version
- Node.js version (pinned in `.nvmrc` and Vercel settings)
- Database schema (migrations run per environment)
- Environment variable shape (different values, same keys)

Differences:
| Config | Local | Preview | Staging | Production |
|--------|-------|---------|---------|------------|
| Database | Local PostgreSQL or Supabase dev project | Supabase staging project | Supabase staging project | Supabase production project |
| Stripe | Test mode | Test mode | Test mode | **Live mode** |
| Email (Resend) | Sandbox (no real emails) | Sandbox | Staging domain | Production domain |
| Analytics | Disabled | Disabled | Plausible staging | Plausible production |
| Error tracking | Console only | Sentry dev | Sentry staging | Sentry production |
| CDN/Edge | None | Vercel | Vercel + Cloudflare | Vercel + Cloudflare |

---

## 2. Infrastructure Components

### 2.1 Architecture Diagram

```
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚   DNS        â”‚
                         â”‚  Cloudflare  â”‚
                         â”‚              â”‚
                         â”‚  A â†’ Vercel  â”‚
                         â”‚  CNAME â†’ ... â”‚
                         â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚     Cloudflare       â”‚
                    â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
                    â”‚  â”‚ DDoS Protectionâ”‚  â”‚
                    â”‚  â”‚ WAF Rules      â”‚  â”‚
                    â”‚  â”‚ SSL Terminationâ”‚  â”‚
                    â”‚  â”‚ Edge Cache     â”‚  â”‚
                    â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚       Vercel         â”‚
                    â”‚                      â”‚
                    â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚  â”‚ Edge Network   â”‚  â”‚      â”‚   Supabase   â”‚
                    â”‚  â”‚ (Global CDN)   â”‚  â”‚      â”‚              â”‚
                    â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚      â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
                    â”‚          â”‚           â”‚      â”‚ â”‚PostgreSQLâ”‚ â”‚
                    â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚â-„â”€â”€â”€â”€â–ºâ”‚ â”‚(Pooler)  â”‚ â”‚
                    â”‚  â”‚ Serverless     â”‚  â”‚      â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
                    â”‚  â”‚ Functions      â”‚  â”‚      â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
                    â”‚  â”‚ (API Routes)   â”‚  â”‚      â”‚ â”‚ Auth     â”‚ â”‚
                    â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚      â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
                    â”‚          â”‚           â”‚      â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
                    â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚      â”‚ â”‚ Storage  â”‚ â”‚
                    â”‚  â”‚ SSR/SSG/ISR    â”‚  â”‚      â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
                    â”‚  â”‚ (Next.js)      â”‚  â”‚      â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
                    â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚      â”‚ â”‚ Realtime â”‚ â”‚
                    â”‚                      â”‚      â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚
               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
               â”‚                â”‚                  â”‚
       â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”
       â”‚    Stripe    â”‚ â”‚    Resend    â”‚ â”‚   Sentry      â”‚
       â”‚  (Payments)  â”‚ â”‚   (Email)   â”‚ â”‚  (Monitoring) â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 2.2 Service-Level Dependencies

| Dependency | Criticality | Fallback If Down |
|-----------|:-----------:|-----------------|
| **Vercel** | Critical | Site is fully down. No fallback (evaluate backup CDN for Phase 2). |
| **Supabase** | Critical | API calls fail. Static pages still serve from CDN cache. Donations cannot process. |
| **Stripe** | Critical | Donations cannot process. Show "temporarily unavailable" on donate forms. |
| **Cloudflare** | High | DNS fails = site unreachable. Vercel direct IPs as emergency fallback. |
| **Resend** | Medium | Emails delayed. Donations still process. Queue emails for retry. |
| **Sentry** | Low | Errors not tracked. Site continues to function. |
| **Plausible** | Low | Analytics gap. No user impact. |

---

## 3. CI/CD Pipeline

### 3.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  integration-tests:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
      STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run test:integration

  build:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

  e2e-tests:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-results
          path: playwright-report/
```

### 3.2 Deployment Flow

```
PR Merged to main
        â”‚
        â–¼
GitHub Actions CI (full pipeline)
        â”‚ All stages pass
        â–¼
Vercel auto-deploys from main
        â”‚
        â–¼
Vercel runs build (next build)
        â”‚
        â–¼
Vercel deploys to production edge network
        â”‚
        â–¼
Sentry release created (source maps uploaded)
        â”‚
        â–¼
Post-deploy health check (automated)
  â”œâ”€â”€ Homepage returns 200
  â”œâ”€â”€ /api/v1/campaigns returns 200
  â”œâ”€â”€ /api/v1/stats returns 200
  â””â”€â”€ Stripe webhook endpoint responds
        â”‚
        â–¼
Deploy complete. Monitor Sentry for error spike.
```

### 3.3 Rollback Procedure

| Scenario | Action |
|----------|--------|
| Bad deploy detected (error spike, broken page) | Vercel instant rollback to previous deployment via dashboard or CLI: `vercel rollback` |
| Database migration issue | Drizzle rollback migration. If destructive, restore from Supabase point-in-time backup. |
| Stripe integration broken | Feature flag to disable donation form. Show maintenance message. Fix forward. |
| Security incident | Immediately rollback + rotate all affected secrets (see Security doc). |

**Rollback SLA**: Production rollback must be achievable within **5 minutes** of decision to roll back.

---

## 4. Database Operations

### 4.1 Migration Strategy

- **Tool**: Drizzle ORM migrations (`drizzle-kit`)
- **Forward-only in production**: Never edit a migration that has run in production. Create a new migration.
- **Backward compatible**: Every migration must be backward-compatible with the currently deployed code. This enables zero-downtime deploys.

```
# Generate migration from schema changes
npm run db:generate

# Run migrations against target environment
npm run db:migrate         # development
npm run db:migrate:staging # staging  
npm run db:migrate:prod    # production (requires confirmation)
```

### 4.2 Backup Strategy

| Type | Frequency | Retention | Tool |
|------|-----------|-----------|------|
| **Point-in-time recovery** | Continuous (WAL archiving) | 7 days | Supabase built-in (Pro plan) |
| **Daily snapshot** | Daily at 03:00 UTC | 30 days | Supabase built-in |
| **Weekly full backup** | Sunday 03:00 UTC | 90 days | pg_dump to encrypted S3/R2 bucket |
| **Pre-migration backup** | Before every production migration | Until verified | Manual pg_dump |

### 4.3 Database Monitoring

| Metric | Alert Threshold | Tool |
|--------|----------------|------|
| Connection pool utilization | > 80% | Supabase dashboard |
| Query duration (p95) | > 500ms | Supabase logs + custom alerts |
| Table size growth | > 20% month-over-month (unexpected) | Monthly manual review |
| Failed queries | > 5 per minute | Sentry (captured via Drizzle error handling) |
| Replication lag (if read replicas) | > 5 seconds | Supabase dashboard |

---

## 5. Monitoring & Alerting

### 5.1 Monitoring Stack

| Layer | Tool | What It Monitors |
|-------|------|-----------------|
| **Uptime** | Vercel Analytics + UptimeRobot (free) | Homepage, API health endpoint, donation endpoint |
| **Errors** | Sentry | JavaScript errors (client + server), unhandled exceptions, API errors |
| **Performance** | Vercel Analytics + Plausible | Core Web Vitals, page load times, API response times |
| **Infrastructure** | Supabase Dashboard | DB connections, query performance, storage usage |
| **Payments** | Stripe Dashboard | Failed charges, webhook delivery, dispute rate |
| **Email** | Resend Dashboard | Delivery rate, bounce rate, complaint rate |
| **Security** | Cloudflare Dashboard | DDoS attempts, WAF blocks, bot traffic |

### 5.2 Health Check Endpoint

```
GET /api/v1/health

Response 200:
{
  "status": "healthy",
  "timestamp": "2026-03-19T14:00:00Z",
  "checks": {
    "database": "connected",
    "stripe": "reachable",
    "email": "reachable"
  },
  "version": "1.2.3",
  "commit": "abc1234"
}

Response 503 (any check fails):
{
  "status": "degraded",
  "checks": {
    "database": "connected",
    "stripe": "unreachable",
    "email": "reachable"
  }
}
```

### 5.3 Alert Routing

| Severity | Channel | Who |
|----------|---------|-----|
| **SEV-1** (site down, payment failure, data breach) | Phone call + SMS + Email | On-call engineer + founder |
| **SEV-2** (major feature broken, elevated error rate) | SMS + Email | On-call engineer |
| **SEV-3** (degraded performance, non-critical bug) | Email + Slack/Discord | Engineering team |
| **SEV-4** (minor issue, cosmetic) | Ticket created | Engineering queue |

### 5.4 Key Metrics Dashboard

| Metric | Source | Check Frequency |
|--------|--------|----------------|
| Uptime percentage | UptimeRobot | Real-time (1-minute checks) |
| Error rate (client-side) | Sentry | Real-time |
| Error rate (server-side) | Sentry | Real-time |
| API response time (p50, p95, p99) | Vercel Analytics | Hourly |
| Donation success rate | Stripe Dashboard | Hourly |
| Webhook delivery success rate | Stripe Dashboard | Hourly |
| Active database connections | Supabase | Real-time |
| DNS resolution time | Cloudflare | Real-time |
| Core Web Vitals (LCP, FID, CLS) | Vercel Analytics | Daily aggregate |
| Email delivery rate | Resend | Daily aggregate |

---

## 6. Runbooks

### 6.1 Runbook: Site Is Down (502/503 from Vercel)

```
1. CHECK: Is it a Vercel platform issue?
   â†’ status.vercel.com â€” if yes, wait. If no, continue.

2. CHECK: Recent deployment?
   â†’ If yes: rollback immediately via Vercel dashboard.
   â†’ vercel rollback --yes

3. CHECK: Supabase connection issue?
   â†’ Supabase dashboard â†’ is the project paused or over limits?
   â†’ If paused: resume. If limits: upgrade plan.

4. CHECK: Sentry for exception spike
   â†’ Identify the error. If it's a code bug, rollback.

5. CHECK: Cloudflare blocking legitimate traffic?
   â†’ Cloudflare dashboard â†’ Firewall Events â†’ check for false positives.
   â†’ If yes: adjust WAF rules.

6. ESCALATE: If none of the above, contact Vercel support.
```

### 6.2 Runbook: Donations Not Processing

```
1. CHECK: Stripe status â†’ status.stripe.com
   â†’ If Stripe is down, enable maintenance banner on donate forms. Wait.

2. CHECK: Stripe Dashboard â†’ Payments â†’ recent failures
   â†’ Are payments failing at Stripe level? Check decline codes.

3. CHECK: Webhook delivery â†’ Stripe Dashboard â†’ Webhooks â†’ recent events
   â†’ Are webhooks being delivered? Check for failures.
   â†’ If webhooks failing: check /api/v1/donations/webhook endpoint health.

4. CHECK: Sentry for errors in webhook handler

5. CHECK: Database â†’ is the donations table writable?
   â†’ Supabase dashboard â†’ SQL Editor â†’ INSERT test

6. FIX: If webhook secret rotated/mismatched:
   â†’ Update STRIPE_WEBHOOK_SECRET in Vercel env vars
   â†’ Redeploy

7. RECOVERY: After fix, replay failed Stripe events via Dashboard
   â†’ Stripe Dashboard â†’ Webhooks â†’ select failed events â†’ Retry
```

### 6.3 Runbook: Suspected Data Breach

```
1. CONTAIN IMMEDIATELY:
   â†’ Revoke all API keys and secrets (Supabase, Stripe, Resend, NextAuth)
   â†’ Rotate all environment variables in Vercel
   â†’ Redeploy with new secrets

2. ASSESS:
   â†’ What data was exposed? Check audit logs.
   â†’ How was access gained? Check Sentry, Vercel logs, Supabase logs.
   â†’ What is the blast radius? (donor PII, payment data, admin credentials)

3. IF PAYMENT DATA INVOLVED:
   â†’ Contact Stripe immediately (Stripe handles card data, but notify them)
   â†’ Stripe will advise on PCI breach procedures

4. NOTIFY:
   â†’ Board of Directors (within 1 hour)
   â†’ Legal counsel (within 4 hours)
   â†’ Affected users (within 30 days â€” see Security doc for per-state requirements)
   â†’ If 501(c)(3): IRS may need to be notified depending on severity

5. POST-INCIDENT:
   â†’ Full post-mortem document
   â†’ Identify root cause and implement fixes
   â†’ External security audit if breach was significant
```

### 6.4 Runbook: Database Migration Failure in Production

```
1. DO NOT PANIC. DO NOT run another migration to "fix" it.

2. CHECK: Did the migration partially apply?
   â†’ Connect to Supabase SQL editor
   â†’ Check drizzle migration table for applied status
   â†’ Check table state manually

3. IF MIGRATION NOT STARTED:
   â†’ Fix the migration file
   â†’ Re-run

4. IF MIGRATION PARTIALLY APPLIED:
   â†’ Restore from pre-migration backup (taken before every prod migration)
   â†’ Fix the migration
   â†’ Re-run against restored database

5. IF DATA LOSS OCCURRED:
   â†’ Restore from point-in-time recovery (Supabase Pro: any point in last 7 days)
   â†’ Identify exact timestamp before the migration
   â†’ Restore to that point

6. COMMUNICATE:
   â†’ If site was affected, post status update
   â†’ If donations were affected, audit every transaction during the window
```

---

## 7. Domain & DNS Configuration

### 7.1 DNS Records (Cloudflare)

| Type | Name | Value | Proxy | TTL |
|------|------|-------|:---:|:---:|
| A | @ | 76.76.21.21 (Vercel) | Yes | Auto |
| CNAME | www | cname.vercel-dns.com | Yes | Auto |
| CNAME | staging | cname.vercel-dns.com | Yes | Auto |
| TXT | @ | v=spf1 include:resend.com ~all | No | Auto |
| TXT | resend._domainkey | (DKIM key from Resend) | No | Auto |
| MX | @ | (if using email on this domain) | No | Auto |

### 7.2 Cloudflare Configuration

| Setting | Value | Why |
|---------|-------|-----|
| SSL/TLS | Full (Strict) | End-to-end encryption |
| Always Use HTTPS | On | Redirect HTTP â†’ HTTPS |
| HSTS | On, max-age 1 year, includeSubDomains | Prevent downgrade attacks |
| Minimum TLS | 1.2 | Block obsolete protocols |
| Auto Minify | JS, CSS, HTML | Performance |
| Brotli | On | Compression |
| Browser Cache TTL | Respect existing headers | Let Vercel control caching |
| WAF | Managed rules enabled | Block known attack patterns |
| Bot Fight Mode | On | Block malicious bots |
| Rate Limiting | Custom rule on /api/* paths | Backup rate limiting |

---

## 8. Cron Jobs / Scheduled Tasks

| Job | Schedule | Environment | Implementation |
|-----|----------|-------------|---------------|
| **RSS feed aggregation** | Every 6 hours | Production | Vercel Cron â†’ `/api/v1/cron/fetch-news` |
| **Campaign phase checker** | Every 5 minutes | Production | Vercel Cron â†’ `/api/v1/cron/update-phases` |
| **Donation reconciliation** | Daily 04:00 UTC | Production | Vercel Cron â†’ `/api/v1/cron/reconcile` |
| **Expired session cleanup** | Daily 05:00 UTC | Production | Supabase scheduled function or Vercel Cron |
| **Sitemap regeneration** | Daily 06:00 UTC | Production | Vercel Cron â†’ triggers ISR revalidation |
| **Backup verification** | Weekly Sunday 07:00 UTC | Production | GitHub Action â†’ verify backup exists and is restorable |

### Cron Security
- All cron endpoints require `Authorization: Bearer <CRON_SECRET>` header
- Vercel Cron automatically sends this header
- Direct access without the secret returns `401`
- Each cron execution logged in audit trail

---

## 9. Cost Monitoring

### 9.1 Monthly Budget (MVP)

| Service | Plan | Monthly Cost | Usage Limit |
|---------|------|:---:|-------------|
| Vercel | Pro | $20 | 100GB bandwidth, 1M serverless invocations |
| Supabase | Pro | $25 | 8GB DB, 250GB bandwidth, 100k auth users |
| Cloudflare | Free | $0 | Unlimited requests |
| Resend | Free â†’ Starter | $0-20 | 3k emails/mo (free), 50k (starter) |
| Plausible | Growth | $9 | 10k monthly pageviews |
| UptimeRobot | Free | $0 | 50 monitors |
| Sentry | Developer | $0 | 5k errors/month |
| GitHub | Free | $0 | Unlimited repos, 2k CI minutes |
| **Total** | | **$54-74/mo** | |

### 9.2 Scaling Triggers

| Trigger | Current Plan | Upgrade To | Estimated New Cost |
|---------|-------------|------------|:---:|
| > 100GB bandwidth/month | Vercel Pro ($20) | Vercel Enterprise | Contact sales |
| > 8GB database | Supabase Pro ($25) | Supabase Team ($599) | $599/mo |
| > 50k emails/month | Resend Starter ($20) | Resend Pro ($80) | $80/mo |
| > 10k pageviews/month | Plausible ($9) | Plausible ($19) | $19/mo |
| > 5k errors/month | Sentry Free | Sentry Team ($26) | $26/mo |

**Monitor monthly.** Set billing alerts on Vercel and Supabase at 80% of plan limits.
