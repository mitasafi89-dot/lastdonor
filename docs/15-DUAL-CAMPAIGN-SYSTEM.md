# 15 â€” Dual Campaign System: Simulated & Real Campaign Coexistence

> **Document ID**: LD-DUAL-001  
> **Purpose**: Exhaustive architecture, implementation plan, and milestone breakdown for running simulated (system-generated) and real (user-created) campaigns simultaneously on the platform, with complete indistinguishability guarantees.  
> **Status**: Draft  
> **Prerequisite Docs**: 01â€“14 (all read and reconciled)  
> **Depends On**: Phases 1â€“4 complete, Milestones 1â€“6 complete

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System State Analysis](#2-current-system-state-analysis)
3. [Indistinguishability Attack Surface Audit](#3-indistinguishability-attack-surface-audit)
4. [Architecture Design](#4-architecture-design)
5. [Data Layer](#5-data-layer)
6. [Query Sanitization Layer](#6-query-sanitization-layer)
7. [Backend Logic](#7-backend-logic)
8. [Donation Routing & Fund Pooling](#8-donation-routing--fund-pooling)
9. [Messaging System](#9-messaging-system)
10. [Frontend Layer](#10-frontend-layer)
11. [Admin Simulation Controls](#11-admin-simulation-controls)
12. [Phase-Out Strategy](#12-phase-out-strategy)
13. [Risk Matrix & Mitigations](#13-risk-matrix--mitigations)
14. [Testing Strategy](#14-testing-strategy)
15. [Milestone Breakdown](#15-milestone-breakdown)

---

## 1. Executive Summary

### 1.1 Problem Statement

LastDonor.org needs to bootstrap platform activity and credibility while real user adoption is low. The solution is to run **simulated campaigns** (system-generated from news, with AI-driven donor activity) alongside **real campaigns** (created and managed by actual users) in a way that is **completely indistinguishable** to end users.

### 1.2 Core Principles

1. **Total Indistinguishability**: No user, system, API consumer, browser developer tools, or network inspector can differentiate between simulated and real campaigns under any circumstances.
2. **Full Functional Parity**: Real users interact with both campaign types identically â€” donating, messaging, viewing progress, receiving updates.
3. **Approach A â€” Fund Pooling**: Real donations to simulated campaigns are processed through Stripe normally. The platform will locate the actual person/entity referenced in the simulated campaign and deliver funds; otherwise, donations are redistributed to real campaigns via a general fund.
4. **Admin Control**: Simulated campaigns are controlled via an admin panel â€” enable/disable, volume scaling, category controls, per-campaign management.
5. **Graceful Phase-Out**: As real user activity increases, simulation volume decreases automatically based on configurable metric thresholds, ultimately reaching zero.

### 1.3 What Already Exists

The platform has **extensive simulation infrastructure** built in Phases 1â€“4 and Milestones 1â€“6:

| Component | Current State | Gap |
|-----------|---------------|-----|
| Campaign `source` field | `'automated'` vs `'manual'` on `campaigns` table | Exposed in `db.select()` â€” **leaks via API** |
| Donation `source` field | `'real'` vs `'seed'` on `donations` table | Exposed in full `select()` â€” **leaks via API** |
| Seed simulation engine | Full engine: trajectory profiles, surge events, cohorts, jittered timestamps, donor selector, message pool | Runs on ALL active campaigns â€” **no per-campaign control** |
| `SEED_MODE_ENABLED` env var | Single global toggle for simulate-donations cron | Not admin-configurable at runtime; no granularity |
| Fake Stripe IDs | `seed_${uuid}` prefix on seed donations | **Distinguishable** if inspected via API or DB |
| Seed donor emails | `seed-${uuid}@lastdonor.internal` | **Distinguishable** domain |
| News pipeline | Fully automated: news â†’ classify â†’ entities â†’ story â†’ campaign | Always sets `source: 'automated'` |
| Admin seed stats | `/api/v1/admin/seed/stats` endpoint | Exposes seed vs real breakdown â€” correct (admin-only) |
| Admin seed purge | `/api/v1/admin/seed/purge` endpoint | Correct admin-only tool |
| Campaign page SSR | `db.select()` returns all columns including `source` | `source` field must be stripped |
| Campaign slug API | `GET /api/v1/campaigns/[slug]` returns ALL campaign columns | `source` field must be stripped |
| Donation feed | Donor feed returns `id, donorName, donorLocation, amount, message, isAnonymous, createdAt` | Does NOT return `source` â€” **safe** |
| Messaging system | Does not exist | New feature required |

### 1.4 Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real donations on simulated campaigns | **Approach A: Pool funds** | Platform locates the real subject and delivers funds; undeliverable donations redistribute to real campaigns. Clear in ToS. |
| Schema approach | **Flag column on existing `campaigns` table** | UNION queries are fragile; a flag ensures all queries naturally include both types. |
| Frontend awareness | **Zero knowledge** | Frontend code never imports, references, or receives `simulation_flag` or `source`. Architecturally incapable of distinguishing. |
| Messaging model | **One-way donor messages only** | Donors can "leave a message" (public wall). Campaign runner posts updates only. No bidirectional chat. No AI response system needed. |
| Feature flag infrastructure | **`siteSettings` table (existing)** | No new dependency; already used for platform config; admin-editable at runtime. |

---

## 2. Current System State Analysis

### 2.1 Database Schema â€” Fields That Leak Campaign Type

#### `campaigns` table (22 columns)

```
source: text('source').default('manual')  // Values: 'manual' | 'automated'
```

**Leak vector**: The `source` column directly reveals whether a campaign was auto-generated from the news pipeline (`'automated'`) or manually created by an editor (`'manual'`). Currently returned in:
- `GET /api/v1/campaigns/[slug]` â€” uses `db.select()` which returns all columns
- Campaign detail SSR page (`src/app/campaigns/[slug]/page.tsx`) â€” `getCampaign()` uses `db.select()` (all columns)
- Related campaigns query â€” uses explicit column selection (does NOT include `source` â€” safe)
- Campaign list API (`GET /api/v1/campaigns`) â€” uses explicit column selection (does NOT include `source` â€” safe)

#### `donations` table (16 columns)

```
source: donationSourceEnum('source').notNull().default('real')  // Values: 'real' | 'seed'
stripePaymentId: text('stripe_payment_id').notNull()            // Seed: 'seed_${uuid}', Real: 'pi_xxxxx'
donorEmail: text('donor_email').notNull()                        // Seed: 'seed-xxx@lastdonor.internal'
```

**Leak vectors**:
1. `source` column â€” directly reveals seed vs real
2. `stripePaymentId` â€” `seed_` prefix is distinguishable from Stripe's `pi_` prefix
3. `donorEmail` â€” `@lastdonor.internal` domain is distinguishable from real emails

**Current exposure**: The donor feed query in `src/app/campaigns/[slug]/page.tsx` â†’ `getRecentDonors()` does NOT select `source`, `stripePaymentId`, or `donorEmail`. It only selects: `id, donorName, donorLocation, amount, message, isAnonymous, createdAt`. **This is safe.**

However, the following ARE exposed:
- `GET /api/v1/campaigns/[slug]` API route â†’ donor query selects the same safe fields. **Safe.**
- Admin donation list (`/api/v1/admin/donations`) â€” selects all fields. **Correct** (admin-only, intentionally exposed).
- Stripe webhook handler â€” inserts with `source: 'real'`. **Correct** (server-side only).
- Reconciliation cron â€” queries by `source` to separate totals. **Correct** (server-side only).

### 2.2 Simulation Engine â€” Current Flow

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CRON: /api/v1/cron/simulate-donations (every 15 min)        â”‚
â”‚ Guard: SEED_MODE_ENABLED === 'true' (env var)               â”‚
â”‚                                                              â”‚
â”‚ 1. Query ALL active + last_donor_zone campaigns              â”‚
â”‚ 2. For each campaign:                                        â”‚
â”‚    a. Get trajectory profile (JSONB on campaign)             â”‚
â”‚    b. shouldDonateThisCycle() â†’ probabilistic                â”‚
â”‚    c. donationCountThisCycle() â†’ 1â€“5 based on profile        â”‚
â”‚    d. For each donation:                                     â”‚
â”‚       - seedAmountCents() â†’ psychological pricing            â”‚
â”‚       - selectSimulatedDonor() â†’ from 3000+ donor pool       â”‚
â”‚       - pickSeedMessage() â†’ from campaign_seed_messages       â”‚
â”‚       - Generate fake Stripe ID: 'seed_${uuid}'              â”‚
â”‚       - Generate fake email: 'seed-xxx@lastdonor.internal'   â”‚
â”‚       - INSERT into donations (source='seed')                â”‚
â”‚       - UPDATE campaign raisedAmount + donorCount atomically  â”‚
â”‚    e. maybeBuildCohort() â†’ 12% chance of group donation       â”‚
â”‚    f. Check phase transition â†’ generate AI update            â”‚
â”‚    g. Check completion â†’ celebration + impact report          â”‚
â”‚ 3. Audit log result                                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Key observations**:
- The simulation engine runs on ALL campaigns indiscriminately. There is no per-campaign flag to control whether it receives seed donations.
- The `SEED_MODE_ENABLED` env var is a hard binary toggle â€” no volume control, no category filtering, no per-campaign control.
- Simulated campaigns and real campaigns are not distinguished at the engine level â€” the engine would seed real user campaigns too.

### 2.3 News Pipeline â€” Campaign Creation Flow

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ news-pipeline.ts â†’ Step 8: Insert campaign                  â”‚
â”‚                                                              â”‚
â”‚ INSERT INTO campaigns:                                       â”‚
â”‚   source: 'automated'          â† LEAK VECTOR                â”‚
â”‚   campaignProfile: TrajectoryProfile (JSONB)                 â”‚
â”‚   campaignOrganizer: CampaignOrganizer (JSONB)              â”‚
â”‚   status: 'active'                                           â”‚
â”‚   publishedAt: NOW()                                         â”‚
â”‚                                                              â”‚
â”‚ â†’ Also generates 30 seed messages for first_believers phase  â”‚
â”‚ â†’ Sets trajectory profile for simulation engine              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 2.4 Frontend Campaign Page â€” What's Rendered

The campaign detail page (`src/app/campaigns/[slug]/page.tsx`) fetches campaign data via `getCampaign()` which currently uses `db.select()` (selects ALL columns). This returns the full `Campaign` type including `source`, `campaignProfile`, and `campaignOrganizer`.

However, examining what's actually **rendered**:
- Title, slug, status, heroImageUrl, photoCredit, storyHtml
- goalAmount, raisedAmount, donorCount
- category, location, subjectName, subjectHometown
- impactTiers, publishedAt, updatedAt
- lastDonorName, lastDonorAmount
- campaignOrganizer (organizer name shown on page)
- `source` â€” **NOT rendered in JSX** but available in the component's props. A motivated developer using React DevTools could inspect this.

### 2.5 Settings Infrastructure

The platform has a `siteSettings` table (key â†’ JSONB value) and a settings system:

```typescript
// src/lib/settings.ts â€” client-safe types
interface SettingsMap {
  'donation.min_amount': number;
  'campaign.auto_publish_threshold': number;
  'platform.maintenance_mode': boolean;
  // ... etc
}

// src/lib/settings.server.ts â€” server-side DB reads
getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]>
```

This system can be extended for simulation control settings without adding new infrastructure.

---

## 3. Indistinguishability Attack Surface Audit

### 3.1 Attack Vectors â€” Complete Enumeration

Every possible way a non-admin person or system could detect simulation, and the mitigation for each:

#### 3.1.1 API Response Leaks

| Vector | Current Risk | File | Mitigation |
|--------|-------------|------|------------|
| Campaign `source` field in `GET /api/v1/campaigns/[slug]` | **CRITICAL** | `src/app/api/v1/campaigns/[slug]/route.ts` line 26: `db.select()` returns all columns | Replace with explicit column selection via `publicCampaignSelect()` |
| Campaign `source` field in SSR `getCampaign()` | **CRITICAL** | `src/app/campaigns/[slug]/page.tsx` line 33: `db.select()` returns all columns | Replace with explicit column selection via `publicCampaignSelect()` |
| Campaign `campaignProfile` in API/SSR | **HIGH** | Same files â€” `campaignProfile` contains `TrajectoryProfile` with simulation params | Exclude from public select; only used internally by simulation engine |
| Campaign `simulation_flag` (new field) | **CRITICAL** | N/A (to be added) | Never include in any public select; create `publicCampaignSelect()` that excludes it |
| Donation `source` field | **SAFE** | Donor feed queries explicitly select only safe columns | Maintain current safe selection |
| Donation `stripePaymentId` | **SAFE** | Never returned in donor feed queries | Maintain current safe selection |
| Donation `donorEmail` | **SAFE** | Never returned in donor feed queries | Maintain current safe selection |

#### 3.1.2 Data Pattern Leaks

| Vector | Current Risk | Mitigation |
|--------|-------------|------------|
| Seed Stripe IDs start with `seed_` | **MEDIUM** â€” only visible in admin/DB | Change prefix to `pi_sim_${uuid}` â€” closer to real Stripe `pi_` prefix. Or use fully realistic format: `pi_${base62(32)}` |
| Seed donor emails use `@lastdonor.internal` | **MEDIUM** â€” only visible in admin/DB | Change to realistic-looking emails: generate from donor name + common domains (gmail, yahoo, outlook) |
| Donation timestamps cluster at 15-min cron intervals | **LOW** â€” jitter already implemented | Current jitter spreads across full 15-min window. Adequate. |
| Donor names repeat across campaigns | **LOW** â€” 3000+ donor pool with repeat chance | 8% repeat donor rate is realistic. Pool size is adequate. |
| All automated campaigns set `source: 'automated'` | **CRITICAL** â€” visible in DB | Add `simulation_flag` column; keep `source` for backward compat; sanitize from public queries |
| Campaign `campaignProfile` JSONB contains simulation parameters | **HIGH** â€” visible in API response if `select()` returns all columns | Exclude from public select |
| Campaign `campaignOrganizer` is AI-generated for simulated campaigns | **NONE** â€” also used for real campaigns | No action needed |

#### 3.1.3 Behavioral Pattern Leaks

| Vector | Current Risk | Mitigation |
|--------|-------------|------------|
| Simulated campaigns all originate from news articles | **LOW** | Real manual campaigns also exist; mix is natural |
| No real user has ever posted an update on a simulated campaign | **MEDIUM** | Organizer updates are AI-generated. Consistent within simulated campaigns. Real campaigns will have real organizer updates â€” pattern difference is subtle |
| Simulated campaigns never have recurring donations | **LOW** | Add simulated recurring donation patterns in seed engine |
| Seed donations never have a `userId` (always null) | **MEDIUM** â€” visible in admin DB queries | By design: seed donors aren't real users. Admin knows this. No public exposure. |
| All seed donation messages come from `campaign_seed_messages` pool | **NONE** | Messages are AI-generated, varied, campaign-specific. Indistinguishable from real messages. |

#### 3.1.4 Infrastructure Leaks

| Vector | Current Risk | Mitigation |
|--------|-------------|------------|
| `SEED_MODE_ENABLED` env var | **NONE** â€” server-side only | Move to `siteSettings` DB for runtime control |
| `campaign_creation_daily_limit` setting | **NONE** â€” controls news pipeline only | No action needed |
| React DevTools inspection of campaign props | **MEDIUM** | Ensure `source`, `simulation_flag`, `campaignProfile` are never passed to client components |
| Network tab shows no Stripe API calls for seed donations | **NONE** | Seed donations are server-side cron. No browser involvement. |
| Supabase dashboard direct DB access | **LOW** â€” admin insider risk only | Document access control policy; consider PostgreSQL RLS |

#### 3.1.5 Receipt & Email Leaks

| Vector | Current Risk | Mitigation |
|--------|-------------|------------|
| Real donations to simulated campaigns get real Stripe receipts | **NONE** â€” this is by design (Approach A) | Receipts are legitimate since payment is real |
| Seed donations don't generate receipt emails | **NONE** â€” no email is sent; no one expects one | N/A |
| Seed donor emails are fake | **NONE** â€” never used for outbound email | N/A |

### 3.2 Severity Summary

| Severity | Count | Items |
|----------|-------|-------|
| **CRITICAL** | 3 | Campaign `source` in API, campaign `source` in SSR, `simulation_flag` exposure |
| **HIGH** | 2 | `campaignProfile` in API/SSR, seed Stripe ID prefix |
| **MEDIUM** | 4 | Seed email domain, no recurring seed donations, React DevTools props, no userId on seeds |
| **LOW** | 4 | Timestamp patterns, donor name repeats, news origin pattern, DB direct access |
| **NONE/SAFE** | 8 | Various already-safe vectors |

---

## 4. Architecture Design

### 4.1 High-Level Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                            ADMIN LAYER                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Simulation Control Panel                                            â”‚  â”‚
â”‚  â”‚  â€¢ Global enable/disable toggle                                     â”‚  â”‚
â”‚  â”‚  â€¢ Volume slider (0% â€“ 100%)                                        â”‚  â”‚
â”‚  â”‚  â€¢ Per-category enable/disable                                      â”‚  â”‚
â”‚  â”‚  â€¢ Per-campaign pause/resume/convert                                â”‚  â”‚
â”‚  â”‚  â€¢ Fund pool dashboard                                              â”‚  â”‚
â”‚  â”‚  â€¢ Phase-out threshold configuration                                â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                    â”‚ reads/writes                          â”‚
â”‚                                    â–¼                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ siteSettings table                                                  â”‚  â”‚
â”‚  â”‚  â€¢ simulation.enabled: boolean                                      â”‚  â”‚
â”‚  â”‚  â€¢ simulation.volume: number (0.0â€“1.0)                              â”‚  â”‚
â”‚  â”‚  â€¢ simulation.categories: string[]                                  â”‚  â”‚
â”‚  â”‚  â€¢ simulation.max_concurrent: number                                â”‚  â”‚
â”‚  â”‚  â€¢ simulation.phase_out_thresholds: object                          â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                     â”‚
                                     â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                          BACKEND LAYER                                     â”‚
â”‚                                                                            â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â”‚
â”‚  â”‚ News Pipeline         â”‚    â”‚ Real Campaign         â”‚                    â”‚
â”‚  â”‚ (creates simulated)   â”‚    â”‚ Creation              â”‚                    â”‚
â”‚  â”‚                       â”‚    â”‚ (user/editor submit)   â”‚                    â”‚
â”‚  â”‚ simulation_flag=TRUE  â”‚    â”‚ simulation_flag=FALSE  â”‚                    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                    â”‚
â”‚             â”‚                            â”‚                                  â”‚
â”‚             â–¼                            â–¼                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚                    campaigns table                                   â”‚  â”‚
â”‚  â”‚  simulation_flag: boolean (INTERNAL ONLY â€” never in public queries) â”‚  â”‚
â”‚  â”‚  source: text ('manual' | 'automated') â€” backward compat            â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚             â”‚                                                              â”‚
â”‚             â–¼                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ QUERY SANITIZATION LAYER (publicCampaignSelect)                     â”‚  â”‚
â”‚  â”‚                                                                      â”‚  â”‚
â”‚  â”‚ Every public-facing query goes through this function.                â”‚  â”‚
â”‚  â”‚ Strips: simulation_flag, source, campaignProfile, simulation_config â”‚  â”‚
â”‚  â”‚ Returns: ONLY the fields needed for rendering.                      â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚             â”‚                                                              â”‚
â”‚             â–¼                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Donation Router                                                      â”‚  â”‚
â”‚  â”‚                                                                      â”‚  â”‚
â”‚  â”‚ POST /api/v1/donations/create-intent                                â”‚  â”‚
â”‚  â”‚  â†’ Fetch campaign (WITH simulation_flag â€” internal query)            â”‚  â”‚
â”‚  â”‚  â†’ If simulation_flag=true: create real Stripe intent, tag metadata â”‚  â”‚
â”‚  â”‚     as fund_pool, insert to fund_pool_allocations table             â”‚  â”‚
â”‚  â”‚  â†’ If simulation_flag=false: create real Stripe intent (normal)     â”‚  â”‚
â”‚  â”‚  â†’ Response is IDENTICAL in both cases                              â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚             â”‚                                                              â”‚
â”‚             â–¼                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Simulation Engine (modified)                                         â”‚  â”‚
â”‚  â”‚                                                                      â”‚  â”‚
â”‚  â”‚ 1. Check siteSettings â†’ simulation.enabled                          â”‚  â”‚
â”‚  â”‚ 2. Query only campaigns WHERE simulation_flag = true                â”‚  â”‚
â”‚  â”‚ 3. Apply volume scaling factor                                      â”‚  â”‚
â”‚  â”‚ 4. Apply category filter                                             â”‚  â”‚
â”‚  â”‚ 5. Run existing seed donation logic                                  â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                     â”‚
                                     â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                          FRONTEND LAYER                                    â”‚
â”‚                                                                            â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Campaign pages, donation forms, donor feed, updates                 â”‚  â”‚
â”‚  â”‚                                                                      â”‚  â”‚
â”‚  â”‚ RECEIVES ONLY: sanitized campaign data (no simulation_flag,         â”‚  â”‚
â”‚  â”‚ no source, no campaignProfile)                                      â”‚  â”‚
â”‚  â”‚                                                                      â”‚  â”‚
â”‚  â”‚ RENDERING: Identical for all campaigns. No conditional logic.       â”‚  â”‚
â”‚  â”‚ INTERACTION: Donate, message, share â€” all identical.                â”‚  â”‚
â”‚  â”‚                                                                      â”‚  â”‚
â”‚  â”‚ â†’ ARCHITECTURALLY INCAPABLE OF KNOWING CAMPAIGN TYPE               â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 4.2 Data Flow Summary

```
Real User Journey (on any campaign type):
  User visits /campaigns/some-slug
    â†’ SSR getCampaign() â†’ publicCampaignSelect() â†’ stripped data
    â†’ User sees campaign, donor feed, updates
    â†’ User clicks Donate â†’ DonationForm
    â†’ POST /create-intent â†’ backend checks simulation_flag internally
    â†’ Stripe PaymentIntent created (real, with fund_pool metadata if simulated)
    â†’ User completes payment â†’ Stripe webhook fires
    â†’ Donation recorded (source='real') â†’ campaign tallies updated
    â†’ Receipt email sent â†’ notification created

Simulation Engine (on simulated campaigns only):
  Cron fires every 15 min
    â†’ Check siteSettings â†’ simulation.enabled
    â†’ Query campaigns WHERE simulation_flag = true AND status IN ('active','last_donor_zone')
    â†’ Apply volume scaling
    â†’ For each campaign: seed donations, phase transitions, updates
    â†’ All seed donations tagged source='seed'
```

---

## 5. Data Layer

### 5.1 Schema Changes

#### 5.1.1 New Column: `simulation_flag` on `campaigns`

```sql
ALTER TABLE campaigns ADD COLUMN simulation_flag BOOLEAN NOT NULL DEFAULT FALSE;
```

**Purpose**: The authoritative internal marker for whether a campaign is simulated.

**Why a separate column from `source`**:
- `source` has existing values `'manual'` and `'automated'` which indicate HOW a campaign was created, not WHETHER it's simulated.
- A manual campaign could be simulated (admin creates a test campaign).
- An automated campaign could theoretically be "real" in the future (if the news pipeline is used to create campaigns for verified real beneficiaries).
- `simulation_flag` is a clean boolean with a single unambiguous meaning.

**Backfill migration**:
```sql
-- All existing automated campaigns become simulated
UPDATE campaigns SET simulation_flag = TRUE WHERE source = 'automated';
-- All existing manual campaigns remain non-simulated
-- (they were created by editors/admins as platform content)
```

**Index**:
```sql
CREATE INDEX idx_campaigns_simulation_flag ON campaigns (simulation_flag);
```

#### 5.1.2 New Column: `simulation_config` on `campaigns`

```sql
ALTER TABLE campaigns ADD COLUMN simulation_config JSONB DEFAULT NULL;
```

**Purpose**: Per-campaign simulation configuration. Allows pausing individual simulated campaigns, or adjusting their behavior.

**Schema**:
```typescript
type SimulationConfig = {
  /** Whether seed donations are paused for this specific campaign */
  paused: boolean;
  /** Override volume multiplier for this campaign (0.0â€“2.0) */
  volumeOverride?: number;
  /** Whether this campaign's funds should go to pool or to located beneficiary */
  fundAllocation: 'pool' | 'located_beneficiary';
  /** If beneficiary located, their contact/payment info (encrypted) */
  beneficiaryInfo?: string;
  /** Admin notes about this simulated campaign */
  notes?: string;
};
```

#### 5.1.3 New Table: `fund_pool_allocations`

```sql
CREATE TABLE fund_pool_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id),
  source_campaign_id UUID NOT NULL REFERENCES campaigns(id),
  target_campaign_id UUID REFERENCES campaigns(id),  -- NULL until allocated
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'allocated' | 'disbursed'
  allocated_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fund_pool_status ON fund_pool_allocations (status);
CREATE INDEX idx_fund_pool_source ON fund_pool_allocations (source_campaign_id);
CREATE INDEX idx_fund_pool_target ON fund_pool_allocations (target_campaign_id);
```

**Purpose**: Tracks real donations made to simulated campaigns. Each row represents a real dollar amount that entered via a simulated campaign and needs to be allocated to a real beneficiary or redistributed.

#### 5.1.4 New Table: `campaign_messages` (Messaging System)

```sql
CREATE TABLE campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  user_id UUID REFERENCES users(id),          -- NULL for anonymous/guest messages
  donor_name TEXT NOT NULL DEFAULT 'Anonymous',
  donor_location TEXT,
  message TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  donation_id UUID REFERENCES donations(id),  -- links to the donation that triggered this message
  flagged BOOLEAN NOT NULL DEFAULT FALSE,      -- admin moderation flag
  hidden BOOLEAN NOT NULL DEFAULT FALSE,       -- admin can hide inappropriate messages
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_messages_campaign ON campaign_messages (campaign_id);
CREATE INDEX idx_campaign_messages_user ON campaign_messages (user_id);
CREATE INDEX idx_campaign_messages_created ON campaign_messages (created_at);
CREATE INDEX idx_campaign_messages_flagged ON campaign_messages (flagged);
```

**Purpose**: Stores donor messages (the "leave a message" / wall feature). Separate from `donations.message` to support standalone messages and richer interaction without coupling to payment events.

**Relationship to existing `donations.message`**: When a donor donates and includes a message, the message is stored BOTH in `donations.message` (for the donation record) and as a new row in `campaign_messages` (for the public wall). This allows:
1. Messages independent of donations
2. Message moderation without affecting donation records
3. Future message features (replies, reactions) without touching the donations table

#### 5.1.5 New Notification Type

```sql
ALTER TYPE notification_type ADD VALUE 'new_message';
ALTER TYPE notification_type ADD VALUE 'message_flagged';
```

#### 5.1.6 Settings Keys (in `siteSettings` table)

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `simulation.enabled` | boolean | `true` | Global simulation on/off |
| `simulation.volume` | number | `1.0` | Volume multiplier (0.0 = paused, 1.0 = full) |
| `simulation.categories` | string[] | `['medical','disaster','military','veterans','memorial','first-responders','community','essential-needs']` | Categories that receive simulated campaigns |
| `simulation.max_concurrent` | number | `20` | Max simulated campaigns active at once |
| `simulation.phase_out.enabled` | boolean | `false` | Auto phase-out based on real campaign count |
| `simulation.phase_out.threshold_low` | number | `10` | Real campaigns count â†’ reduce volume to 0.7 |
| `simulation.phase_out.threshold_mid` | number | `25` | Real campaigns count â†’ reduce volume to 0.3 |
| `simulation.phase_out.threshold_high` | number | `50` | Real campaigns count â†’ disable new simulations |
| `simulation.fund_pool.auto_allocate` | boolean | `false` | Auto-allocate pooled funds to real campaigns |

### 5.2 Migration File

**File**: `migrations/0013_dual_campaign_system.sql`

```sql
-- 1. Add simulation_flag to campaigns
ALTER TABLE campaigns ADD COLUMN simulation_flag BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_campaigns_simulation_flag ON campaigns (simulation_flag);

-- 2. Add simulation_config to campaigns
ALTER TABLE campaigns ADD COLUMN simulation_config JSONB DEFAULT NULL;

-- 3. Backfill: all automated campaigns become simulated
UPDATE campaigns SET simulation_flag = TRUE WHERE source = 'automated';

-- 4. Create fund_pool_allocations table
CREATE TABLE fund_pool_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id),
  source_campaign_id UUID NOT NULL REFERENCES campaigns(id),
  target_campaign_id UUID REFERENCES campaigns(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  allocated_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fund_pool_status ON fund_pool_allocations (status);
CREATE INDEX idx_fund_pool_source ON fund_pool_allocations (source_campaign_id);
CREATE INDEX idx_fund_pool_target ON fund_pool_allocations (target_campaign_id);

-- 5. Create campaign_messages table
CREATE TABLE campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  user_id UUID REFERENCES users(id),
  donor_name TEXT NOT NULL DEFAULT 'Anonymous',
  donor_location TEXT,
  message TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  donation_id UUID REFERENCES donations(id),
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaign_messages_campaign ON campaign_messages (campaign_id);
CREATE INDEX idx_campaign_messages_user ON campaign_messages (user_id);
CREATE INDEX idx_campaign_messages_created ON campaign_messages (created_at);
CREATE INDEX idx_campaign_messages_flagged ON campaign_messages (flagged);

-- 6. Add new notification types
ALTER TYPE notification_type ADD VALUE 'new_message';
ALTER TYPE notification_type ADD VALUE 'message_flagged';

-- 7. Seed simulation settings
INSERT INTO site_settings (key, value) VALUES
  ('simulation.enabled', 'true'::jsonb),
  ('simulation.volume', '1.0'::jsonb),
  ('simulation.categories', '["medical","disaster","military","veterans","memorial","first-responders","community","essential-needs"]'::jsonb),
  ('simulation.max_concurrent', '20'::jsonb),
  ('simulation.phase_out.enabled', 'false'::jsonb),
  ('simulation.phase_out.threshold_low', '10'::jsonb),
  ('simulation.phase_out.threshold_mid', '25'::jsonb),
  ('simulation.phase_out.threshold_high', '50'::jsonb),
  ('simulation.fund_pool.auto_allocate', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

---

## 6. Query Sanitization Layer

### 6.1 Core Concept

Create a **single function** that defines which campaign fields are exposed to public queries. Every public API route, SSR page, and client-facing data fetch must use this function. The `simulation_flag`, `source`, `campaignProfile`, and `simulation_config` columns must **never** appear in any public-facing query result.

### 6.2 Implementation: `publicCampaignSelect()`

**File**: `src/db/public-select.ts`

```typescript
import { campaigns, donations, campaignMessages } from '@/db/schema';

/**
 * SECURITY-CRITICAL: This is the ONLY set of campaign columns
 * that may be returned to public-facing queries.
 *
 * NEVER add simulation_flag, source, campaignProfile, or
 * simulation_config to this selection.
 *
 * Any change to this file requires security review.
 */
export const publicCampaignSelect = {
  id: campaigns.id,
  title: campaigns.title,
  slug: campaigns.slug,
  status: campaigns.status,
  heroImageUrl: campaigns.heroImageUrl,
  photoCredit: campaigns.photoCredit,
  storyHtml: campaigns.storyHtml,
  goalAmount: campaigns.goalAmount,
  raisedAmount: campaigns.raisedAmount,
  donorCount: campaigns.donorCount,
  category: campaigns.category,
  location: campaigns.location,
  subjectName: campaigns.subjectName,
  subjectHometown: campaigns.subjectHometown,
  impactTiers: campaigns.impactTiers,
  campaignOrganizer: campaigns.campaignOrganizer,
  createdAt: campaigns.createdAt,
  updatedAt: campaigns.updatedAt,
  publishedAt: campaigns.publishedAt,
  completedAt: campaigns.completedAt,
  lastDonorId: campaigns.lastDonorId,
  lastDonorName: campaigns.lastDonorName,
  lastDonorAmount: campaigns.lastDonorAmount,
} as const;

/**
 * Campaign columns for list/card views (subset of full detail).
 */
export const publicCampaignCardSelect = {
  id: campaigns.id,
  title: campaigns.title,
  slug: campaigns.slug,
  status: campaigns.status,
  heroImageUrl: campaigns.heroImageUrl,
  category: campaigns.category,
  location: campaigns.location,
  subjectName: campaigns.subjectName,
  subjectHometown: campaigns.subjectHometown,
  campaignOrganizer: campaigns.campaignOrganizer,
  goalAmount: campaigns.goalAmount,
  raisedAmount: campaigns.raisedAmount,
  donorCount: campaigns.donorCount,
  publishedAt: campaigns.publishedAt,
} as const;

/**
 * Donation columns safe for public donor feed display.
 * NEVER include source, stripePaymentId, or donorEmail.
 */
export const publicDonationSelect = {
  id: donations.id,
  donorName: donations.donorName,
  donorLocation: donations.donorLocation,
  amount: donations.amount,
  message: donations.message,
  isAnonymous: donations.isAnonymous,
  createdAt: donations.createdAt,
} as const;

/**
 * Campaign message columns safe for public display.
 * NEVER include flagged or hidden â€” filter in WHERE clause.
 */
export const publicMessageSelect = {
  id: campaignMessages.id,
  donorName: campaignMessages.donorName,
  donorLocation: campaignMessages.donorLocation,
  message: campaignMessages.message,
  isAnonymous: campaignMessages.isAnonymous,
  createdAt: campaignMessages.createdAt,
} as const;
```

### 6.3 Files That Must Be Updated to Use `publicCampaignSelect()`

| File | Current Query | Required Change |
|------|---------------|-----------------|
| `src/app/campaigns/[slug]/page.tsx` â†’ `getCampaign()` | `db.select().from(campaigns)` | `db.select(publicCampaignSelect).from(campaigns)` |
| `src/app/api/v1/campaigns/[slug]/route.ts` â†’ `GET` | `db.select().from(campaigns)` | `db.select(publicCampaignSelect).from(campaigns)` |
| `src/app/api/v1/campaigns/route.ts` â†’ `GET` | Explicit select (already safe) | Verify against `publicCampaignCardSelect` |
| `src/app/campaigns/[slug]/page.tsx` â†’ `getRelatedCampaigns()` | Explicit select (already safe) | Verify against `publicCampaignCardSelect` |
| `src/app/api/v1/og/campaign/[slug]/route.ts` | Check for `db.select()` | Update if needed |
| `src/app/page.tsx` â†’ homepage featured campaigns | Check query | Update if needed |
| Any new API routes or pages | â€” | Must use `publicCampaignSelect` |

### 6.4 TypeScript Type Enforcement

Create a public-facing campaign type that EXCLUDES internal fields:

**File**: `src/types/public.ts`

```typescript
/**
 * Public campaign type â€” this is what the frontend sees.
 * NEVER includes simulation_flag, source, campaignProfile, or simulation_config.
 */
export type PublicCampaign = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'active' | 'last_donor_zone' | 'completed' | 'archived';
  heroImageUrl: string;
  photoCredit: string | null;
  storyHtml: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  category: string;
  location: string | null;
  subjectName: string;
  subjectHometown: string | null;
  impactTiers: unknown;
  campaignOrganizer: unknown;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  completedAt: Date | null;
  lastDonorId: string | null;
  lastDonorName: string | null;
  lastDonorAmount: number | null;
};

/**
 * Public donation type â€” what the donor feed shows.
 */
export type PublicDonation = {
  id: string;
  donorName: string;
  donorLocation: string | null;
  amount: number;
  message: string | null;
  isAnonymous: boolean;
  createdAt: Date | string;
};

/**
 * Public message type â€” what the message wall shows.
 */
export type PublicMessage = {
  id: string;
  donorName: string;
  donorLocation: string | null;
  message: string;
  isAnonymous: boolean;
  createdAt: Date | string;
};
```

### 6.5 Automated Enforcement

Create a test that scans all public-facing query files and asserts that `simulation_flag`, `source` (on campaigns), and `campaignProfile` are never selected in public routes:

**Test**: `test/security/query-sanitization.test.ts`

This test will:
1. Grep all files in `src/app/api/v1/` (excluding `admin/`, `cron/`) for `db.select()`
2. Grep all files in `src/app/campaigns/`, `src/app/page.tsx`, `src/app/donate/`
3. Assert that no file uses `campaigns.source`, `campaigns.simulation_flag`, `campaigns.campaignProfile`, `campaigns.simulationConfig`
4. Assert that all campaign queries in these files use `publicCampaignSelect` or an explicit safe subset

---

## 7. Backend Logic

### 7.1 Simulation Engine Modifications

**File**: `src/lib/seed/simulation-engine.ts`

#### 7.1.1 Replace `SEED_MODE_ENABLED` env var with `siteSettings`

**Current** (in `src/app/api/v1/cron/simulate-donations/route.ts`):
```typescript
if (process.env.SEED_MODE_ENABLED !== 'true') {
  return NextResponse.json({ ok: true, data: { skipped: true, reason: 'SEED_MODE_ENABLED is not true' } });
}
```

**New**:
```typescript
import { getSetting } from '@/lib/settings.server';

const simulationEnabled = await getSetting('simulation.enabled');
if (!simulationEnabled) {
  return NextResponse.json({ ok: true, data: { skipped: true, reason: 'Simulation disabled via admin settings' } });
}
```

#### 7.1.2 Query Only Simulated Campaigns

**Current** (in `simulation-engine.ts` â†’ `runSimulation()`):
```typescript
const activeCampaigns = await db
  .select()
  .from(schema.campaigns)
  .where(inArray(schema.campaigns.status, ['active', 'last_donor_zone']));
```

**New**:
```typescript
const activeCampaigns = await db
  .select()
  .from(schema.campaigns)
  .where(
    and(
      inArray(schema.campaigns.status, ['active', 'last_donor_zone']),
      eq(schema.campaigns.simulationFlag, true),
    ),
  );
```

**Why**: The simulation engine must ONLY seed donations on simulated campaigns. Previously it ran on all campaigns â€” including manually created ones. This was acceptable when all campaigns were simulated, but with real user campaigns it would create seed donations on real campaigns, which is wrong.

#### 7.1.3 Apply Volume Scaling

**New logic in `runSimulation()`**:
```typescript
const volume = await getSetting('simulation.volume') as number;
const enabledCategories = await getSetting('simulation.categories') as string[];

// Filter to only enabled categories
const eligibleCampaigns = activeCampaigns.filter(c =>
  enabledCategories.includes(c.category)
);

// Apply volume scaling to shouldDonateThisCycle
// Volume multiplier is applied as an additional factor to the probability
```

Inside `shouldDonateThisCycle()`, add `volumeMultiplier` parameter:
```typescript
function shouldDonateThisCycle(
  campaign: Campaign,
  profile: TrajectoryProfile | null,
  currentPhase: DonationPhase,
  surgeMultiplier: number,
  volumeMultiplier: number,  // NEW
): boolean {
  // ... existing logic ...
  const effectiveChance = profile.baseDonateChance * phaseMultiplier * hourly * surgeMultiplier * volumeMultiplier;
  return Math.random() < Math.min(effectiveChance, 1.0);
}
```

#### 7.1.4 Per-Campaign Pause Check

```typescript
for (const campaign of eligibleCampaigns) {
  const config = campaign.simulationConfig as SimulationConfig | null;
  if (config?.paused) continue;

  const campaignVolume = config?.volumeOverride ?? volume;
  // ... proceed with seed logic using campaignVolume
}
```

#### 7.1.5 Update Phase Transitions Cron

**File**: `src/app/api/v1/cron/update-phases/route.ts`

The update-phases cron generates organizer updates for active campaigns. It should continue running on ALL campaigns (both simulated and real) since both need periodic updates. However, updates for real campaigns should come from real organizers, not AI.

**Logic change**:
```typescript
for (const campaign of activeCampaigns) {
  if (!campaign.campaignOrganizer) continue;

  // Only auto-generate organizer updates for simulated campaigns
  if (!campaign.simulationFlag) continue;  // NEW: skip real campaigns

  const due = await isOrganizerUpdateDue(campaign.id);
  if (due) {
    await generateOrganizerUpdate(campaign);
    updatesGenerated++;
  }
}
```

### 7.2 News Pipeline Modifications

**File**: `src/lib/news/news-pipeline.ts`

#### 7.2.1 Set `simulation_flag` on Auto-Created Campaigns

In the campaign insertion (Step 8):
```typescript
const [campaign] = await db
  .insert(schema.campaigns)
  .values({
    title: campaignTitle,
    slug,
    status: 'active',
    heroImageUrl,
    storyHtml,
    goalAmount: goalAmountCents,
    category: entity.category,
    location: entity.hometown,
    subjectName: entity.name,
    subjectHometown: entity.hometown,
    impactTiers,
    campaignProfile: generateTrajectoryProfile(entity.category as CampaignCategory, goalAmountCents),
    campaignOrganizer,
    source: 'automated',
    simulationFlag: true,           // NEW
    simulationConfig: {              // NEW
      paused: false,
      fundAllocation: 'pool',
    },
    publishedAt: new Date(),
  })
  .returning({ id: schema.campaigns.id });
```

#### 7.2.2 Respect Max Concurrent Limit

Before creating new simulated campaigns, check:
```typescript
const maxConcurrent = await getSetting('simulation.max_concurrent') as number;
const [currentSimulated] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(schema.campaigns)
  .where(
    and(
      eq(schema.campaigns.simulationFlag, true),
      inArray(schema.campaigns.status, ['active', 'last_donor_zone']),
    ),
  );

if (currentSimulated.count >= maxConcurrent) {
  result.errors.push(`Max concurrent simulated campaigns (${maxConcurrent}) reached`);
  break;
}
```

### 7.3 Seed Data Sanitization

#### 7.3.1 Fake Stripe IDs â€” Make Indistinguishable

**Current**: `seed_${crypto.randomUUID()}`

**Problem**: The `seed_` prefix makes it trivially distinguishable from real Stripe payment intent IDs (which start with `pi_`).

**New**: Generate IDs that mimic Stripe's format:
```typescript
function generateRealisticPaymentId(): string {
  // Stripe pi_ IDs are 'pi_' + 24-char alphanumeric
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'pi_';
  for (let i = 0; i < 24; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
```

**Where to change**: `src/lib/seed/simulation-engine.ts` â€” replace all `seed_${crypto.randomUUID()}` with `generateRealisticPaymentId()`.

**Impact on reconciliation**: The reconciliation cron (`/api/v1/cron/reconcile`) queries donations by `source` column (`'seed'` vs `'real'`), NOT by `stripePaymentId` prefix. So this change is safe.

**Impact on Stripe API**: The fake IDs will never be sent to Stripe's API. They're only stored in our DB. Stripe webhook handler matches by `paymentIntent.id` from Stripe events, which are always real.

#### 7.3.2 Fake Donor Emails â€” Make Indistinguishable

**Current**: `seed-${crypto.randomUUID().slice(0, 8)}@lastdonor.internal`

**Problem**: The `@lastdonor.internal` domain makes it distinguishable.

**New**: Generate realistic-looking emails from the donor's name:
```typescript
function generateRealisticEmail(donorName: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];

  // Generate username from donor name
  const nameParts = donorName.toLowerCase().split(/\s+/);
  const styles = [
    () => `${nameParts[0]}${nameParts[nameParts.length - 1] ?? ''}${Math.floor(Math.random() * 99)}`,
    () => `${nameParts[0]}.${nameParts[nameParts.length - 1] ?? ''}`,
    () => `${nameParts[0]}${Math.floor(Math.random() * 999)}`,
    () => `${nameParts[0][0]}${nameParts[nameParts.length - 1] ?? ''}${Math.floor(Math.random() * 9)}`,
  ];
  const username = styles[Math.floor(Math.random() * styles.length)]();

  return `${username.replace(/[^a-z0-9.]/g, '')}@${domain}`;
}
```

**Where to change**: `src/lib/seed/simulation-engine.ts` â€” replace the `seed-xxx@lastdonor.internal` pattern.

**IMPORTANT**: These emails must NEVER be used for outbound email. The Stripe webhook handler sends receipt emails to `donorEmail` â€” but only for `source='real'` donations. Seed donations never trigger the webhook (they bypass Stripe). So this is safe.

#### 7.3.3 Existing Seed Data Migration

Backfill existing seed data to remove distinguishable patterns:
```sql
-- Update existing seed Stripe IDs to realistic format
UPDATE donations
SET stripe_payment_id = 'pi_' || encode(gen_random_bytes(18), 'hex')
WHERE source = 'seed' AND stripe_payment_id LIKE 'seed_%';

-- Update existing seed emails to realistic format
-- (Complex â€” do this in application code during migration)
```

---

## 8. Donation Routing & Fund Pooling

### 8.1 Approach A â€” Fund Pooling Implementation

When a real user donates to a simulated campaign:
1. The Stripe PaymentIntent is created **normally** â€” real money moves.
2. The donation is recorded with `source: 'real'` â€” it's a real donation.
3. A `fund_pool_allocations` record is created â€” tracking that this money entered via a simulated campaign.
4. The platform will attempt to locate the real person/entity (from the news article) and deliver funds.
5. If undeliverable, funds are redistributed to real campaigns.

### 8.2 Donation Router â€” Modified `create-intent`

**File**: `src/app/api/v1/donations/create-intent/route.ts`

**Current flow**: Fetch campaign (safe fields), create Stripe intent, return client secret.

**New flow**:
```typescript
// Fetch campaign with simulation_flag (INTERNAL query â€” not public)
const [campaign] = await db
  .select({
    id: campaigns.id,
    title: campaigns.title,
    status: campaigns.status,
    simulationFlag: campaigns.simulationFlag,  // INTERNAL USE ONLY
  })
  .from(campaigns)
  .where(
    and(
      eq(campaigns.id, data.campaignId),
      or(
        eq(campaigns.status, 'active'),
        eq(campaigns.status, 'last_donor_zone'),
      ),
    ),
  )
  .limit(1);

// ... validate campaign exists ...

// Create Stripe PaymentIntent â€” IDENTICAL regardless of campaign type
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: data.amount,
    currency: 'usd',
    metadata: {
      campaignId: data.campaignId,
      donorName: data.donorName || 'Anonymous',
      donorEmail: data.donorEmail,
      donorLocation: data.donorLocation ?? '',
      message: data.message ?? '',
      isAnonymous: String(data.isAnonymous),
      isRecurring: String(data.isRecurring),
      fundPool: campaign.simulationFlag ? 'true' : 'false',  // INTERNAL tag â€” stored in Stripe metadata
    },
  },
  data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : undefined,
);

// Response is IDENTICAL
const response: ApiResponse<{
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  campaignTitle: string;
}> = {
  ok: true,
  data: {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    amount: data.amount,
    campaignTitle: campaign.title,
  },
};
```

### 8.3 Webhook Handler â€” Fund Pool Tracking

**File**: `src/app/api/v1/donations/webhook/route.ts`

In `handlePaymentSuccess()`, after inserting the donation, add:

```typescript
// Check if this donation went to a simulated campaign
const isFundPool = meta.fundPool === 'true';

if (isFundPool) {
  await tx.insert(fundPoolAllocations).values({
    donationId: donationRecord.id,
    sourceCampaignId: campaignId,
    amount,
    status: 'pending',
  });

  // Audit log for fund pool
  await tx.insert(auditLogs).values({
    eventType: 'fund_pool.donation_received',
    targetType: 'donation',
    targetId: campaignId,
    severity: 'info',
    details: { amount, donorEmail, campaignId, paymentIntentId: paymentIntent.id },
  });
}
```

### 8.4 Fund Allocation Admin API

**New route**: `POST /api/v1/admin/fund-pool/allocate`

Allows admins to:
1. View pending fund pool allocations
2. Allocate funds to specific real campaigns
3. Mark allocations as disbursed
4. Auto-allocate based on category matching

### 8.5 Reconciliation Cron Update

The daily reconciliation cron should also reconcile fund pool allocations:
- Sum pending allocations
- Generate admin notifications if pool exceeds threshold
- Auto-allocate to real campaigns if `simulation.fund_pool.auto_allocate` is enabled

---

## 9. Messaging System

### 9.1 System Design

The messaging system enables donors to "leave a message" on a campaign. It is a **public wall** â€” anyone who visits the campaign can see messages. Only donors can post messages (either at donation time or independently if authenticated). Campaign runners can post updates (existing `campaign_updates` system) but do NOT respond to individual messages.

### 9.2 Message Types

| Type | Who Posts | Visibility | Storage |
|------|----------|------------|---------|
| **Donation message** | Any donor (via donation form) | Public wall | `campaign_messages` table + `donations.message` |
| **Standalone message** | Authenticated donors only | Public wall | `campaign_messages` table |
| **Campaign update** | Campaign organizer (or AI for simulated) | Updates timeline | `campaign_updates` table (existing) |

### 9.3 API Routes

#### 9.3.1 `GET /api/v1/campaigns/[slug]/messages`

Returns paginated messages for a campaign.

```typescript
// Query with public-safe select, filtering hidden/flagged
const messages = await db
  .select(publicMessageSelect)
  .from(campaignMessages)
  .where(
    and(
      eq(campaignMessages.campaignId, campaign.id),
      eq(campaignMessages.hidden, false),
    ),
  )
  .orderBy(desc(campaignMessages.createdAt))
  .offset(offset)
  .limit(limit + 1);
```

**Response shape** (identical for all campaign types):
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "donorName": "Sarah J.",
      "donorLocation": "Portland, OR",
      "message": "Praying for your family",
      "isAnonymous": false,
      "createdAt": "2026-03-25T10:30:00Z"
    }
  ],
  "meta": { "cursor": "20", "hasMore": true }
}
```

#### 9.3.2 `POST /api/v1/campaigns/[slug]/messages`

Allows authenticated users to post a standalone message.

**Validation**:
- User must be authenticated
- Message: 1â€“500 characters, sanitized (strip HTML)
- Rate limit: 5 messages per campaign per user per day
- Campaign must be active or last_donor_zone or completed (allow messages on completed campaigns)

**Request body**:
```json
{
  "message": "Keep fighting, we're all behind you!",
  "isAnonymous": false
}
```

**Logic**:
```typescript
const session = await auth();
if (!session?.user) return 401;

const [campaign] = await db
  .select({ id: campaigns.id, status: campaigns.status })
  .from(campaigns)
  .where(eq(campaigns.slug, slug))
  .limit(1);

if (!campaign || !['active', 'last_donor_zone', 'completed'].includes(campaign.status)) {
  return 404;
}

// Rate limit check
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const [recentCount] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(campaignMessages)
  .where(
    and(
      eq(campaignMessages.campaignId, campaign.id),
      eq(campaignMessages.userId, session.user.id),
      gte(campaignMessages.createdAt, oneDayAgo),
    ),
  );

if (recentCount.count >= 5) return 429;

// Insert message
await db.insert(campaignMessages).values({
  campaignId: campaign.id,
  userId: session.user.id,
  donorName: body.isAnonymous ? 'Anonymous' : session.user.name ?? 'Donor',
  donorLocation: session.user.location ?? null,
  message: sanitizeText(body.message),
  isAnonymous: body.isAnonymous,
});
```

#### 9.3.3 `POST /api/v1/admin/campaigns/[campaignId]/messages/[messageId]/moderate`

Admin-only endpoint to flag or hide messages.

```json
{
  "action": "flag" | "hide" | "unhide"
}
```

### 9.4 Donation Form Integration

When a donor includes a message in the donation form, the webhook handler should ALSO create a `campaign_messages` record:

**In `handlePaymentSuccess()`** (webhook):
```typescript
if (message) {
  await tx.insert(campaignMessages).values({
    campaignId,
    userId: user?.id ?? null,
    donorName: isAnonymous ? 'Anonymous' : donorName,
    donorLocation: isAnonymous ? null : donorLocation,
    message,
    isAnonymous,
    donationId: donationRecord.id,
  });
}
```

### 9.5 Seed Message Integration

The simulation engine already generates messages via `pickSeedMessage()`. These messages should also be inserted into `campaign_messages`:

**In `simulation-engine.ts`**, when inserting a seed donation that has a message:
```typescript
if (message) {
  await db.insert(schema.campaignMessages).values({
    campaignId: campaign.id,
    donorName: donor.displayName,
    donorLocation: donor.displayLocation || null,
    message,
    isAnonymous: donor.isAnonymous,
    donationId: donationRecord.id,
    createdAt: donationTime,  // Use jittered time for consistency
  });
}
```

### 9.6 Frontend Components

#### 9.6.1 `MessageWall` Component

Displays messages on the campaign page. Polls for new messages (similar to `DonorFeed`).

**Props**: `campaignSlug: string`, `initialMessages: PublicMessage[]`

**Features**:
- Paginated list with "Load more" button
- New message toast notification when polling detects new messages
- Avatar circle with initial letter (same as DonorFeed)
- Relative time display ("2 hours ago")
- Message text with max display height and "Read more" expansion

#### 9.6.2 `MessageForm` Component

Inline form at the top of the message wall for authenticated users to post.

**Props**: `campaignSlug: string`, `campaignId: string`

**Features**:
- Text input (max 500 chars) with character counter
- Anonymous toggle (same Switch component as DonationForm)
- Submit button with loading state
- Success toast on submission
- Empty state: "Be the first to leave a message of support"
- Unauthenticated state: "Sign in to leave a message" with link to `/login`

#### 9.6.3 Campaign Page Integration

Add MessageWall below the DonorFeed section:
```tsx
{/* Messages */}
<MessageWall
  campaignSlug={slug}
  initialMessages={initialMessages}
/>
```

### 9.7 Admin Message Moderation

Admin panel section for reviewing flagged messages:

**Route**: `/admin/campaigns/[campaignId]/messages`

**Features**:
- List of all messages sorted by recent
- Filter: all / flagged / hidden
- Actions: flag, hide, unhide
- Audit log entry for each action
- Notification to user if message hidden (notification type: `message_flagged`)

---

## 10. Frontend Layer

### 10.1 Core Principle: Architectural Incapability

The frontend must be **architecturally incapable** of knowing whether a campaign is simulated. This means:

1. **No TypeScript type in `src/types/` that includes `simulation_flag` is imported in any `src/app/` or `src/components/` file** â€” the `PublicCampaign` type is used instead.
2. **No API response or SSR data includes `simulation_flag`, `source`, `campaignProfile`, or `simulation_config`**.
3. **No conditional rendering** based on campaign type.
4. **No feature flags** in frontend code that toggle simulation behavior.
5. **Campaign detail page, donation form, donor feed, message wall, progress bar, phase badge, impact tiers, updates timeline â€” all treat every campaign identically**.

### 10.2 Component Audit â€” No Changes Needed

| Component | File | Simulation-Aware? | Action |
|-----------|------|--------------------|--------|
| `CampaignCard` | `src/components/campaign/CampaignCard.tsx` | No â€” uses safe props | None |
| `CampaignGrid` | `src/components/campaign/CampaignGrid.tsx` | No | None |
| `CampaignHeroImage` | `src/components/campaign/CampaignHeroImage.tsx` | No | None |
| `CampaignUpdates` | `src/components/campaign/CampaignUpdates.tsx` | No | None |
| `DonationForm` | `src/components/campaign/DonationForm.tsx` | No â€” calls `/create-intent` identically | None |
| `DonorFeed` | `src/components/campaign/DonorFeed.tsx` | No â€” polls safe donor data | None |
| `ImpactTiers` | `src/components/campaign/ImpactTiers.tsx` | No | None |
| `PhaseBadge` | `src/components/campaign/PhaseBadge.tsx` | No | None |
| `ProgressBar` | `src/components/campaign/ProgressBar.tsx` | No | None |
| `ShareButtons` | `src/components/campaign/ShareButtons.tsx` | No | None |
| `StickyMobileDonateBar` | `src/components/campaign/StickyMobileDonateBar.tsx` | No | None |

### 10.3 Data Flow â€” Frontend Perspective

```
Server Component (page.tsx):
  â†’ getCampaign(slug) â†’ db.select(publicCampaignSelect) â†’ PublicCampaign
  â†’ getRecentDonors(id) â†’ db.select(publicDonationSelect) â†’ PublicDonation[]
  â†’ getMessages(id) â†’ db.select(publicMessageSelect) â†’ PublicMessage[]
  â†’ getUpdates(id) â†’ safe select â†’ CampaignUpdate[]

  â†’ Render:
    <CampaignHeroImage src={campaign.heroImageUrl} />
    <ProgressBar raisedAmount={campaign.raisedAmount} goalAmount={campaign.goalAmount} />
    <DonationForm campaignId={campaign.id} campaignTitle={campaign.title} />
    <DonorFeed campaignSlug={slug} initialDonors={recentDonors} />
    <MessageWall campaignSlug={slug} initialMessages={messages} />
    <CampaignUpdates updates={formattedUpdates} />

  â†’ NO campaign.source, NO campaign.simulationFlag anywhere in the component tree
```

---

## 11. Admin Simulation Controls

### 11.1 New Admin Section

**Route**: `/admin/simulation`

**Access**: Admin role only (not editor)

### 11.2 Control Panel Layout

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Simulation Control                                  [Admin Only]â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€ Global Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Simulation Active:  [ON/OFF toggle]                        â”‚ â”‚
â”‚  â”‚  Volume:             [======â-=========] 70%                  â”‚ â”‚
â”‚  â”‚  Max Concurrent:     [20] campaigns                         â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€ Category Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  â˜‘ Medical         â˜‘ Disaster        â˜‘ Military              â”‚ â”‚
â”‚  â”‚  â˜‘ Veterans        â˜‘ Memorial        â˜‘ First-Responders      â”‚ â”‚
â”‚  â”‚  â˜‘ Community       â˜‘ Essential-Needs â˜ Emergency              â”‚ â”‚
â”‚  â”‚  â˜ Education       â˜ Animal          â˜ Faith                  â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€ Phase-Out Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Auto Phase-Out:    [ON/OFF toggle]                         â”‚ â”‚
â”‚  â”‚  Current Real Active Campaigns: 12                          â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Threshold Low   (â†’ 70% volume):  [10] campaigns            â”‚ â”‚
â”‚  â”‚  Threshold Mid   (â†’ 30% volume):  [25] campaigns            â”‚ â”‚
â”‚  â”‚  Threshold High  (â†’ stop new):    [50] campaigns            â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Current Auto-Volume: 70% (12 real > threshold_low)          â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€ Fund Pool â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Pending Allocations:  $2,450.00 (14 donations)             â”‚ â”‚
â”‚  â”‚  Allocated:            $1,200.00 (8 donations)              â”‚ â”‚
â”‚  â”‚  Disbursed:            $800.00 (5 donations)                â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  [View All] [Auto-Allocate] [Export Report]                 â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€ Active Simulated Campaigns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Campaign                    Progress  Status   Actions      â”‚ â”‚
â”‚  â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”€â”€â”€â”€â”€â”€â”€â”€ â”€â”€â”€â”€â”€â”€â”€â”€ â”€â”€â”€â”€â”€â”€â”€â”€â”€     â”‚ â”‚
â”‚  â”‚  Help for Sarah's Family     72%      active   [Pause][Conv] â”‚ â”‚
â”‚  â”‚  Disaster Relief: TX Flood   45%      active   [Pause][Conv] â”‚ â”‚
â”‚  â”‚  Memorial: Officer Davis     91%      LDZ      [Pause][Conv] â”‚ â”‚
â”‚  â”‚  [...]                                                       â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Total: 18 active    2 paused    5 completed this month     â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  Simulated Campaigns: 18 active / 45 all-time               â”‚ â”‚
â”‚  â”‚  Real Campaigns:      12 active / 8 all-time                â”‚ â”‚
â”‚  â”‚  Seed Donations:      2,340 ($47,800.00)                    â”‚ â”‚
â”‚  â”‚  Real Donations:      89 ($4,250.00)                        â”‚ â”‚
â”‚  â”‚  Seed-to-Real Ratio:  26.3:1 (declining â†“)                 â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â”‚  [Detailed Report] [Export CSV]                              â”‚ â”‚
â”‚  â”‚                                                              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 11.3 Campaign Conversion

The "Convert" action on a simulated campaign transitions it to a real campaign:
1. Sets `simulation_flag = false`
2. Clears `simulation_config`
3. Stops seed donations for this campaign
4. Assigns a real beneficiary (admin enters contact info)
5. Audit log entry
6. All existing seed donations remain (they're part of the campaign's history)
7. All existing real donations remain and continue to be tracked normally

### 11.4 Admin API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/admin/simulation/settings` | GET | Get all simulation settings |
| `/api/v1/admin/simulation/settings` | PUT | Update simulation settings |
| `/api/v1/admin/simulation/campaigns` | GET | List active simulated campaigns with stats |
| `/api/v1/admin/simulation/campaigns/[id]/pause` | POST | Pause seed activity for a campaign |
| `/api/v1/admin/simulation/campaigns/[id]/resume` | POST | Resume seed activity for a campaign |
| `/api/v1/admin/simulation/campaigns/[id]/convert` | POST | Convert simulated â†’ real campaign |
| `/api/v1/admin/simulation/analytics` | GET | Simulation vs real analytics |
| `/api/v1/admin/fund-pool` | GET | List fund pool allocations |
| `/api/v1/admin/fund-pool/allocate` | POST | Allocate pooled funds to real campaign |
| `/api/v1/admin/fund-pool/disburse` | POST | Mark allocation as disbursed |
| `/api/v1/admin/fund-pool/export` | GET | Export fund pool report (CSV) |

### 11.5 Admin Sidebar Update

Add "Simulation" section to admin sidebar (visible to admin role only):

```typescript
// In AdminSidebar.tsx
if (role === 'admin') {
  sidebarItems.push({
    label: 'Simulation',
    icon: AdjustmentsHorizontalIcon,
    href: '/admin/simulation',
    children: [
      { label: 'Controls', href: '/admin/simulation' },
      { label: 'Fund Pool', href: '/admin/simulation/fund-pool' },
      { label: 'Analytics', href: '/admin/simulation/analytics' },
    ],
  });
}
```

---

## 12. Phase-Out Strategy

### 12.1 Metric-Driven Auto-Scaling

When `simulation.phase_out.enabled` is `true`, the system automatically adjusts simulation volume based on real campaign activity:

```typescript
async function calculateAutoVolume(): Promise<number> {
  const thresholds = {
    low: await getSetting('simulation.phase_out.threshold_low') as number,
    mid: await getSetting('simulation.phase_out.threshold_mid') as number,
    high: await getSetting('simulation.phase_out.threshold_high') as number,
  };

  const [realCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.simulationFlag, false),
        inArray(campaigns.status, ['active', 'last_donor_zone']),
      ),
    );

  const realCampaigns = realCount.count;

  if (realCampaigns >= thresholds.high) return 0.0;   // Stop all simulation
  if (realCampaigns >= thresholds.mid) return 0.3;
  if (realCampaigns >= thresholds.low) return 0.7;
  return 1.0; // Full simulation
}
```

### 12.2 Phase-Out Stages

| Stage | Trigger | Actions |
|-------|---------|---------|
| **Full Simulation** | < 10 real campaigns | Volume = 1.0, all categories active |
| **Reduced** | â‰¥ 10 real campaigns | Volume = 0.7, slower progression |
| **Minimal** | â‰¥ 25 real campaigns | Volume = 0.3, only low-activity categories |
| **New Simulations Stopped** | â‰¥ 50 real campaigns | No new simulated campaigns; existing ones complete naturally |
| **Full Phase-Out** | All simulated campaigns completed/archived | `simulation.enabled` = false |

### 12.3 Graceful Completion

When new simulations are stopped, existing simulated campaigns continue their lifecycle:
- Seed donations continue at reduced volume
- Phase transitions complete normally
- Campaigns reach goal and complete
- After completion, auto-archive after 90 days (existing reconciliation cron)
- Eventually all simulated campaigns are archived â†’ full phase-out

### 12.4 Cleanup

Once all simulated campaigns are archived and no longer publicly visible:
1. Optionally purge seed donation records (via existing `/api/v1/admin/seed/purge`)
2. Or retain for historical analytics
3. The `simulation_flag` column remains but all values are `false` for active campaigns

---

## 13. Risk Matrix & Mitigations

### 13.1 Risk Assessment

| # | Risk | Severity | Likelihood | Impact | Mitigation |
|---|------|----------|------------|--------|------------|
| R1 | API response exposes `source` or `simulation_flag` | Critical | Medium | Platform integrity destroyed | Query sanitization layer + automated test enforcement |
| R2 | Real user donates to simulated campaign; fund misallocation | Critical | High | Legal liability, donor trust loss | Fund pooling system + ToS language + admin tracking |
| R3 | Seed donor names or patterns detected statistically | High | Low | Social media exposure | 3000+ donor pool, realistic distribution, 8% repeat rate |
| R4 | Donation timestamps reveal cron intervals | High | Low | Pattern detection | Already mitigated: jittered timestamps across 15-min window |
| R5 | Admin/insider leaks simulation existence | High | Low | PR catastrophe | Audit logging, access controls, limit admin access to `simulation_flag` |
| R6 | Journalist analyzes donation distribution | High | Low | Statistical exposure | Trajectory profiles ensure varied pacing; psychological pricing |
| R7 | React DevTools inspects campaign props | Medium | Low | Developer discovers `source` in props | `publicCampaignSelect` strips internal fields before SSR |
| R8 | Stripe ID prefix (`seed_`) analyzed in DB dumps | Medium | Low | Internal audit risk | Replace with realistic `pi_` format |
| R9 | Seed email domain (`@lastdonor.internal`) discovered | Medium | Low | Internal audit risk | Replace with realistic email generation |
| R10 | Fund pool grows large without allocation | Medium | Medium | Financial liability | Admin dashboard alerts, auto-allocate option |
| R11 | Legal challenge: donors claim deception | Critical | Low | Lawsuit, regulatory action | ToS: "donations may be allocated to verified campaigns"; legal review |
| R12 | Simulated campaign subject unreachable | Medium | High | Funds undeliverable | Default to pool redistribution; admin workflow for beneficiary location |
| R13 | Message wall spam or abuse | Medium | Medium | Platform quality degradation | Rate limiting (5/day/user/campaign), moderation tools, hide capability |
| R14 | Simulation settings misconfigured | Medium | Low | Over/under simulation | Validation on settings endpoints; audit log for changes |

### 13.2 Compliance & Legal Requirements

1. **Terms of Service**: Must include language about fund allocation â€” "donations support verified campaigns and beneficiaries; in some cases, funds may be allocated to campaigns with the greatest need"
2. **Tax receipts**: All real donations (even to simulated campaigns) generate valid 501(c)(3) tax receipts. The receipt references the platform, not the specific campaign beneficiary.
3. **Privacy**: Simulated donor data is not real PII. No privacy concern.
4. **Financial reporting**: Fund pool allocations must be tracked for nonprofit financial reporting. The `fund_pool_allocations` table provides the audit trail.

---

## 14. Testing Strategy

### 14.1 Unit Tests

| Test | Purpose | File |
|------|---------|------|
| `publicCampaignSelect` never includes internal fields | Schema enforcement | `test/security/query-sanitization.test.ts` |
| Simulation engine only queries `simulation_flag=true` campaigns | Engine isolation | `src/lib/seed/simulation-engine.test.ts` |
| Fund pool allocation creates records correctly | Financial integrity | `test/fund-pool.test.ts` |
| Realistic Stripe ID format passes validation | ID indistinguishability | `src/lib/seed/simulation-engine.test.ts` |
| Realistic email format passes validation | Email indistinguishability | `src/lib/seed/simulation-engine.test.ts` |
| Message rate limiting enforced | Anti-spam | `src/app/api/v1/campaigns/[slug]/messages/route.test.ts` |
| Settings defaults are correct | Configuration | `src/lib/settings.test.ts` |

### 14.2 Integration Tests

| Test | Purpose | File |
|------|---------|------|
| `GET /api/v1/campaigns/[slug]` does NOT include `source`, `simulation_flag`, `campaignProfile` | API response sanitization | `src/app/api/v1/campaigns/campaigns.integration.test.ts` |
| `GET /api/v1/campaigns` does NOT include internal fields | API list sanitization | Same file |
| `POST /create-intent` works identically for simulated and real campaigns | Donation parity | `src/app/api/v1/donations/donations.integration.test.ts` |
| Webhook creates fund pool allocation for simulated campaign donations | Fund tracking | Same file |
| `GET /api/v1/campaigns/[slug]/messages` returns messages correctly | Messaging API | `src/app/api/v1/campaigns/messages.integration.test.ts` |
| `POST /api/v1/campaigns/[slug]/messages` rate limits correctly | Anti-spam | Same file |
| Admin simulation settings CRUD | Admin controls | `src/app/api/v1/admin/simulation.integration.test.ts` |
| Campaign conversion (simulated â†’ real) | Conversion flow | Same file |

### 14.3 Adversarial Tests

| Test | Purpose |
|------|---------|
| **API response audit** | Automated scanner checks every public API response body for strings: `simulation`, `seed`, `simulated`, `automated` (in field names) |
| **Statistical donation analysis** | Analyze generated donation timestamps for cron-aligned clustering â€” expect uniform distribution within 15-min windows |
| **Donor name uniqueness** | Verify that across 1000 simulated donations, no more than expected rate of name repetition (â‰¤10%) |
| **Stripe ID format** | Verify all donation `stripePaymentId` values match `^pi_[A-Za-z0-9]{24}$` pattern |
| **Email domain diversity** | Verify seed donor emails use diverse realistic domains |
| **Cross-campaign pattern** | Verify no systematic difference in response shapes between campaigns with `simulation_flag=true` and `simulation_flag=false` |

### 14.4 E2E Tests

| Test | File | Scenario |
|------|------|----------|
| Donate to simulated campaign | `e2e/e2e-16-dual-campaign.spec.ts` | Real payment flow on simulated campaign |
| Leave message on campaign | `e2e/e2e-17-messaging.spec.ts` | Post and view messages |
| Admin simulation controls | `e2e/e2e-18-admin-simulation.spec.ts` | Toggle, volume, pause, convert |
| Campaign page renders identically | `e2e/e2e-19-indistinguishability.spec.ts` | Visual comparison of simulated vs real campaign pages |

---

## 15. Milestone Breakdown

### Milestone 7: Dual Campaign System â€” Foundation

**Scope**: Schema changes, query sanitization, simulation engine hardening

#### 7.1 Database Migration
- [ ] Create migration file `0013_dual_campaign_system.sql`
- [ ] Add `simulation_flag` column to `campaigns` table
- [ ] Add `simulation_config` JSONB column to `campaigns` table
- [ ] Create `fund_pool_allocations` table
- [ ] Create `campaign_messages` table
- [ ] Add notification types (`new_message`, `message_flagged`)
- [ ] Seed simulation settings into `siteSettings`
- [ ] Backfill: `UPDATE campaigns SET simulation_flag = TRUE WHERE source = 'automated'`
- [ ] Add Drizzle schema definitions for new tables/columns
- [ ] Add TypeScript types for new tables in `src/types/index.ts`
- [ ] Run migration and verify

#### 7.2 Query Sanitization Layer
- [ ] Create `src/db/public-select.ts` with `publicCampaignSelect`, `publicCampaignCardSelect`, `publicDonationSelect`, `publicMessageSelect`
- [ ] Create `src/types/public.ts` with `PublicCampaign`, `PublicDonation`, `PublicMessage` types
- [ ] Update `src/app/campaigns/[slug]/page.tsx` â†’ `getCampaign()` to use `publicCampaignSelect`
- [ ] Update `src/app/api/v1/campaigns/[slug]/route.ts` â†’ `GET` to use `publicCampaignSelect`
- [ ] Verify `src/app/api/v1/campaigns/route.ts` â†’ `GET` uses safe selection (already uses explicit select â€” verify no `source` or `campaignProfile`)
- [ ] Verify `getRelatedCampaigns()` in campaign page uses safe selection
- [ ] Audit all other files that query campaigns for public display (homepage, search, sitemap, OG image)
- [ ] Create `test/security/query-sanitization.test.ts` â€” grep-based test that scans all public routes for internal field access
- [ ] Write automated test: no public API response contains `simulation_flag`, `source` (campaign-level), or `campaignProfile` keys

#### 7.3 Simulation Engine Hardening
- [ ] Replace `SEED_MODE_ENABLED` env var check with `getSetting('simulation.enabled')` in simulate-donations cron
- [ ] Add `simulation.enabled` to settings type definitions (`src/lib/settings.ts`)
- [ ] Add all simulation settings keys to `SettingsMap` interface
- [ ] Modify `runSimulation()` to query only `simulation_flag = true` campaigns
- [ ] Add `volumeMultiplier` parameter to `shouldDonateThisCycle()`
- [ ] Read `simulation.volume` from settings and pass to engine
- [ ] Read `simulation.categories` from settings and filter campaigns
- [ ] Add per-campaign pause check via `simulation_config.paused`
- [ ] Modify update-phases cron to skip real campaigns (`simulation_flag = false`)
- [ ] Update simulation engine tests for new filter/volume/pause behavior

#### 7.4 Seed Data Sanitization
- [ ] Create `generateRealisticPaymentId()` function (mimics `pi_` + 24 alphanumeric)
- [ ] Create `generateRealisticEmail()` function (name-based + common domains)
- [ ] Replace all `seed_${crypto.randomUUID()}` with `generateRealisticPaymentId()` in simulation engine
- [ ] Replace all `seed-xxx@lastdonor.internal` with `generateRealisticEmail()` in simulation engine
- [ ] Create data migration to update existing seed records:
  - Update `stripePaymentId` from `seed_*` to `pi_*` format
  - Update `donorEmail` from `*@lastdonor.internal` to realistic format
- [ ] Update simulation engine tests for new ID/email format
- [ ] Verify reconciliation cron still works (queries by `source` column, not ID prefix)

#### 7.5 News Pipeline Update
- [ ] Modify campaign insertion in `news-pipeline.ts` to set `simulation_flag = true`
- [ ] Set `simulation_config = { paused: false, fundAllocation: 'pool' }` on new campaigns
- [ ] Add max concurrent check before creating new simulated campaigns
- [ ] Update pipeline tests

---

### Milestone 8: Donation Routing & Fund Pool

**Scope**: Real donations on simulated campaigns, fund tracking

#### 8.1 Donation Router
- [ ] Modify `create-intent` route to fetch campaign WITH `simulation_flag` (internal query)
- [ ] Add `fundPool: 'true'` metadata to Stripe PaymentIntent for simulated campaigns
- [ ] Verify response shape is IDENTICAL for both campaign types
- [ ] Write integration test: create-intent returns same shape for both types

#### 8.2 Webhook Handler
- [ ] Modify `handlePaymentSuccess()` to check `fundPool` metadata
- [ ] Insert `fund_pool_allocations` record for fund pool donations
- [ ] Audit log entry for fund pool donations
- [ ] Ensure receipt email is sent (identical to normal donations)
- [ ] Write integration test: webhook creates fund pool allocation

#### 8.3 Fund Pool Admin API
- [ ] Create `GET /api/v1/admin/fund-pool` â€” list allocations with pagination, filters
- [ ] Create `POST /api/v1/admin/fund-pool/allocate` â€” allocate to real campaign
- [ ] Create `POST /api/v1/admin/fund-pool/disburse` â€” mark as disbursed
- [ ] Create `GET /api/v1/admin/fund-pool/export` â€” CSV export
- [ ] Add fund pool summary to admin dashboard
- [ ] Write integration tests for all fund pool endpoints

#### 8.4 Reconciliation Update
- [ ] Add fund pool reconciliation to daily cron
- [ ] Generate admin notification if pending pool exceeds threshold
- [ ] Add auto-allocate logic (when `simulation.fund_pool.auto_allocate` is enabled)

---

### Milestone 9: Messaging System

**Scope**: Complete message wall feature

#### 9.1 Message API Routes
- [ ] Create `GET /api/v1/campaigns/[slug]/messages` â€” paginated messages
- [ ] Create `POST /api/v1/campaigns/[slug]/messages` â€” post standalone message
- [ ] Create message validation schema (`messageSchema` in `src/lib/validators/`)
- [ ] Implement rate limiting: 5 messages per user per campaign per day
- [ ] Write integration tests for both routes

#### 9.2 Webhook Integration
- [ ] Modify `handlePaymentSuccess()` to also insert `campaign_messages` record when donation includes message
- [ ] Ensure message includes `donation_id` reference
- [ ] Write integration test: donation with message creates both records

#### 9.3 Seed Engine Integration
- [ ] Modify simulation engine to insert `campaign_messages` for seed donations with messages
- [ ] Use jittered timestamp on message records (consistent with donation)
- [ ] Write unit test

#### 9.4 Frontend Components
- [ ] Create `MessageWall` component (`src/components/campaign/MessageWall.tsx`)
  - Paginated list with polling
  - Avatar, name, location, time, message text
  - "Load more" button
  - Empty state
  - `aria-live` for accessibility
- [ ] Create `MessageForm` component (`src/components/campaign/MessageForm.tsx`)
  - Text input with character counter (500 max)
  - Anonymous toggle
  - Auth gate: "Sign in to leave a message"
  - Loading state, success toast
- [ ] Integrate into campaign detail page (`src/app/campaigns/[slug]/page.tsx`)
  - Add `getMessages()` data fetcher
  - Render `MessageWall` + `MessageForm` in sidebar or below story
- [ ] Create `MessageWall.test.tsx` â€” render test with mock data
- [ ] Create `MessageForm.test.tsx` â€” form validation, auth gate

#### 9.5 Admin Moderation
- [ ] Create `POST /api/v1/admin/campaigns/[campaignId]/messages/[messageId]/moderate` â€” flag/hide/unhide
- [ ] Add message moderation UI in admin campaign detail page
- [ ] Create notification for hidden messages
- [ ] Audit log entries for moderation actions
- [ ] Write integration tests

---

### Milestone 10: Admin Simulation Controls

**Scope**: Admin panel UI + API for controlling simulation

#### 10.1 Settings API
- [ ] Create `GET /api/v1/admin/simulation/settings` â€” return all simulation settings
- [ ] Create `PUT /api/v1/admin/simulation/settings` â€” update settings with validation
- [ ] Validation: volume 0.0â€“1.0, max_concurrent > 0, categories must be valid, thresholds ascending
- [ ] Audit log on every settings change
- [ ] Write integration tests

#### 10.2 Campaign Management API
- [ ] Create `GET /api/v1/admin/simulation/campaigns` â€” list simulated campaigns with stats
  - Include: progress %, real donations count, seed donations count, fund pool total, status, paused
- [ ] Create `POST /api/v1/admin/simulation/campaigns/[id]/pause` â€” set `simulation_config.paused = true`
- [ ] Create `POST /api/v1/admin/simulation/campaigns/[id]/resume` â€” set `simulation_config.paused = false`
- [ ] Create `POST /api/v1/admin/simulation/campaigns/[id]/convert` â€” simulation_flag = false, clear config
  - Require beneficiary info
  - Audit log
  - Transfer any pending fund pool allocations to "located_beneficiary" status
- [ ] Write integration tests for all endpoints

#### 10.3 Analytics API
- [ ] Create `GET /api/v1/admin/simulation/analytics` â€” return:
  - Simulated campaigns: active, completed, archived counts
  - Real campaigns: active, completed, archived counts
  - Seed donations: count, total amount, avg per campaign
  - Real donations: count, total amount, avg per campaign
  - Seed-to-real ratio (trending over time)
  - Fund pool: pending, allocated, disbursed totals
  - Category breakdown
- [ ] Write integration tests

#### 10.4 Admin UI Pages
- [ ] Create `/admin/simulation/page.tsx` â€” main control panel
  - Global toggle (Switch component)
  - Volume slider (range input)
  - Max concurrent input
  - Category checkboxes
  - Phase-out configuration
  - Fund pool summary card
  - Active simulated campaigns table with actions
- [ ] Create `/admin/simulation/fund-pool/page.tsx` â€” fund pool management
  - Pending allocations list
  - Allocate-to-campaign dialog
  - Disburse confirmation
  - Export button
- [ ] Create `/admin/simulation/analytics/page.tsx` â€” analytics dashboard
  - Chart: simulated vs real campaigns over time
  - Chart: seed vs real donations over time
  - Table: per-category breakdown
  - Seed-to-real ratio trend
- [ ] Add Simulation section to `AdminSidebar` (admin role only)
- [ ] Update admin layout/navigation

#### 10.5 Phase-Out Automation
- [ ] Implement `calculateAutoVolume()` function
- [ ] Add phase-out check to simulate-donations cron:
  - If `simulation.phase_out.enabled`, compute auto-volume
  - Override `simulation.volume` with lower of (manual setting, auto-computed)
- [ ] Add phase-out check to news pipeline:
  - If auto-volume = 0, skip creating new simulated campaigns
- [ ] Log phase-out decisions in audit log
- [ ] Write unit tests for `calculateAutoVolume()`

---

### Milestone 11: Adversarial Testing & Hardening

**Scope**: Comprehensive testing to ensure indistinguishability

#### 11.1 API Response Audit
- [ ] Create `test/security/api-response-audit.test.ts`
  - For every public API endpoint, make a request and scan the response JSON for:
    - Field names: `simulation_flag`, `simulationFlag`, `simulation_config`, `simulationConfig`, `campaignProfile`, `source` (at campaign level)
    - Field values: `'automated'`, `'seed'`, `'simulated'`, `@lastdonor.internal`
  - Test must fail if any of these appear

#### 11.2 Statistical Donation Analysis
- [ ] Create `test/security/donation-patterns.test.ts`
  - Generate 500 simulated donations via the simulation engine (in test mode)
  - Verify timestamp distribution is uniform within 15-min windows (chi-squared test)
  - Verify amount distribution matches expected psychological pricing tiers
  - Verify donor name uniqueness rate is within bounds
  - Verify Stripe ID format is `^pi_[A-Za-z0-9]{24}$`
  - Verify email domains are diverse (gmail, yahoo, outlook, etc.)

#### 11.3 Cross-Campaign Indistinguishability
- [ ] Create `test/security/indistinguishability.test.ts`
  - Create one simulated campaign and one real campaign with same goal/category
  - Fetch both via public API
  - Assert response shapes are byte-identical (same keys, same types)
  - Assert no field exists in one that doesn't exist in the other

#### 11.4 Frontend Audit
- [ ] Create `test/security/frontend-audit.test.ts`
  - Scan all files in `src/app/` and `src/components/` for imports of:
    - `simulation_flag`, `simulationFlag`
    - `SimulationConfig` type
    - `campaignProfile` (as a prop or variable)
    - Direct `campaigns.source` access
  - Test must fail if any of these are found in frontend code

#### 11.5 E2E Indistinguishability
- [ ] Create `e2e/e2e-16-dual-campaign.spec.ts`
  - Navigate to a simulated campaign page
  - Navigate to a real campaign page
  - Assert both have identical DOM structure (same components, same sections)
  - Assert donation form works identically on both
  - Assert donor feed displays identically on both

---

### Summary â€” Milestone Dependency Graph

```
Milestone 7: Foundation
  â”œâ”€â”€ 7.1 DB Migration
  â”œâ”€â”€ 7.2 Query Sanitization â† depends on 7.1
  â”œâ”€â”€ 7.3 Engine Hardening â† depends on 7.1
  â”œâ”€â”€ 7.4 Seed Data Sanitization â† depends on 7.1
  â””â”€â”€ 7.5 Pipeline Update â† depends on 7.1

Milestone 8: Donation Routing â† depends on 7.1, 7.2
  â”œâ”€â”€ 8.1 Donation Router
  â”œâ”€â”€ 8.2 Webhook Handler â† depends on 8.1
  â”œâ”€â”€ 8.3 Fund Pool Admin API â† depends on 8.2
  â””â”€â”€ 8.4 Reconciliation Update â† depends on 8.2

Milestone 9: Messaging System â† depends on 7.1
  â”œâ”€â”€ 9.1 Message API Routes
  â”œâ”€â”€ 9.2 Webhook Integration â† depends on 9.1
  â”œâ”€â”€ 9.3 Seed Engine Integration â† depends on 9.1
  â”œâ”€â”€ 9.4 Frontend Components â† depends on 9.1
  â””â”€â”€ 9.5 Admin Moderation â† depends on 9.1

Milestone 10: Admin Controls â† depends on 7.3
  â”œâ”€â”€ 10.1 Settings API
  â”œâ”€â”€ 10.2 Campaign Management API â† depends on 10.1
  â”œâ”€â”€ 10.3 Analytics API
  â”œâ”€â”€ 10.4 Admin UI Pages â† depends on 10.1, 10.2, 10.3
  â””â”€â”€ 10.5 Phase-Out Automation â† depends on 10.1

Milestone 11: Adversarial Testing â† depends on 7, 8, 9, 10
  â”œâ”€â”€ 11.1 API Response Audit
  â”œâ”€â”€ 11.2 Statistical Donation Analysis
  â”œâ”€â”€ 11.3 Cross-Campaign Indistinguishability
  â”œâ”€â”€ 11.4 Frontend Audit
  â””â”€â”€ 11.5 E2E Indistinguishability
```

### Estimated Scope

| Milestone | New Files | Modified Files | Test Files | DB Changes |
|-----------|-----------|----------------|------------|------------|
| 7 | ~5 | ~12 | ~4 | 1 migration |
| 8 | ~5 | ~3 | ~3 | 0 |
| 9 | ~10 | ~4 | ~5 | 0 |
| 10 | ~12 | ~3 | ~5 | 0 |
| 11 | ~5 | 0 | ~5 | 0 |
| **Total** | **~37** | **~22** | **~22** | **1** |

---

## Appendix A: Files Affected â€” Complete List

### New Files

| File | Milestone | Purpose |
|------|-----------|---------|
| `migrations/0013_dual_campaign_system.sql` | 7.1 | Database migration |
| `src/db/public-select.ts` | 7.2 | Query sanitization selectors |
| `src/types/public.ts` | 7.2 | Public-facing types (no internal fields) |
| `test/security/query-sanitization.test.ts` | 7.2 | Automated sanitization enforcement |
| `test/security/api-response-audit.test.ts` | 11.1 | API response scanning |
| `test/security/donation-patterns.test.ts` | 11.2 | Statistical analysis |
| `test/security/indistinguishability.test.ts` | 11.3 | Cross-campaign comparison |
| `test/security/frontend-audit.test.ts` | 11.4 | Frontend code scanning |
| `src/app/api/v1/campaigns/[slug]/messages/route.ts` | 9.1 | Message API |
| `src/app/api/v1/admin/campaigns/[campaignId]/messages/[messageId]/moderate/route.ts` | 9.5 | Message moderation |
| `src/components/campaign/MessageWall.tsx` | 9.4 | Message wall component |
| `src/components/campaign/MessageForm.tsx` | 9.4 | Message form component |
| `src/components/campaign/MessageWall.test.tsx` | 9.4 | Component test |
| `src/components/campaign/MessageForm.test.tsx` | 9.4 | Component test |
| `src/app/api/v1/admin/simulation/settings/route.ts` | 10.1 | Simulation settings API |
| `src/app/api/v1/admin/simulation/campaigns/route.ts` | 10.2 | Simulated campaigns list |
| `src/app/api/v1/admin/simulation/campaigns/[id]/pause/route.ts` | 10.2 | Pause campaign |
| `src/app/api/v1/admin/simulation/campaigns/[id]/resume/route.ts` | 10.2 | Resume campaign |
| `src/app/api/v1/admin/simulation/campaigns/[id]/convert/route.ts` | 10.2 | Convert campaign |
| `src/app/api/v1/admin/simulation/analytics/route.ts` | 10.3 | Analytics API |
| `src/app/api/v1/admin/fund-pool/route.ts` | 8.3 | Fund pool list |
| `src/app/api/v1/admin/fund-pool/allocate/route.ts` | 8.3 | Fund allocation |
| `src/app/api/v1/admin/fund-pool/disburse/route.ts` | 8.3 | Fund disbursement |
| `src/app/api/v1/admin/fund-pool/export/route.ts` | 8.3 | Fund pool export |
| `src/app/admin/simulation/page.tsx` | 10.4 | Simulation control panel |
| `src/app/admin/simulation/fund-pool/page.tsx` | 10.4 | Fund pool management |
| `src/app/admin/simulation/analytics/page.tsx` | 10.4 | Analytics dashboard |
| `e2e/e2e-16-dual-campaign.spec.ts` | 11.5 | E2E dual campaign |
| `e2e/e2e-17-messaging.spec.ts` | 9.4 | E2E messaging |
| `e2e/e2e-18-admin-simulation.spec.ts` | 10.4 | E2E admin controls |

### Modified Files

| File | Milestone | Change |
|------|-----------|--------|
| `src/db/schema.ts` | 7.1 | Add `simulationFlag`, `simulationConfig` to campaigns; add `campaignMessages`, `fundPoolAllocations` tables |
| `src/types/index.ts` | 7.1 | Export new types |
| `src/lib/settings.ts` | 7.3 | Add simulation settings to `SettingsMap` |
| `src/lib/settings.server.ts` | 7.3 | No change needed (generic getter works) |
| `src/lib/seed/simulation-engine.ts` | 7.3, 7.4, 9.3 | Filter by simulation_flag, volume scaling, per-campaign pause, realistic IDs/emails, message wall integration |
| `src/app/api/v1/cron/simulate-donations/route.ts` | 7.3 | Replace env var with siteSettings check |
| `src/app/api/v1/cron/update-phases/route.ts` | 7.3 | Skip real campaigns |
| `src/app/campaigns/[slug]/page.tsx` | 7.2, 9.4 | Use publicCampaignSelect; add MessageWall/Form |
| `src/app/api/v1/campaigns/[slug]/route.ts` | 7.2 | Use publicCampaignSelect |
| `src/app/api/v1/donations/create-intent/route.ts` | 8.1 | Fetch simulation_flag internally; add fundPool metadata |
| `src/app/api/v1/donations/webhook/route.ts` | 8.2, 9.2 | Fund pool allocation; campaign_messages insertion |
| `src/lib/news/news-pipeline.ts` | 7.5 | Set simulation_flag=true; max concurrent check |
| `src/app/api/v1/cron/reconcile/route.ts` | 8.4 | Fund pool reconciliation |
| `src/components/admin/AdminSidebar.tsx` | 10.4 | Add Simulation section |
| `src/app/admin/page.tsx` | 10.4 | Add simulation summary to dashboard |
| `vercel.json` | â€” | No change (existing crons are sufficient) |
| `src/middleware.ts` | â€” | No change (existing auth covers admin routes) |

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Simulated campaign** | A campaign created by the news pipeline or admin with `simulation_flag=true`. Receives AI-generated seed donations. |
| **Real campaign** | A campaign created by a real user/editor with `simulation_flag=false`. Receives only real donations from the Stripe payment flow. |
| **Seed donation** | A simulated donation inserted by the simulation engine. Tagged `source='seed'` in the database. No real money moves. |
| **Real donation** | A donation made by an actual user through Stripe. Tagged `source='real'` in the database. Real money moves. |
| **Fund pool** | A tracking mechanism for real donations made to simulated campaigns. Tracked in `fund_pool_allocations` table. |
| **Query sanitization** | The practice of using `publicCampaignSelect` to strip internal fields from all public-facing queries. |
| **Phase-out** | The gradual reduction and eventual elimination of simulated campaigns as real user activity increases. |
| **Campaign conversion** | The process of changing a simulated campaign to a real campaign â€” setting `simulation_flag=false` and assigning a real beneficiary. |
| **Trajectory profile** | JSONB configuration on each campaign that controls simulation pacing â€” velocity curve, surge events, amount tier. |
| **Volume multiplier** | A 0.0â€“1.0 scalar applied to donation probability, controlled via admin settings. |

---



# Complete Database Layer Analysis
1. Drizzle Configuration (drizzle.config.ts)
Dialect: PostgreSQL
Schema: ./src/db/schema.ts
Migrations Output: ./src/db/migrations
Database URL: From DATABASE_URL environment variable
2. Database Connection (src/db/index.ts)
Uses postgres-js client with connection pooling support (PgBouncer transaction mode)
Drizzle ORM wrapping with full schema exports
3. COMPLETE SCHEMA DEFINITION (src/db/schema.ts)
ENUMS (11 total)
campaign_status: 'draft' | 'active' | 'last_donor_zone' | 'completed' | 'archived'
campaign_category: 'medical' | 'disaster' | 'military' | 'veterans' | 'memorial' | 'first-responders' | 'community' | 'essential-needs' | 'emergency' | 'charity' | 'education' | 'animal' | 'environment' | 'business' | 'competition' | 'creative' | 'event' | 'faith' | 'family' | 'sports' | 'travel' | 'volunteer' | 'wishes'
donation_phase: 'first_believers' | 'the_push' | 'closing_in' | 'last_donor_zone'
donation_source: 'real' | 'seed'
user_role: 'donor' | 'editor' | 'admin'
blog_category: 'campaign_story' | 'impact_report' | 'news'
audit_severity: 'info' | 'warning' | 'error' | 'critical'
donor_type: 'individual' | 'corporate' | 'foundation'
interaction_type: 'email' | 'call' | 'meeting' | 'note'
notification_type: 'donation_refunded' | 'donation_refund_reversed' | 'campaign_completed' | 'campaign_archived' | 'campaign_status_changed' | 'role_changed' | 'account_deleted'
TABLE: users
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
email	text	NOT NULL, UNIQUE
emailVerified	timestamp with tz	NULL
passwordHash	text	NULL
name	text	NULL
image	text	NULL (NextAuth required)
location	text	NULL
avatarUrl	text	NULL
role	user_role enum	NOT NULL, DEFAULT 'donor'
totalDonated	integer	NOT NULL, DEFAULT 0
campaignsSupported	integer	NOT NULL, DEFAULT 0
lastDonorCount	integer	NOT NULL, DEFAULT 0
phone	text	NULL
donorType	donor_type enum	NOT NULL, DEFAULT 'individual'
organizationName	text	NULL
address	jsonb	NULL
lastDonationAt	timestamp with tz	NULL
donorScore	integer	NOT NULL, DEFAULT 0
badges	jsonb	NOT NULL, DEFAULT '[]'
preferences	jsonb	NOT NULL, DEFAULT '{}'
securityQuestion	text	NULL
securityAnswerHash	text	NULL
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_users_donor_score
idx_users_donor_type
idx_users_last_donation_at
idx_users_total_donated
TABLE: campaigns
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
title	text	NOT NULL
slug	text	NOT NULL, UNIQUE
status	campaign_status enum	NOT NULL, DEFAULT 'draft'
heroImageUrl	text	NOT NULL
photoCredit	text	NULL
storyHtml	text	NOT NULL
goalAmount	integer	NOT NULL
raisedAmount	integer	NOT NULL, DEFAULT 0
donorCount	integer	NOT NULL, DEFAULT 0
category	campaign_category enum	NOT NULL
location	text	NULL
subjectName	text	NOT NULL
subjectHometown	text	NULL
impactTiers	jsonb	DEFAULT '[]'
campaignProfile	jsonb	NULL
campaignOrganizer	jsonb	NULL
source	text	DEFAULT 'manual'
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
updatedAt	timestamp with tz	NOT NULL, DEFAULT now()
publishedAt	timestamp with tz	NULL
completedAt	timestamp with tz	NULL
lastDonorId	uuid	FK â†’ users.id
lastDonorName	text	NULL (for seed donors)
lastDonorAmount	integer	NULL
Indexes:

idx_campaigns_status
idx_campaigns_category
idx_campaigns_status_category (composite)
idx_campaigns_published_at
TABLE: donations
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
campaignId	uuid	NOT NULL, FK â†’ campaigns.id
userId	uuid	NULL, FK â†’ users.id
stripePaymentId	text	NOT NULL
amount	integer	NOT NULL, CHECK >= 500 (cents)
donorName	text	NOT NULL, DEFAULT 'Anonymous'
donorEmail	text	NOT NULL
donorLocation	text	NULL
message	text	NULL
isAnonymous	boolean	NOT NULL, DEFAULT false
isRecurring	boolean	NOT NULL, DEFAULT false
phaseAtTime	donation_phase enum	NOT NULL
source	donation_source enum	NOT NULL, DEFAULT 'real'
refunded	boolean	NOT NULL, DEFAULT false
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_donations_campaign_id
idx_donations_user_id
idx_donations_created_at
idx_donations_stripe_payment_id
CHECK constraint: amount >= 500
TABLE: campaignUpdates
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
campaignId	uuid	NOT NULL, FK â†’ campaigns.id
title	text	NOT NULL
bodyHtml	text	NOT NULL
updateType	text	NULL
imageUrl	text	NULL
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
TABLE: blogPosts
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
title	text	NOT NULL
slug	text	NOT NULL, UNIQUE
bodyHtml	text	NOT NULL
excerpt	text	NULL
coverImageUrl	text	NULL
authorName	text	NOT NULL
authorBio	text	NULL
category	blog_category enum	NOT NULL
published	boolean	NOT NULL, DEFAULT false
publishedAt	timestamp with tz	NULL
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_blog_posts_published (composite: published, publishedAt)
TABLE: newsletterSubscribers
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
email	text	NOT NULL, UNIQUE
subscribedAt	timestamp with tz	NOT NULL, DEFAULT now()
unsubscribedAt	timestamp with tz	NULL
source	text	NULL
TABLE: newsItems
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
title	text	NOT NULL
url	text	NOT NULL, UNIQUE
source	text	NOT NULL
summary	text	NULL
articleBody	text	NULL
imageUrl	text	NULL
category	campaign_category enum	NULL
relevanceScore	integer	NULL
campaignCreated	boolean	NOT NULL, DEFAULT false
campaignId	uuid	NULL, FK â†’ campaigns.id
adminFlagged	boolean	NOT NULL, DEFAULT false
adminOverrideCategory	campaign_category enum	NULL
adminNotes	text	NULL
publishedAt	timestamp with tz	NULL
fetchedAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_news_items_fetched_at
idx_news_items_campaign_created
idx_news_items_admin_flagged
TABLE: keywordRotation
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
category	text	NOT NULL
keyword	text	NOT NULL
usedAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_keyword_rotation_category
Unique: (category, keyword)
TABLE: campaignSeedMessages
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
campaignId	uuid	NOT NULL, FK â†’ campaigns.id
message	text	NOT NULL
persona	text	NULL
phase	donation_phase enum	NOT NULL
used	boolean	NOT NULL, DEFAULT false
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_seed_messages_campaign_used (composite: campaignId, used)
TABLE: auditLogs
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
timestamp	timestamp with tz	NOT NULL, DEFAULT now()
eventType	text	NOT NULL
actorId	uuid	NULL
actorRole	user_role enum	NULL
actorIp	text	NULL
targetType	text	NULL
targetId	uuid	NULL
details	jsonb	DEFAULT '{}'
severity	audit_severity enum	NOT NULL, DEFAULT 'info'
Indexes:

idx_audit_logs_event_type
idx_audit_logs_timestamp
idx_audit_logs_actor_id
TABLE: interactionLogs
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
donorId	uuid	NOT NULL, FK â†’ users.id
staffId	uuid	NULL, FK â†’ users.id
type	interaction_type enum	NOT NULL
subject	text	NOT NULL
body	text	NULL
contactedAt	timestamp with tz	NOT NULL
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_interaction_logs_donor_id
idx_interaction_logs_staff_id
idx_interaction_logs_contacted_at
TABLE: donorRelationships
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
donorId	uuid	NOT NULL, FK â†’ users.id
relatedDonorId	uuid	NULL, FK â†’ users.id
organizationName	text	NULL
relationshipType	text	NOT NULL
notes	text	NULL
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_donor_relationships_donor_id
idx_donor_relationships_related_id
TABLE: accounts (NextAuth.js)
Column	Type	Constraints
userId	uuid	NOT NULL, FK â†’ users.id (CASCADE)
type	text	NOT NULL
provider	text	NOT NULL
providerAccountId	text	NOT NULL
refresh_token	text	NULL
access_token	text	NULL
expires_at	integer	NULL
token_type	text	NULL
scope	text	NULL
id_token	text	NULL
session_state	text	NULL
Primary Key: (provider, providerAccountId)

TABLE: sessions (NextAuth.js)
Column	Type	Constraints
sessionToken	text	PRIMARY KEY
userId	uuid	NOT NULL, FK â†’ users.id (CASCADE)
expires	timestamp	NOT NULL
TABLE: verificationTokens (NextAuth.js)
Column	Type	Constraints
identifier	text	NOT NULL
token	text	NOT NULL
expires	timestamp	NOT NULL
Primary Key: (identifier, token)

TABLE: aiUsageLogs (Milestone 7: Cost Tracking)
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
model	text	NOT NULL
promptType	text	NOT NULL
inputTokens	integer	NOT NULL, DEFAULT 0
outputTokens	integer	NOT NULL, DEFAULT 0
latencyMs	integer	NOT NULL, DEFAULT 0
success	boolean	NOT NULL, DEFAULT true
errorMessage	text	NULL
campaignId	uuid	NULL, FK â†’ campaigns.id
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_ai_usage_logs_created_at
idx_ai_usage_logs_model
idx_ai_usage_logs_prompt_type
TABLE: siteSettings (Key-Value Store)
Column	Type	Constraints
key	text	PRIMARY KEY
value	jsonb	NOT NULL
updatedAt	timestamp with tz	NOT NULL, DEFAULT now()
updatedBy	uuid	NULL, FK â†’ users.id
TABLE: notifications
Column	Type	Constraints
id	uuid	PRIMARY KEY, DEFAULT random
userId	uuid	NOT NULL, FK â†’ users.id (CASCADE)
type	notification_type enum	NOT NULL
title	text	NOT NULL
message	text	NOT NULL
link	text	NULL
read	boolean	NOT NULL, DEFAULT false
emailSent	boolean	NOT NULL, DEFAULT false
createdAt	timestamp with tz	NOT NULL, DEFAULT now()
Indexes:

idx_notifications_user_id
idx_notifications_user_read (composite)
idx_notifications_created_at
4. ALL MIGRATION FILES (14 total)
Migration	Purpose	Key Changes
0000_square_chronomancer.sql	Initial schema	Creates all core tables: users, campaigns, donations, blog_posts, newsletter_subscribers, news_items, campaign_seed_messages, campaign_updates, accounts, sessions, verification_tokens, audit_logs
0001_gray_mattie_franklin.sql	News image URL	ADD news_items.image_url
0002_common_green_goblin.sql	User preferences	ADD users.preferences JSONB
0003_illegal_vargas.sql	Donation defaults	ALTER donations.donor_name SET DEFAULT 'Anonymous'
0004_fancy_patriot.sql	Donor management	Creates donor_relationships & interaction_logs tables; adds phone, donor_type, organization_name, address, last_donation_at, donor_score to users
0005_neat_texas_twister.sql	Site settings	Creates site_settings key-value table
0006_sticky_tinkerer.sql	Security questions	ADD users.security_question & security_answer_hash
0007_add_notifications.sql	Notifications system	Creates notifications table with type enum
0008_add_categories.sql	Category expansion	Alters campaign_category enum: adds emergency, charity, education, animal, environment, business, competition, creative, event, faith, family, sports, travel, volunteer, wishes; migrates disasterâ†’emergency, essential-needsâ†’charity
0009_campaign_profile.sql	Campaign simulation	ADD campaigns.campaign_profile JSONB
0010_organizer_and_update_type.sql	Organizer context	ADD campaigns.campaign_organizer JSONB; ADD campaign_updates.update_type TEXT
0011_last_donor_completion.sql	Last donor tracking	ADD campaigns.last_donor_name & last_donor_amount
0012_news_pipeline_quality.sql	News pipeline & keywords	ADD news_items.article_body; creates keyword_rotation table
0013_monitoring.sql	AI monitoring	Creates ai_usage_logs table; adds admin_flagged, admin_override_category, admin_notes to news_items; seeds site_settings with cost alert & campaign limits
5. Migration Infrastructure
run-migration.cjs - Main Migration Runner
Loads .env.local (handling Windows line endings)
Executes: npx drizzle-kit migrate
Requires DATABASE_URL env var
apply-preferences-migration.mjs - Legacy Migration Script
Manually applies preferences column to users table
Direct postgres-js connection
Handles dotenv config
Migration Metadata (src/db/migrations/meta/)
_journal.json - Migration tracking ledger
0000_snapshot.json through 0005_snapshot.json - Schema snapshots for migrations 0-5
6. Data Access Pattern
No separate query layer â€” The project uses direct Drizzle ORM queries inline in API routes. Example from API routes:

// Read: Query campaigns with filters
db.select().from(campaigns).where(eq(campaigns.status, 'active'))

// Create: Insert donations
db.insert(donations).values({...}).returning()

// Update: Modify campaign status
db.update(campaigns).set(updateValues).where(eq(campaigns.id, id)).returning()

// Complex: Joins with multiple conditions
db.select()
  .from(campaigns)
  .leftJoin(users, eq(campaigns.lastDonorId, users.id))
  .where(...)
7. Key Database Characteristics
Total Tables: 17

Core Domain: campaigns, donations, users (3)
Content: blogPosts, campaignUpdates, newsItems (3)
Engagement: notifications, campaignSeedMessages, keywordRotation (3)
Management: auditLogs, interactionLogs, donorRelationships (3)
Auth: accounts, sessions, verificationTokens (NextAuth.js) (3)
Operations: aiUsageLogs, siteSettings (2)
Performance Features:

30+ indexes optimizing common queries
Composite indexes for multi-column filters
UNIQUE constraints on slugs and URLs (especially important for SEO)
Enum types for data integrity
Data Integrity:

Foreign key constraints with cascade deletes on auth tables
CHECK constraint on donations (minimum amount: $5/500 cents)
Default values for nullable fields
Timezone-aware timestamps throughout

#API AUDIT - Complete Data Exposure Report
1. src/app/api/v1/campaigns/route.ts
GET Endpoint

Authentication Check: None (public endpoint)
Database Query Filters:
Status: active OR last_donor_zone (REQUIRED)
Category: optional category filter (if provided in query)
Text search: searches title, subjectName, location, subjectHometown (ilike with '%' pattern)
Location filter: searches location and subjectHometown (ilike with '%' pattern)
Close to target: filters where raisedAmount / goalAmount >= 0.9
Fields Selected from DB:
campaigns.id
campaigns.title
campaigns.slug
campaigns.status
campaigns.heroImageUrl
campaigns.category
campaigns.location
campaigns.subjectName
campaigns.subjectHometown
campaigns.campaignOrganizer
campaigns.goalAmount
campaigns.raisedAmount
campaigns.donorCount
campaigns.publishedAt
JSON Response Fields: Same as selected fields above
Ordering Options: newest (default, orders by raisedAmount DESC), most_funded (raisedAmount DESC), least_funded (raisedAmount ASC), closing_soon (funding percentage DESC)
Pagination: Offset-based cursor (limit: 1-50, default 20)
POST Endpoint (Create Campaign)

Authentication Check: requireRole(['editor', 'admin']) - PROTECTED
Validation: createCampaignSchema
Fields Accepted: title, slug, category, heroImageUrl, photoCredit, subjectName, subjectHometown, storyHtml (sanitized with sanitizeHtml()), goalAmount, impactTiers, status
Unique Constraint Check: slug must be unique
Defaults: raisedAmount = 0, donorCount = 0, publishedAt = now (if status='active')
Database Columns Inserted: All standard campaign fields
2. src/app/api/v1/campaigns/[slug]/route.ts
GET Endpoint (Campaign Detail)

Authentication Check: None (public endpoint)
Database Filters:
Slug match AND status in (active, last_donor_zone, completed)
Fields Selected from Campaigns Table: ALL fields (.select() with no field specification)
Additional Data Fetched:
Recent Donors (last 10):
donations.id
donations.donorName
donations.donorLocation
donations.amount
donations.message
donations.isAnonymous
donations.createdAt
Anonymous donors mapped to name='Anonymous', location=null
Campaign Updates:
campaignUpdates.id
campaignUpdates.title
campaignUpdates.bodyHtml
campaignUpdates.imageUrl
campaignUpdates.createdAt
JSON Response: Complete campaign object + recentDonors array + updates array
PUT Endpoint (Update Campaign)

Authentication Check: requireRole(['editor', 'admin']) - PROTECTED
Fields Can Update: title, slug, category, heroImageUrl, photoCredit, subjectName, subjectHometown, storyHtml, goalAmount, impactTiers, status
Slug Uniqueness Check: If slug is changed, must verify no conflicts
HTML Sanitization: storyHtml is run through sanitizeHtml()
ISR Revalidation: Revalidates /campaigns/{slug} and /campaigns
DELETE Endpoint (Archive Campaign)

Authentication Check: requireRole(['admin']) - PROTECTED ADMIN-ONLY
Business Logic: Only soft-deletes campaigns with status 'draft' or 'completed'
Action: Sets status='archived', updatedAt=now
ISR Revalidation: Revalidates /campaigns/{slug} and /campaigns
3. src/app/api/v1/campaigns/[slug]/donors/route.ts
GET Endpoint (Campaign Donors List)

Authentication Check: None (public endpoint)
Database Filters:
Campaign lookup by slug
Donations filtered to specific campaign
Optional cursor pagination (lt - less than operation on donation ID)
Optional after parameter: filters donations created after a given donation's createdAt timestamp
Fields Selected from Donations:
donations.id
donations.donorName
donations.donorLocation
donations.amount
donations.message
donations.isAnonymous
donations.createdAt
JSON Response:
Same fields as above
Anonymous donors mapped to name='Anonymous', location=null
Metadata: cursor (nextCursor), hasMore boolean
Pagination: Limit 1-50, default 20
Ordering: DESC by createdAt (newest first)
4. src/app/api/v1/donations/create-intent/route.ts
POST Endpoint (Create Payment Intent)

Authentication Check: None (public endpoint)
Validation: createIntentSchema
Campaign Status Check: Campaign must exist AND have status active OR last_donor_zone
Database Lookup Fields:
campaigns.id
campaigns.title
campaigns.status
Stripe Metadata Stored:
campaignId
donorName
donorEmail
donorLocation
message
isAnonymous
isRecurring
JSON Response Returned:
clientSecret (from Stripe PaymentIntent)
paymentIntentId
amount
campaignTitle
Idempotency Support: Via idempotencyKey parameter
5. src/app/api/v1/donations/webhook/route.ts
POST Endpoint (Stripe Webhook Receiver)

Authentication Check: Stripe signature verification (not user-based)
Webhook Events Handled:
payment_intent.succeeded
payment_intent.payment_failed
charge.refunded
invoice.payment_succeeded (recurring donations)
On payment_intent.succeeded:

Data Extracted from PaymentIntent Metadata:
campaignId
donorName
donorEmail
donorLocation
message
isAnonymous
isRecurring
amount (from paymentIntent.amount)
Database Operations (ATOMIC TRANSACTION):
Insert into donations table:
campaignId, stripePaymentId, amount, donorName, donorEmail, donorLocation, message, isAnonymous, isRecurring, phaseAtTime, source='real'
Update campaigns:
raisedAmount += amount (SQL expression)
donorCount += 1 (SQL expression)
Check goal achievement:
If raisedAmount >= goalAmount AND status != 'completed': set status='completed', completedAt=now, lastDonorId=user.id (if registered)
If raisedAmount >= goalAmount * 0.9 AND status='active': set status='last_donor_zone'
Update users (if registered):
totalDonated += amount
campaignsSupported += 1
lastDonationAt = now
If campaign just completed: lastDonorCount += 1
Insert auditLogs entry - EXPOSES: eventType, amount, campaignId, stripePaymentId, phase, isAnonymous
Email Sent: Donation receipt (respects user email preferences)
ISR Revalidation: /campaigns/{slug} and /campaigns
On charge.refunded:

Database Operations (ATOMIC TRANSACTION):
Mark donation as refunded = true
Update campaign: raisedAmount -= amount, donorCount -= 1 (with GREATEST to prevent negatives)
Insert audit log
Idempotency: Tracks processed event IDs in memory Set (caps at 10,000)

6. src/app/api/v1/stats/route.ts
GET Endpoint (Aggregate Statistics)

Authentication Check: None (public endpoint)
Cache Control: 300 seconds max-age, 600s stale-while-revalidate
Database Aggregations:
totalRaised: SUM(donations.amount) WHERE source='real' AND refunded=false
totalDonors: COUNT(DISTINCT donations.donorEmail) WHERE source='real' AND refunded=false
campaignsCompleted: COUNT(*) WHERE status IN ('completed', 'archived')
campaignsActive: COUNT(*) WHERE status IN ('active', 'last_donor_zone')
peopleSupported: COUNT(DISTINCT campaigns.subjectName) WHERE status='completed'
JSON Response:
{
  "ok": true,
  "data": {
    "totalRaised": <number>,
    "totalDonors": <number>,
    "campaignsCompleted": <number>,
    "campaignsActive": <number>,
    "peopleSupported": <number>
  }
}
Query Filters Applied:
Excludes seed donations (source != 'real')
Excludes refunded donations (refunded = false)
7. src/app/api/v1/health/route.ts
GET Endpoint (Health Check)

Authentication Check: None (public endpoint)
Dynamic: force-dynamic (no caching)
Checks Performed:
Database: Executes SELECT 1, measures latency
Stripe: Calls stripe.balance.retrieve(), measures latency
JSON Response:
{
  "status": "healthy|degraded",
  "timestamp": "<ISO datetime>",
  "checks": {
    "database": { "status": "ok|error", "latencyMs": <number>, "error": "<message>" },
    "stripe": { "status": "ok|error", "latencyMs": <number>, "error": "<message>" }
  },
  "version": "<npm_package_version>",
  "commit": "<git commit SHA short>"
}
HTTP Status: 200 if all healthy, 503 if any degraded
SUMMARY OF DATA EXPOSURE
Endpoint	Public?	Sensitive Fields Exposed	Auth/Filters
GET /campaigns	âœ… Yes	donor count, fundraising progress, subject names, locations	Status filter (active/LDZ only)
POST /campaigns	âŒ Editor/Admin only	All campaign fields	Role check
GET /campaigns/[slug]	âœ… Yes	Recent donors (names, locations, amounts, messages), campaign updates	Status filter + slug lookup
GET /campaigns/[slug]/donors	âœ… Yes	Donor names, locations, amounts, messages, timestamps	Campaign lookup + anonymous mapping
POST /donations/create-intent	âœ… Yes	Campaign IDs accepted + donor PII passed to Stripe	Campaign status check
POST /donations/webhook	âœ… (Stripe-verified)	All donor PII stored in DB, audit logs expose donation details	Stripe signature verification
GET /stats	âœ… Yes	Aggregated totals only (no personal data)	source='real' + refunded=false
GET /health	âœ… Yes	Service status only	No sensitive data
Critical Privacy Notes:

Donor names and locations are publicly visible via /campaigns/[slug]/donors (unless marked anonymous)
Anonymous donors properly masked: name='Anonymous', location=null
Donor email addresses are NOT returned in API responses (only stored internally)
Donation amounts are exposed publicly
Audit logs store sensitive donation details (stripePaymentId, isAnonymous flag, phase info)


*End of Document*
