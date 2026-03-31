# 16 — Dual Campaign System: Implementation Phases

> **Document ID**: LD-DUAL-IMPL-001  
> **Purpose**: Exhaustive milestone breakdown with every step, substep, function, file, and logic chain for implementing the Dual Campaign System (simulated + real campaigns coexistence).  
> **Status**: Draft  
> **Prerequisite Docs**: 01–15 (all read and reconciled)  
> **Depends On**: Phases 1–4 complete, Milestones 1–6 complete  
> **Companion Doc**: [15-DUAL-CAMPAIGN-SYSTEM.md](15-DUAL-CAMPAIGN-SYSTEM.md) — System Design & Architecture

---

## Table of Contents

1. [Pre-Implementation Summary](#1-pre-implementation-summary)
2. [Ecosystem State Snapshot](#2-ecosystem-state-snapshot)
3. [Milestone 7: Foundation — Schema, Sanitization, Engine Hardening](#3-milestone-7-foundation)
4. [Milestone 8: Donation Routing & Fund Pool](#4-milestone-8-donation-routing--fund-pool)
5. [Milestone 9: Messaging System](#5-milestone-9-messaging-system)
6. [Milestone 10: Admin Simulation Controls](#6-milestone-10-admin-simulation-controls)
7. [Milestone 11: Adversarial Testing & Hardening](#7-milestone-11-adversarial-testing--hardening)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Dependency Graph](#9-dependency-graph)
10. [File Manifest](#10-file-manifest)

---

## 1. Pre-Implementation Summary

### 1.1 What We're Building

A coexistence layer that allows system-generated (simulated) campaigns and user-created (real) campaigns to run simultaneously on the platform with **zero distinguishability** from the perspective of any end user, browser developer tools, network inspector, or external system.

### 1.2 Decisions Locked (from Doc 15)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fund handling | **Approach A: Pool funds** | Real donations to simulated campaigns processed via Stripe normally; funds delivered to located beneficiary or redistributed to real campaigns |
| Schema approach | **Flag column (`simulation_flag`) on `campaigns` table** | Single unified table; all queries naturally include both types |
| Frontend awareness | **Architecturally zero** | Frontend code never receives, imports, or references `simulation_flag` or `source` |
| Messaging model | **One-way donor messages** | Donors leave messages (public wall); campaign runner posts updates only; no bidirectional chat; no AI responses to messages |
| Feature flag infra | **`siteSettings` table** | Already exists; admin-editable at runtime; no new infrastructure |
| Simulation control | **Admin panel section** | Extend existing admin panel with Simulation Controls; admin role only |

### 1.3 Core Principles

1. **Total Indistinguishability**: No API response, React DevTools inspection, network trace, statistical analysis, or source code review of frontend files can reveal whether a campaign is simulated.
2. **Query Sanitization at Source**: A single `publicCampaignSelect` object acts as the gatekeeper — all public queries use it; internal fields never leave the server.
3. **Simulation Engine Isolation**: Seed donations only flow to `simulation_flag=true` campaigns; real campaigns are never seeded.
4. **Fund Integrity**: Every real dollar is tracked from entry through a simulated campaign to allocation/disbursement to a real beneficiary.
5. **Graceful Phase-Out**: Simulation volume auto-scales down as real campaign count increases; existing simulated campaigns complete naturally.

---

## 2. Ecosystem State Snapshot

### 2.1 Current Database — 17 Tables

| Table | Rows (approx) | Dual-Campaign Relevance |
|-------|---------------|------------------------|
| `campaigns` | ~50 | **PRIMARY TARGET** — gets `simulation_flag`, `simulation_config` columns |
| `donations` | ~2,500 | Contains `source` ('real'/'seed'), fake Stripe IDs, fake emails — must be sanitized |
| `users` | ~20 | Real users only; seed donors have no user accounts |
| `campaignUpdates` | ~200 | AI-generated for simulated campaigns; stays as-is |
| `campaignSeedMessages` | ~1,500 | AI-generated message pool; stays but integrates with new `campaignMessages` |
| `newsItems` | ~500 | Source articles for auto campaigns; no change needed |
| `auditLogs` | ~1,000 | Gains new event types for simulation control |
| `siteSettings` | ~15 | Gains 9 new simulation settings keys |
| `notifications` | ~10 | Gains 2 new notification types |
| `keywordRotation` | ~100 | No change |
| `blogPosts` | ~5 | No change |
| `newsletterSubscribers` | ~50 | No change |
| `aiUsageLogs` | ~2,000 | No change |
| `interactionLogs` | ~10 | No change |
| `donorRelationships` | ~5 | No change |
| `accounts`, `sessions`, `verificationTokens` | — | NextAuth; no change |

### 2.2 Current Leak Vectors — Complete Audit

| # | Vector | Location | Severity | Fix Milestone |
|---|--------|----------|----------|---------------|
| L1 | `GET /api/v1/campaigns/[slug]` returns ALL columns via bare `db.select()` | `src/app/api/v1/campaigns/[slug]/route.ts` line 24 | **CRITICAL** | M7.2 |
| L2 | `getCampaign()` SSR uses bare `db.select()` | `src/app/campaigns/[slug]/page.tsx` line 33 | **CRITICAL** | M7.2 |
| L3 | `campaigns.source` field exists as `'automated'` on pipeline campaigns | `src/db/schema.ts` line 144 | **CRITICAL** | M7.2 |
| L4 | `campaigns.campaignProfile` JSONB contains simulation params | `src/db/schema.ts` line 141 | **HIGH** | M7.2 |
| L5 | Seed Stripe IDs: `seed_${uuid}` prefix | `src/lib/seed/simulation-engine.ts` line 210 | **HIGH** | M7.4 |
| L6 | Seed emails: `@lastdonor.internal` domain | `src/lib/seed/simulation-engine.ts` lines 214, 282 | **HIGH** | M7.4 |
| L7 | `donations.source = 'seed'` never exposed publicly but visible in DB | `src/db/schema.ts` line 167 | **MEDIUM** | Already safe (not in public selects) |
| L8 | Seed donations always have `userId = null` | `simulation-engine.ts` (omission) | **MEDIUM** | Statistical; acceptable |
| L9 | `SEED_MODE_ENABLED` is global binary toggle | `simulate-donations/route.ts` line 17 | **OPERATIONAL** | M7.3 |
| L10 | Simulation engine seeds ALL campaigns (including future real ones) | `simulation-engine.ts` line 143 | **CRITICAL** | M7.3 |
| L11 | `update-phases` cron generates AI updates on ALL campaigns | `update-phases/route.ts` | **CRITICAL** | M7.3 |
| L12 | React DevTools could inspect full campaign object in server component | `campaigns/[slug]/page.tsx` | **MEDIUM** | M7.2 (publicCampaignSelect strips before SSR) |
| L13 | New `simulation_flag` column could be exposed if not sanitized | N/A (to be created) | **CRITICAL** | M7.2 |

### 2.3 Simulation Engine — Current Architecture

```
simulate-donations cron (every 15 min)
  └─► SEED_MODE_ENABLED env check
       └─► runSimulation() [simulation-engine.ts]
            ├─► Query ALL active/LDZ campaigns (NO filter on source)
            ├─► For each campaign:
            │    ├─► Read campaignProfile JSONB (trajectory profile)
            │    ├─► shouldDonateThisCycle() → probabilistic gate
            │    ├─► donationCountThisCycle() → 1-5 donations
            │    ├─► For each donation:
            │    │    ├─► seedAmountCents() → psychological pricing
            │    │    ├─► selectSimulatedDonor() → from 5000 donor pool
            │    │    ├─► pickSeedMessage() → from campaignSeedMessages
            │    │    ├─► Generate: stripePaymentId = 'seed_${uuid}' ← LEAK
            │    │    ├─► Generate: donorEmail = 'seed-xxx@lastdonor.internal' ← LEAK
            │    │    └─► INSERT donation (source='seed')
            │    ├─► maybeBuildCohort() → 12% chance of group donation
            │    └─► Check phase transition → AI update
            └─► Check completion → celebration + impact report
```

### 2.4 Files That Drive Simulation (15 files in `src/lib/seed/`)

| File | Lines | Purpose |
|------|-------|---------|
| `simulation-engine.ts` | 659 | Core orchestrator |
| `trajectory-profiles.ts` | 348 | 4 archetypes: viral, steady, slow_burn, surge_late |
| `donor-pool.ts` | 584 | 5,000 pre-generated donors with demographics |
| `donor-selector.ts` | 472 | Geographic weighting, repeats (8%), cohorts (12%) |
| `organizer-generator.ts` | 504 | AI organizer identities, mid-campaign updates |
| `message-generator.ts` | 286 | Seed message picker + AI refill |
| `message-validation.ts` | 123 | Length, dedup, similarity checks |
| `amount-generator.ts` | 99 | Psychological pricing in 3 tiers |
| `name-generator.ts` | 337 | Legacy name pool (superseded by donor-pool.ts) |
| + 6 test files | — | Unit tests for above |

### 2.5 API Surface — 53 Routes

| Category | Count | Simulation Relevance |
|----------|-------|---------------------|
| Public (campaigns, stats, blog) | 12 | Must NEVER expose simulation fields |
| Auth | 4 | No relevance |
| User (dashboard, profile) | 4 | No relevance |
| Admin | 22 | SHOULD expose simulation fields for control |
| Cron | 7 | Must be modified for simulation_flag filtering |
| Webhook | 1 | Must integrate fund pool tracking |
| **New (to be created)** | **~15** | Messaging, simulation admin, fund pool |

---

## 3. Milestone 7: Foundation — Schema, Sanitization, Engine Hardening

### 3.1 Database Migration

**File**: `src/db/migrations/0014_dual_campaign_system.sql`  
**Drizzle schema**: `src/db/schema.ts`

#### 3.1.1 Add `simulation_flag` Column to `campaigns`

**SQL**:
```sql
ALTER TABLE campaigns ADD COLUMN simulation_flag BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_campaigns_simulation_flag ON campaigns (simulation_flag);
```

**Drizzle schema addition** (in `src/db/schema.ts`, inside `campaigns` table definition):
```typescript
simulationFlag: boolean('simulation_flag').notNull().default(false),
```

**Why**: Single boolean — unambiguous meaning: `true` = this campaign receives seed donations and has a system-generated profile. Separate from `source` which indicates HOW the campaign was created.

**Why NOT reuse `source`**: A `source='automated'` campaign might be "converted" to real in the future. An admin might manually create a test simulated campaign (`source='manual'`, `simulation_flag=true`). The two concepts are orthogonal.

**Index rationale**: The simulation engine and admin queries will filter by `simulation_flag`; index ensures O(log n) lookups.

#### 3.1.2 Add `simulation_config` Column to `campaigns`

**SQL**:
```sql
ALTER TABLE campaigns ADD COLUMN simulation_config JSONB DEFAULT NULL;
```

**Drizzle schema addition**:
```typescript
simulationConfig: jsonb('simulation_config').$type<SimulationConfig | null>().default(null),
```

**TypeScript type** (add to `src/types/index.ts`):
```typescript
export type SimulationConfig = {
  paused: boolean;
  volumeOverride?: number;         // 0.0–2.0
  fundAllocation: 'pool' | 'located_beneficiary';
  beneficiaryInfo?: string;         // Encrypted contact/payment info
  notes?: string;                   // Admin internal notes
};
```

**Why JSONB**: Flexible per-campaign overrides without schema migrations. The simulation engine reads `config.paused` to skip specific campaigns; admin can adjust `volumeOverride` per campaign.

#### 3.1.3 Backfill Existing Data

**SQL**:
```sql
UPDATE campaigns SET simulation_flag = TRUE WHERE source = 'automated';
UPDATE campaigns SET simulation_config = '{"paused": false, "fundAllocation": "pool"}'::jsonb WHERE source = 'automated';
```

**Effect**: All ~50 existing pipeline-created campaigns become flagged as simulated. All existing manual campaigns remain `simulation_flag=false`.

**Why**: Preserves current behavior — existing automated campaigns continue receiving seed donations; existing manual campaigns do not.

#### 3.1.4 Create `fund_pool_allocations` Table

**SQL**:
```sql
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
```

**Drizzle schema** (new table in `src/db/schema.ts`):
```typescript
export const fundPoolAllocations = pgTable('fund_pool_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  donationId: uuid('donation_id').notNull().references(() => donations.id),
  sourceCampaignId: uuid('source_campaign_id').notNull().references(() => campaigns.id),
  targetCampaignId: uuid('target_campaign_id').references(() => campaigns.id),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  allocatedAt: timestamp('allocated_at', { withTimezone: true }),
  disbursedAt: timestamp('disbursed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_fund_pool_status').on(t.status),
  index('idx_fund_pool_source').on(t.sourceCampaignId),
  index('idx_fund_pool_target').on(t.targetCampaignId),
]);
```

**Status values**: `'pending'` → `'allocated'` → `'disbursed'`

**Data flow**:
1. Real user donates to simulated campaign → webhook inserts `fund_pool_allocations` row with `status='pending'`
2. Admin locates beneficiary → updates to `status='allocated'`, sets `target_campaign_id`
3. Funds delivered → updates to `status='disbursed'`, sets `disbursed_at`

#### 3.1.5 Create `campaign_messages` Table

**SQL**:
```sql
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
```

**Drizzle schema**:
```typescript
export const campaignMessages = pgTable('campaign_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  userId: uuid('user_id').references(() => users.id),
  donorName: text('donor_name').notNull().default('Anonymous'),
  donorLocation: text('donor_location'),
  message: text('message').notNull(),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  donationId: uuid('donation_id').references(() => donations.id),
  flagged: boolean('flagged').notNull().default(false),
  hidden: boolean('hidden').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_campaign_messages_campaign').on(t.campaignId),
  index('idx_campaign_messages_user').on(t.userId),
  index('idx_campaign_messages_created').on(t.createdAt),
  index('idx_campaign_messages_flagged').on(t.flagged),
]);
```

**Why separate from `donations.message`**: 
- Donations table serves payment records — messages are a social feature
- Need moderation (flag/hide) without touching financial records
- Standalone messages (no donation) need supporting
- Seed donation messages also insert here (maintaining wall consistency)

#### 3.1.6 Add Notification Types

**SQL**:
```sql
ALTER TYPE notification_type ADD VALUE 'new_message';
ALTER TYPE notification_type ADD VALUE 'message_flagged';
```

**Drizzle schema** (update `notificationTypeEnum`):
```typescript
export const notificationTypeEnum = pgEnum('notification_type', [
  'donation_refunded',
  'donation_refund_reversed',
  'campaign_completed',
  'campaign_archived',
  'campaign_status_changed',
  'role_changed',
  'account_deleted',
  'new_message',        // NEW
  'message_flagged',    // NEW
]);
```

#### 3.1.7 Seed Simulation Settings

**SQL** (insert into `site_settings`):
```sql
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

#### 3.1.8 Run Migration & Verify

**Steps**:
1. Generate migration: `npx drizzle-kit generate`
2. Run migration: `node run-migration.cjs`
3. Verify via `npx drizzle-kit studio` or direct DB query:
   - `SELECT simulation_flag, simulation_config FROM campaigns LIMIT 5;`
   - `SELECT * FROM fund_pool_allocations LIMIT 1;`
   - `SELECT * FROM campaign_messages LIMIT 1;`
   - `SELECT * FROM site_settings WHERE key LIKE 'simulation.%';`

---

### 3.2 Query Sanitization Layer

**This is the most security-critical subsystem in the entire dual campaign implementation.**

#### 3.2.1 Create `publicCampaignSelect` Object

**New file**: `src/db/public-select.ts`

**Purpose**: The SINGLE authoritative definition of which campaign columns are safe for public exposure. Every public-facing database query MUST use this object. No exceptions.

**Contents**:
```typescript
import { campaigns, donations, campaignMessages } from '@/db/schema';

// ═══════════════════════════════════════════════════════════════
// SECURITY-CRITICAL: PUBLIC DATA BOUNDARY
// ═══════════════════════════════════════════════════════════════
//
// These select objects define the ONLY columns that may appear
// in public-facing API responses and SSR-rendered pages.
//
// NEVER add these columns to any public select:
//   - simulation_flag     (reveals campaign type)
//   - simulation_config   (reveals simulation parameters)
//   - source              (reveals campaign origin)
//   - campaignProfile     (reveals trajectory/simulation config)
//
// Any change to this file requires security review.
// ═══════════════════════════════════════════════════════════════

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

export const publicDonationSelect = {
  id: donations.id,
  donorName: donations.donorName,
  donorLocation: donations.donorLocation,
  amount: donations.amount,
  message: donations.message,
  isAnonymous: donations.isAnonymous,
  createdAt: donations.createdAt,
} as const;

export const publicMessageSelect = {
  id: campaignMessages.id,
  donorName: campaignMessages.donorName,
  donorLocation: campaignMessages.donorLocation,
  message: campaignMessages.message,
  isAnonymous: campaignMessages.isAnonymous,
  createdAt: campaignMessages.createdAt,
} as const;
```

**What's EXCLUDED from `publicCampaignSelect`**:
- `simulation_flag` — reveals campaign type
- `simulationConfig` — reveals simulation parameters
- `source` — reveals `'automated'` vs `'manual'` origin
- `campaignProfile` — reveals trajectory profile with donation velocity, surge events, etc.

#### 3.2.2 Create `PublicCampaign` Type

**New file**: `src/types/public.ts`

```typescript
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
  createdAt: Date | string;
  updatedAt: Date | string;
  publishedAt: Date | string | null;
  completedAt: Date | string | null;
  lastDonorId: string | null;
  lastDonorName: string | null;
  lastDonorAmount: number | null;
};

export type PublicCampaignCard = {
  id: string;
  title: string;
  slug: string;
  status: string;
  heroImageUrl: string;
  category: string;
  location: string | null;
  subjectName: string;
  subjectHometown: string | null;
  campaignOrganizer: unknown;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  publishedAt: Date | string | null;
};

export type PublicDonation = {
  id: string;
  donorName: string;
  donorLocation: string | null;
  amount: number;
  message: string | null;
  isAnonymous: boolean;
  createdAt: Date | string;
};

export type PublicMessage = {
  id: string;
  donorName: string;
  donorLocation: string | null;
  message: string;
  isAnonymous: boolean;
  createdAt: Date | string;
};
```

#### 3.2.3 Update Campaign Detail API — CRITICAL FIX

**File**: `src/app/api/v1/campaigns/[slug]/route.ts`  
**Current** (line ~24): `db.select().from(campaigns)` → returns ALL columns  
**Change**: Replace bare `select()` with `select(publicCampaignSelect)`

**Before**:
```typescript
const [campaign] = await db
  .select()
  .from(campaigns)
  .where(
    and(
      eq(campaigns.slug, slug),
      inArray(campaigns.status, ['active', 'last_donor_zone', 'completed'])
    )
  )
  .limit(1);
```

**After**:
```typescript
import { publicCampaignSelect, publicDonationSelect } from '@/db/public-select';

const [campaign] = await db
  .select(publicCampaignSelect)
  .from(campaigns)
  .where(
    and(
      eq(campaigns.slug, slug),
      inArray(campaigns.status, ['active', 'last_donor_zone', 'completed'])
    )
  )
  .limit(1);
```

**Impact**:
- Response no longer contains `source`, `campaignProfile`, `simulationFlag`, `simulationConfig`
- Closes leak vector L1 (CRITICAL)
- No frontend changes needed — frontend already doesn't use these fields

#### 3.2.4 Update Campaign Detail SSR Page — CRITICAL FIX

**File**: `src/app/campaigns/[slug]/page.tsx`  
**Current** (line ~33): `getCampaign()` uses `db.select()` (all columns)  
**Change**: Replace with `select(publicCampaignSelect)`

**Before**:
```typescript
async function getCampaign(slug: string) {
  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(/* ... */)
    .limit(1);
  return campaign;
}
```

**After**:
```typescript
import { publicCampaignSelect } from '@/db/public-select';

async function getCampaign(slug: string) {
  const [campaign] = await db
    .select(publicCampaignSelect)
    .from(schema.campaigns)
    .where(/* ... */)
    .limit(1);
  return campaign;
}
```

**Impact**:
- Server component never receives `source`, `campaignProfile`, `simulationFlag`, `simulationConfig`
- Even React DevTools cannot inspect these fields — they don't exist in the component tree
- Closes leak vector L2 (CRITICAL) and L12 (MEDIUM)

#### 3.2.5 Verify Campaign List API

**File**: `src/app/api/v1/campaigns/route.ts`  
**Current**: Uses explicit column selection — verify it matches `publicCampaignCardSelect`

**Action**: Compare the existing explicit select with `publicCampaignCardSelect`. If they match, import and use `publicCampaignCardSelect` for consistency. If they differ, ensure neither includes `source`, `campaignProfile`, `simulationFlag`, or `simulationConfig`.

**Existing columns selected** (verified from analysis):
- `id, title, slug, status, heroImageUrl, category, location, subjectName, subjectHometown, campaignOrganizer, goalAmount, raisedAmount, donorCount, publishedAt`

**Match**: Exact match with `publicCampaignCardSelect`. Replace inline select with imported constant.

#### 3.2.6 Verify Related Campaigns Query

**File**: `src/app/campaigns/[slug]/page.tsx` → `getRelatedCampaigns()`  
**Current**: Uses explicit select with `id, slug, title, heroImageUrl, subjectName, subjectHometown, campaignOrganizer, category, raisedAmount, goalAmount, donorCount, location`

**Status**: Safe — does NOT include `source`, `campaignProfile`, `simulationFlag`, or `simulationConfig`. Replace with `publicCampaignCardSelect` for consistency.

#### 3.2.7 Audit All Other Campaign Queries

**Files to check**:
- `src/app/page.tsx` → homepage featured campaigns query → verify explicit/safe select
- `src/app/search/page.tsx` or `src/app/api/v1/search/route.ts` → verify campaign data
- `src/app/sitemap.ts` → verify only `slug, updatedAt` selected (no content fields)
- `src/app/api/v1/og/` → OG image generation → verify minimal select
- `src/app/last-donor-wall/page.tsx` → verify only safe fields

**Action for each**: Read file, find any `db.select().from(campaigns)` or `db.select({...}).from(campaigns)`, verify no internal fields are included. If bare `select()` is found, replace with `publicCampaignSelect` or `publicCampaignCardSelect`.

#### 3.2.8 Create Security Test — Query Sanitization Enforcement

**New file**: `test/security/query-sanitization.test.ts`

**Purpose**: Automated test that scans source code to ensure no public-facing route uses bare `select()` on campaigns or selects internal fields.

**Test logic**:
1. Read all `.ts`/`.tsx` files in:
   - `src/app/api/v1/campaigns/` (excluding admin paths)
   - `src/app/api/v1/donations/` (excluding webhook internal logic)
   - `src/app/api/v1/stats/`
   - `src/app/api/v1/search/`
   - `src/app/api/v1/blog/`
   - `src/app/campaigns/`
   - `src/app/page.tsx`
   - `src/app/donate/`
   - `src/app/last-donor-wall/`
   - `src/components/` (all)
2. For each file, assert:
   - Does NOT contain `.select().from(campaigns)` (bare select)
   - Does NOT contain `campaigns.source` (the column reference)
   - Does NOT contain `campaigns.simulationFlag`
   - Does NOT contain `campaigns.simulationConfig`
   - Does NOT contain `campaigns.campaignProfile` UNLESS the file is in `src/lib/seed/` or `src/app/api/v1/admin/` or `src/app/api/v1/cron/`
3. Scan `src/app/` and `src/components/` for imports containing `simulation_flag`, `simulationFlag`, `SimulationConfig`

**Expected result**: Test passes when all public code paths use `publicCampaignSelect`.

---

### 3.3 Simulation Engine Hardening

#### 3.3.1 Replace `SEED_MODE_ENABLED` with `siteSettings`

**File**: `src/app/api/v1/cron/simulate-donations/route.ts`

**Current** (line 17):
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

**Impact**: Simulation can now be toggled at runtime via admin panel without redeploying. The `SEED_MODE_ENABLED` env var becomes a deprecated fallback.

#### 3.3.2 Add Simulation Settings to SettingsMap

**File**: `src/lib/settings.ts`

**Add to `SettingsMap` interface** (after existing settings):
```typescript
// ── Simulation Settings ──────────────────────
'simulation.enabled': boolean;
'simulation.volume': number;
'simulation.categories': string[];
'simulation.max_concurrent': number;
'simulation.phase_out.enabled': boolean;
'simulation.phase_out.threshold_low': number;
'simulation.phase_out.threshold_mid': number;
'simulation.phase_out.threshold_high': number;
'simulation.fund_pool.auto_allocate': boolean;
```

**Add defaults to `SETTINGS_CONFIG`**:
```typescript
'simulation.enabled': {
  default: true,
  label: 'Simulation Active',
  description: 'Enable or disable seed donation simulation globally',
  category: 'simulation',
},
'simulation.volume': {
  default: 1.0,
  label: 'Simulation Volume',
  description: 'Volume multiplier for seed donation rate (0.0 = paused, 1.0 = full)',
  category: 'simulation',
},
// ... etc for all 9 settings
```

**Why**: The settings system already handles defaults, categories, and admin UI metadata. Adding simulation settings here means the existing admin settings page can display them, and `getSetting()` works without any server-side changes.

#### 3.3.3 Modify `runSimulation()` to Filter by `simulation_flag`

**File**: `src/lib/seed/simulation-engine.ts`

**Current** (around line 143):
```typescript
const activeCampaigns = await db
  .select()
  .from(schema.campaigns)
  .where(inArray(schema.campaigns.status, ['active', 'last_donor_zone']));
```

**New**:
```typescript
import { getSetting } from '@/lib/settings.server';
import { and, eq, inArray } from 'drizzle-orm';

// Read settings
const volume = await getSetting('simulation.volume') as number;
const enabledCategories = await getSetting('simulation.categories') as string[];

const activeCampaigns = await db
  .select()
  .from(schema.campaigns)
  .where(
    and(
      inArray(schema.campaigns.status, ['active', 'last_donor_zone']),
      eq(schema.campaigns.simulationFlag, true),  // NEW: only simulated campaigns
    ),
  );

// Filter by enabled categories
const eligibleCampaigns = activeCampaigns.filter(c =>
  enabledCategories.includes(c.category)
);
```

**Impact**: 
- Closes leak vector L10 (CRITICAL): Real campaigns never receive seed donations
- Category filtering allows disabling simulation for specific campaign types
- Volume multiplier applied downstream (see 3.3.4)

#### 3.3.4 Add Volume Multiplier to `shouldDonateThisCycle()`

**File**: `src/lib/seed/simulation-engine.ts`

**Current signature** (line ~63):
```typescript
function shouldDonateThisCycle(
  campaign: Campaign,
  profile: TrajectoryProfile | null,
  currentPhase: DonationPhase,
  surgeMultiplier: number,
): boolean
```

**New signature**:
```typescript
function shouldDonateThisCycle(
  campaign: Campaign,
  profile: TrajectoryProfile | null,
  currentPhase: DonationPhase,
  surgeMultiplier: number,
  volumeMultiplier: number,  // NEW
): boolean
```

**Inside the function**, multiply the effective chance by `volumeMultiplier`:
```typescript
const effectiveChance = profile.baseDonateChance * phaseMultiplier * hourly * surgeMultiplier * volumeMultiplier;
return Math.random() < Math.min(effectiveChance, 1.0);
```

**Impact**: Admin can reduce simulation intensity globally (e.g., `volume=0.5` halves donation frequency).

#### 3.3.5 Add Per-Campaign Pause Check

**File**: `src/lib/seed/simulation-engine.ts`

Inside the main campaign loop (after filtering), add:
```typescript
for (const campaign of eligibleCampaigns) {
  const config = campaign.simulationConfig as SimulationConfig | null;
  
  // Per-campaign pause
  if (config?.paused) continue;
  
  // Per-campaign volume override
  const campaignVolume = config?.volumeOverride ?? volume;
  
  // ... existing donation logic, using campaignVolume as volumeMultiplier
}
```

**Impact**: Individual campaigns can be paused/adjusted without affecting others.

#### 3.3.6 Modify `update-phases` Cron to Skip Real Campaigns

**File**: `src/app/api/v1/cron/update-phases/route.ts`

**Current**: Generates AI organizer updates for ALL active campaigns.

**Problem**: If a real campaign exists, it would receive AI-generated updates from a fictional organizer — destroying authenticity.

**Change**: Add a filter in the campaign loop:
```typescript
for (const campaign of activeCampaigns) {
  if (!campaign.campaignOrganizer) continue;
  
  // Only auto-generate organizer updates for simulated campaigns
  if (!campaign.simulationFlag) continue;  // NEW
  
  // ... existing AI update generation logic
}
```

**Impact**: Closes leak vector L11 (CRITICAL). Real campaigns only get updates from their real organizers via the admin interface.

**Alternate approach**: Modify the initial query to include `eq(campaigns.simulationFlag, true)`. But the loop filter is safer — it's a defense-in-depth measure that works even if the query changes.

#### 3.3.7 Update Simulation Engine Tests

**Files**: `src/lib/seed/simulation-engine.test.ts` and related test files

**New test cases**:
1. `runSimulation()` only queries campaigns with `simulation_flag=true`
2. `shouldDonateThisCycle()` respects `volumeMultiplier` parameter
3. Campaigns with `simulationConfig.paused=true` are skipped
4. Categories not in `simulation.categories` setting are skipped  
5. `update-phases` cron skips campaigns with `simulation_flag=false`

---

### 3.4 Seed Data Sanitization

#### 3.4.1 Create `generateRealisticPaymentId()` Function

**File**: `src/lib/seed/simulation-engine.ts` (add near top, among helper functions)

**Current** (line 210):
```typescript
stripePaymentId: `seed_${crypto.randomUUID()}`,
```

**New function**:
```typescript
function generateRealisticPaymentId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'pi_';
  for (let i = 0; i < 24; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
```

**Format**: `pi_` + 24 alphanumeric characters — identical to Stripe's real PaymentIntent ID format.

**Replace all occurrences**: 
- Line 210 in main donation insertion
- Line ~282 in cohort donation insertion (if separate)

**Verification**: The reconciliation cron (`/api/v1/cron/reconcile`) queries by `donations.source` column, NOT by `stripePaymentId` prefix. The admin seed purge also queries by `source = 'seed'`. So this change is safe systemically.

**Residual risk**: Stripe API will never return a matching ID for these fake IDs. This is acceptable because:
- We never look up seed donations against Stripe
- The webhook handler matches by Stripe event's `paymentIntent.id`, which only fires for real payments

#### 3.4.2 Create `generateRealisticEmail()` Function

**File**: `src/lib/seed/simulation-engine.ts`

**Current** (line 214):
```typescript
donorEmail: `seed-${crypto.randomUUID().slice(0, 8)}@lastdonor.internal`,
```

**New function**:
```typescript
function generateRealisticEmail(donorName: string): string {
  const domains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com',
    'comcast.net', 'att.net', 'verizon.net', 'msn.com',
  ];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  
  const nameParts = donorName.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const first = nameParts[0] || 'user';
  const last = nameParts[nameParts.length - 1] || '';
  
  const styles = [
    () => `${first}${last}${Math.floor(Math.random() * 99)}`,
    () => `${first}.${last}`,
    () => `${first}${Math.floor(Math.random() * 999)}`,
    () => `${first[0]}${last}${Math.floor(Math.random() * 9)}`,
    () => `${first}_${last}`,
    () => `${first}${last.slice(0, 3)}${Math.floor(Math.random() * 99)}`,
  ];
  const username = styles[Math.floor(Math.random() * styles.length)]();
  
  return `${username.replace(/[^a-z0-9._]/g, '')}@${domain}`;
}
```

**Replace all occurrences**:
- Main donation insertion (line 214)
- Cohort donation insertion (line ~282)

**Safety**: These emails are never used for outbound email. The Stripe webhook handler sends receipts only for `source='real'` donations. Seed donations bypass Stripe entirely. The `donorEmail` field on seed donations is only visible in admin DB queries.

#### 3.4.3 Backfill Existing Seed Data

**Migration script** (run as part of `0014_dual_campaign_system.sql` or as a separate application-level migration):

**Stripe IDs**:
```sql
UPDATE donations
SET stripe_payment_id = 'pi_' || substring(encode(gen_random_bytes(18), 'hex') from 1 for 24)
WHERE source = 'seed' AND stripe_payment_id LIKE 'seed_%';
```

**Emails** (more complex — needs application code to generate from donor names):
```typescript
// Run as a one-time script
const seedDonations = await db
  .select({ id: donations.id, donorName: donations.donorName })
  .from(donations)
  .where(
    and(
      eq(donations.source, 'seed'),
      like(donations.donorEmail, '%@lastdonor.internal')
    )
  );

for (const d of seedDonations) {
  const newEmail = generateRealisticEmail(d.donorName);
  await db
    .update(donations)
    .set({ donorEmail: newEmail })
    .where(eq(donations.id, d.id));
}
```

#### 3.4.4 Update Tests for New Formats

**File**: `src/lib/seed/simulation-engine.test.ts`

**New assertions**:
```typescript
// Stripe ID format
expect(donation.stripePaymentId).toMatch(/^pi_[A-Za-z0-9]{24}$/);

// Email format — no @lastdonor.internal
expect(donation.donorEmail).not.toContain('@lastdonor.internal');
expect(donation.donorEmail).toMatch(/^[a-z0-9._]+@[a-z]+\.[a-z]+$/);

// Domain diversity
const domains = donations.map(d => d.donorEmail.split('@')[1]);
expect(new Set(domains).size).toBeGreaterThan(3);
```

---

### 3.5 News Pipeline Update

#### 3.5.1 Set `simulation_flag` on Auto-Created Campaigns

**File**: `src/lib/news/news-pipeline.ts`

In the campaign insertion (Step 8, around line 307), add two new fields:
```typescript
simulationFlag: true,
simulationConfig: { paused: false, fundAllocation: 'pool' },
```

These are added to the existing `db.insert(schema.campaigns).values({...})` call alongside the existing `source: 'automated'` field.

#### 3.5.2 Respect `max_concurrent` Setting

**File**: `src/lib/news/news-pipeline.ts`

Before creating a new campaign (Step 8), check the concurrent limit:
```typescript
import { getSetting } from '@/lib/settings.server';

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
  result.errors.push(`Max concurrent simulated campaigns (${maxConcurrent}) reached — skipping campaign creation`);
  continue; // Skip this news item
}
```

**Where to insert**: Just before the `db.insert(schema.campaigns)` call in the pipeline's campaign creation loop.

#### 3.5.3 Respect `simulation.enabled` Setting

If simulation is disabled globally, the news pipeline should stop creating new simulated campaigns:
```typescript
const simulationEnabled = await getSetting('simulation.enabled');
if (!simulationEnabled) {
  result.errors.push('Simulation disabled — skipping campaign creation');
  break;
}
```

#### 3.5.4 Respect Category Filtering

```typescript
const enabledCategories = await getSetting('simulation.categories') as string[];
if (!enabledCategories.includes(entity.category)) {
  result.skipped.push({ title: entity.name, reason: `Category ${entity.category} disabled for simulation` });
  continue;
}
```

#### 3.5.5 Update Pipeline Tests

**Files**: News pipeline test files

**New test cases**:
1. Pipeline sets `simulationFlag=true` on generated campaigns
2. Pipeline respects `max_concurrent` setting
3. Pipeline respects `simulation.enabled` setting
4. Pipeline respects category filtering

---

## 4. Milestone 8: Donation Routing & Fund Pool

### 4.1 Donation Router Modification

#### 4.1.1 Modify `create-intent` Route

**File**: `src/app/api/v1/donations/create-intent/route.ts`

**Current campaign lookup**:
```typescript
const [campaign] = await db
  .select({
    id: campaigns.id,
    title: campaigns.title,
    status: campaigns.status,
  })
  .from(campaigns)
  .where(/* ... */)
  .limit(1);
```

**New campaign lookup** (add `simulationFlag`):
```typescript
const [campaign] = await db
  .select({
    id: campaigns.id,
    title: campaigns.title,
    status: campaigns.status,
    simulationFlag: campaigns.simulationFlag,  // INTERNAL USE ONLY — never returned in response
  })
  .from(campaigns)
  .where(/* ... */)
  .limit(1);
```

**Add `fundPool` metadata to Stripe PaymentIntent**:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
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
    fundPool: campaign.simulationFlag ? 'true' : 'false',  // NEW — internal tag
  },
}, /* ... */);
```

**Response**: UNCHANGED. The response `{ clientSecret, paymentIntentId, amount, campaignTitle }` is identical regardless of `simulationFlag`. The `fundPool` metadata is stored in Stripe, not returned to the client.

**Why Stripe metadata**: We need to know at webhook time whether the donation went to a simulated campaign. Stripe metadata is the cleanest way — it travels with the payment through Stripe's system and is available in the `payment_intent.succeeded` event.

#### 4.1.2 Verify Response Identity

**Requirement**: The API response for a real campaign donation and a simulated campaign donation must be byte-identical in structure. The only difference is the `paymentIntentId` and `clientSecret` values (which are Stripe-generated and opaque).

**Test**: Create integration test that:
1. Creates two campaigns: one with `simulationFlag=true`, one with `simulationFlag=false`
2. Calls `create-intent` for both with identical amounts
3. Asserts response keys are identical
4. Asserts `fundPool` does NOT appear in response body

### 4.2 Webhook Handler — Fund Pool Tracking

#### 4.2.1 Modify `handlePaymentSuccess()`

**File**: `src/app/api/v1/donations/webhook/route.ts`

After the existing donation insertion and campaign tally update (inside the transaction), add:

```typescript
// Check if this donation went to a simulated campaign (fund pool)
const isFundPool = meta.fundPool === 'true';

if (isFundPool) {
  // Track for fund pool allocation
  await tx.insert(schema.fundPoolAllocations).values({
    donationId: donationRecord.id,
    sourceCampaignId: campaignId,
    amount,
    status: 'pending',
  });

  // Audit log
  await tx.insert(schema.auditLogs).values({
    eventType: 'fund_pool.donation_received',
    targetType: 'donation',
    targetId: donationRecord.id,
    severity: 'info',
    details: {
      amount,
      campaignId,
      donorEmail: meta.donorEmail,
      paymentIntentId: paymentIntent.id,
    },
  });
}
```

**Impact**: 
- Every real dollar entering through a simulated campaign is tracked
- Admin can view pending allocations and decide where to direct funds
- The donation itself is recorded normally — `raisedAmount` and `donorCount` on the campaign are updated identically

**Receipt email**: Sent as normal. The donor receives a legitimate Stripe receipt referencing "LastDonor.org" — there's no indication the campaign is simulated.

#### 4.2.2 Campaign Message Insertion from Webhook

Also in `handlePaymentSuccess()`, after donation insertion, if the donor included a message:

```typescript
if (message) {
  await tx.insert(schema.campaignMessages).values({
    campaignId,
    userId: user?.id ?? null,
    donorName: meta.isAnonymous === 'true' ? 'Anonymous' : meta.donorName,
    donorLocation: meta.isAnonymous === 'true' ? null : (meta.donorLocation || null),
    message,
    isAnonymous: meta.isAnonymous === 'true',
    donationId: donationRecord.id,
  });
}
```

**Why**: The `campaign_messages` table powers the message wall. Donation messages should appear on both the donor feed (via `donations.message`) and the message wall (via `campaign_messages`).

### 4.3 Fund Pool Admin API

#### 4.3.1 `GET /api/v1/admin/fund-pool`

**New file**: `src/app/api/v1/admin/fund-pool/route.ts`

**Purpose**: List fund pool allocations with pagination and filters.

**Auth**: `requireRole(['admin'])`

**Query params**: `status` (pending/allocated/disbursed), `page`, `limit`

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "donationId": "uuid",
      "sourceCampaign": { "id": "uuid", "title": "...", "slug": "..." },
      "targetCampaign": null,
      "amount": 5000,
      "status": "pending",
      "createdAt": "2026-03-25T10:30:00Z"
    }
  ],
  "meta": {
    "total": 14,
    "pending": 8,
    "allocated": 4,
    "disbursed": 2,
    "totalPending": 245000,
    "totalAllocated": 120000,
    "totalDisbursed": 80000
  }
}
```

#### 4.3.2 `POST /api/v1/admin/fund-pool/allocate`

**New file**: `src/app/api/v1/admin/fund-pool/allocate/route.ts`

**Purpose**: Allocate pending funds to a specific real campaign.

**Auth**: `requireRole(['admin'])`

**Request body**:
```json
{
  "allocationIds": ["uuid1", "uuid2"],
  "targetCampaignId": "uuid",
  "notes": "Funds allocated to verified beneficiary Sarah Johnson"
}
```

**Logic**:
1. Validate all allocation IDs exist and have `status='pending'`
2. Validate target campaign exists and has `simulationFlag=false`
3. Update all allocations: `status='allocated'`, `targetCampaignId`, `allocatedAt=now()`
4. Audit log entry

#### 4.3.3 `POST /api/v1/admin/fund-pool/disburse`

**New file**: `src/app/api/v1/admin/fund-pool/disburse/route.ts`

**Purpose**: Mark allocated funds as disbursed (payment sent to beneficiary).

**Auth**: `requireRole(['admin'])`

**Logic**: Similar to allocate — updates `status='disbursed'`, sets `disbursedAt=now()`.

#### 4.3.4 `GET /api/v1/admin/fund-pool/export`

**New file**: `src/app/api/v1/admin/fund-pool/export/route.ts`

**Purpose**: Export fund pool data as CSV for financial reporting.

**Columns**: Allocation ID, Donation Amount, Source Campaign, Target Campaign, Status, Created, Allocated, Disbursed.

### 4.4 Reconciliation Update

#### 4.4.1 Add Fund Pool Health Check to Daily Reconcile

**File**: `src/app/api/v1/cron/reconcile/route.ts`

Add a new section after existing reconciliation logic:

```typescript
// Fund Pool reconciliation
const [pendingPool] = await db
  .select({
    count: sql<number>`count(*)::int`,
    total: sql<number>`coalesce(sum(amount), 0)::int`,
  })
  .from(schema.fundPoolAllocations)
  .where(eq(schema.fundPoolAllocations.status, 'pending'));

if (pendingPool.total > 100000) { // > $1000 pending
  // Generate admin notification
  await db.insert(schema.notifications).values({
    userId: adminUserId, // lookup admin
    type: 'campaign_status_changed', // reuse closest type
    title: 'Fund Pool Alert',
    message: `$${(pendingPool.total / 100).toFixed(2)} in pending fund pool allocations (${pendingPool.count} donations). Review at /admin/simulation/fund-pool`,
    link: '/admin/simulation/fund-pool',
  });
}
```

#### 4.4.2 Auto-Allocate (Optional)

If `simulation.fund_pool.auto_allocate` is enabled:
```typescript
const autoAllocate = await getSetting('simulation.fund_pool.auto_allocate');
if (autoAllocate) {
  // Find pending allocations
  // Match by category to active real campaigns
  // Auto-allocate proportionally
  // Audit log each allocation
}
```

**Logic**: 
1. Group pending allocations by source campaign category
2. Find active real campaigns in the same category
3. Distribute proportionally by remaining funds needed
4. Create audit log entries

---

## 5. Milestone 9: Messaging System

### 5.1 Message API Routes

#### 5.1.1 `GET /api/v1/campaigns/[slug]/messages`

**New file**: `src/app/api/v1/campaigns/[slug]/messages/route.ts`

**Auth**: None (public)

**Purpose**: Return paginated messages for a campaign's message wall.

**Query params**: `cursor` (offset), `limit` (default 20, max 50)

**Implementation**:
```typescript
import { publicMessageSelect } from '@/db/public-select';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const url = new URL(request.url);
  const cursor = parseInt(url.searchParams.get('cursor') || '0');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

  // Find campaign by slug
  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.slug, slug),
        inArray(campaigns.status, ['active', 'last_donor_zone', 'completed']),
      )
    )
    .limit(1);

  if (!campaign) return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });

  const messages = await db
    .select(publicMessageSelect)
    .from(campaignMessages)
    .where(
      and(
        eq(campaignMessages.campaignId, campaign.id),
        eq(campaignMessages.hidden, false),
      )
    )
    .orderBy(desc(campaignMessages.createdAt))
    .offset(cursor)
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const data = messages.slice(0, limit).map(m => ({
    ...m,
    donorName: m.isAnonymous ? 'Anonymous' : m.donorName,
    donorLocation: m.isAnonymous ? null : m.donorLocation,
  }));

  return NextResponse.json({
    ok: true,
    data,
    meta: { cursor: hasMore ? cursor + limit : null, hasMore },
  });
}
```

**Key points**:
- Uses `publicMessageSelect` — never returns `flagged`, `hidden`, `userId`, or `donationId`
- Filters out hidden messages at query level
- Anonymous masking applied (same pattern as DonorFeed)
- Paginated with offset-based cursor (consistent with donors endpoint)

#### 5.1.2 `POST /api/v1/campaigns/[slug]/messages`

**Same file**: `src/app/api/v1/campaigns/[slug]/messages/route.ts`

**Auth**: Authenticated users only (`session.user` required)

**Rate limit**: 5 messages per user per campaign per day

**Validation schema** (add to `src/lib/validators/`):
```typescript
export const messageSchema = z.object({
  message: z.string().min(1).max(500).transform(val => sanitizeText(val)),
  isAnonymous: z.boolean().default(false),
});
```

**Implementation**:
```typescript
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { slug } = params;
  const [campaign] = await db
    .select({ id: campaigns.id, status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.slug, slug))
    .limit(1);

  if (!campaign || !['active', 'last_donor_zone', 'completed'].includes(campaign.status)) {
    return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
  }

  // Rate limiting
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

  if (recentCount.count >= 5) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded. Maximum 5 messages per campaign per day.' },
      { status: 429 }
    );
  }

  // Insert message
  const [message] = await db.insert(campaignMessages).values({
    campaignId: campaign.id,
    userId: session.user.id,
    donorName: parsed.data.isAnonymous ? 'Anonymous' : (session.user.name ?? 'Donor'),
    donorLocation: parsed.data.isAnonymous ? null : (session.user.location ?? null),
    message: parsed.data.message,
    isAnonymous: parsed.data.isAnonymous,
  }).returning({ id: campaignMessages.id, createdAt: campaignMessages.createdAt });

  return NextResponse.json({ ok: true, data: { id: message.id, createdAt: message.createdAt } }, { status: 201 });
}
```

### 5.2 Seed Engine Integration

#### 5.2.1 Insert Messages into `campaign_messages` from Simulation Engine

**File**: `src/lib/seed/simulation-engine.ts`

When the simulation engine inserts a seed donation that includes a message, it should also insert into `campaign_messages`:

**Location**: After the `db.insert(schema.donations)` call, inside the same loop iteration:

```typescript
if (message) {
  await db.insert(schema.campaignMessages).values({
    campaignId: campaign.id,
    donorName: selectedDonor.isAnonymous ? 'Anonymous' : selectedDonor.displayName,
    donorLocation: selectedDonor.isAnonymous ? null : (selectedDonor.displayLocation || null),
    message,
    isAnonymous: selectedDonor.isAnonymous,
    donationId: donationRecord.id,
    createdAt: donationTime, // Use jittered timestamp for consistency
  });
}
```

**Why**: This ensures the message wall has messages from both real donors and seed donors, making it impossible to distinguish based on where messages appear.

#### 5.2.2 Handle Cohort Donations

Similarly, in the cohort injection code (`maybeBuildCohort()`), insert messages for cohort members who have messages:

```typescript
// Inside cohort member loop
if (cohortMember.message) {
  await db.insert(schema.campaignMessages).values({
    campaignId: campaign.id,
    donorName: cohortMember.isAnonymous ? 'Anonymous' : cohortMember.displayName,
    donorLocation: cohortMember.isAnonymous ? null : (cohortMember.displayLocation || null),
    message: cohortMember.message,
    isAnonymous: cohortMember.isAnonymous,
    donationId: cohortDonationRecord.id,
    createdAt: cohortDonationTime,
  });
}
```

### 5.3 Frontend Components

#### 5.3.1 `MessageWall` Component

**New file**: `src/components/campaign/MessageWall.tsx`

**Props**:
```typescript
interface MessageWallProps {
  campaignSlug: string;
  initialMessages: PublicMessage[];
}
```

**Features**:
- Renders paginated list of messages
- Polling for new messages every 30 seconds (same pattern as DonorFeed)
- "Load more" button for pagination
- Avatar circle with initial letter (from donorName)
- Relative time display (e.g., "2 hours ago") using same util as DonorFeed
- Message text with max height and "Read more" expansion for long messages
- Empty state: "No messages yet. Be the first to leave a message of support!"
- `aria-live="polite"` for accessibility on new message arrivals

**Layout**: Below the DonorFeed section on the campaign page, or in a tabbed interface.

#### 5.3.2 `MessageForm` Component

**New file**: `src/components/campaign/MessageForm.tsx`

**Props**:
```typescript
interface MessageFormProps {
  campaignSlug: string;
}
```

**Features**:
- Text input (max 500 chars) with character counter
- Anonymous toggle (Switch component from shadcn/ui)
- Submit button with loading state  
- Success toast via Sonner
- Auth gate: If not authenticated, show "Sign in to leave a message" with link to `/login?redirect=/campaigns/${slug}`
- Error handling: Rate limit exceeded (429) shows specific message
- Optimistic update: New message appears immediately in MessageWall

#### 5.3.3 Campaign Page Integration

**File**: `src/app/campaigns/[slug]/page.tsx`

Add data fetcher:
```typescript
async function getMessages(campaignId: string) {
  return db
    .select(publicMessageSelect)
    .from(campaignMessages)
    .where(
      and(
        eq(campaignMessages.campaignId, campaignId),
        eq(campaignMessages.hidden, false),
      )
    )
    .orderBy(desc(campaignMessages.createdAt))
    .limit(20);
}
```

Add to JSX:
```tsx
<MessageWall campaignSlug={slug} initialMessages={messages} />
```

Also update `CampaignDetailClient` to include MessageForm (client-side interactive):
```tsx
<MessageForm campaignSlug={slug} />
```

#### 5.3.4 Component Tests

**New files**:
- `src/components/campaign/MessageWall.test.tsx` — Render with mock data, empty state, anonymous masking
- `src/components/campaign/MessageForm.test.tsx` — Form validation, character counter, auth gate display

### 5.4 Admin Message Moderation

#### 5.4.1 Moderation API

**New file**: `src/app/api/v1/admin/campaigns/[campaignId]/messages/[messageId]/moderate/route.ts`

**Auth**: `requireRole(['admin', 'editor'])`

**Actions**: `flag`, `hide`, `unhide`

**Implementation**:
```typescript
export async function POST(request: Request, { params }) {
  const { campaignId, messageId } = params;
  const { action } = await request.json();

  const updates: Record<string, boolean> = {};
  if (action === 'flag') updates.flagged = true;
  if (action === 'hide') updates.hidden = true;
  if (action === 'unhide') { updates.hidden = false; updates.flagged = false; }

  await db.update(campaignMessages).set(updates).where(eq(campaignMessages.id, messageId));

  // Audit log
  await db.insert(auditLogs).values({
    eventType: `message.${action}`,
    actorId: session.user.id,
    actorRole: session.user.role,
    targetType: 'message',
    targetId: messageId,
    severity: 'info',
    details: { campaignId, action },
  });

  // If hiding, notify the message author (if they have a user account)
  if (action === 'hide') {
    const [msg] = await db.select({ userId: campaignMessages.userId }).from(campaignMessages).where(eq(campaignMessages.id, messageId)).limit(1);
    if (msg?.userId) {
      await db.insert(notifications).values({
        userId: msg.userId,
        type: 'message_flagged',
        title: 'Message Hidden',
        message: 'One of your messages has been hidden by a moderator.',
        link: `/campaigns/${campaignId}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

#### 5.4.2 Admin Message List

Add message listing capability to the existing admin campaign detail page (`src/app/admin/campaigns/[id]/page.tsx`). Show messages tab with all messages (including hidden/flagged), with moderation action buttons.

---

## 6. Milestone 10: Admin Simulation Controls

### 6.1 Settings API

#### 6.1.1 `GET /api/v1/admin/simulation/settings`

**New file**: `src/app/api/v1/admin/simulation/settings/route.ts`

**Auth**: `requireRole(['admin'])`

**Response**: All simulation settings from `siteSettings` table:
```json
{
  "ok": true,
  "data": {
    "enabled": true,
    "volume": 1.0,
    "categories": ["medical", "disaster", "military", "veterans", "memorial", "first-responders", "community", "essential-needs"],
    "maxConcurrent": 20,
    "phaseOut": {
      "enabled": false,
      "thresholdLow": 10,
      "thresholdMid": 25,
      "thresholdHigh": 50
    },
    "fundPool": {
      "autoAllocate": false
    }
  }
}
```

#### 6.1.2 `PUT /api/v1/admin/simulation/settings`

**Same file**

**Validation**:
- `volume`: 0.0–1.0
- `maxConcurrent`: > 0
- `categories`: each must be in valid campaign categories enum
- `thresholdLow < thresholdMid < thresholdHigh`

**Logic**: Updates each setting via `updateSettings()` (existing function in `settings.server.ts`). Audit log entry for every change.

### 6.2 Campaign Management API

#### 6.2.1 `GET /api/v1/admin/simulation/campaigns`

**New file**: `src/app/api/v1/admin/simulation/campaigns/route.ts`

**Response**: List of all simulated campaigns with extended stats:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "title": "Help for Sarah's Family",
      "slug": "help-for-sarahs-family",
      "status": "active",
      "category": "medical",
      "progress": 72,
      "raisedAmount": 3600000,
      "goalAmount": 5000000,
      "donorCount": 87,
      "realDonationCount": 3,
      "realDonationTotal": 15000,
      "seedDonationCount": 84,
      "seedDonationTotal": 3585000,
      "fundPoolPending": 15000,
      "paused": false,
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ],
  "meta": {
    "totalActive": 18,
    "totalPaused": 2,
    "completedThisMonth": 5
  }
}
```

**Query**: Joins `campaigns` (where `simulationFlag=true`) with aggregated donation counts by `source`.

#### 6.2.2 Pause/Resume/Convert Endpoints

**New files**:
- `src/app/api/v1/admin/simulation/campaigns/[id]/pause/route.ts`
- `src/app/api/v1/admin/simulation/campaigns/[id]/resume/route.ts`
- `src/app/api/v1/admin/simulation/campaigns/[id]/convert/route.ts`

**Pause** — Sets `simulation_config.paused = true`:
```typescript
const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
const config = (campaign.simulationConfig as SimulationConfig) || { paused: false, fundAllocation: 'pool' };
config.paused = true;
await db.update(campaigns).set({ simulationConfig: config }).where(eq(campaigns.id, id));
// Audit log
```

**Resume** — Sets `simulation_config.paused = false`:
```typescript
config.paused = false;
// ... same pattern
```

**Convert** (simulated → real) — Multi-step process:
1. Validate campaign exists and `simulationFlag=true`
2. Accept required `beneficiaryInfo` from request body
3. Set `simulationFlag = false`
4. Clear `simulationConfig` or set `{ paused: false, fundAllocation: 'located_beneficiary' }`
5. Transfer any pending fund pool allocations: update `status` to `'allocated'`, set `targetCampaignId` to this campaign
6. Audit log entry with conversion details
7. All existing seed donations REMAIN — they're part of campaign history
8. All existing real donations REMAIN — they continue normally
9. Campaign stops receiving seed donations (engine filter catches `simulationFlag=false`)

### 6.3 Analytics API

#### 6.3.1 `GET /api/v1/admin/simulation/analytics`

**New file**: `src/app/api/v1/admin/simulation/analytics/route.ts`

**Response**:
```json
{
  "ok": true,
  "data": {
    "campaigns": {
      "simulated": { "active": 18, "completed": 27, "archived": 10, "total": 55 },
      "real": { "active": 12, "completed": 5, "archived": 3, "total": 20 }
    },
    "donations": {
      "seed": { "count": 2340, "total": 4780000 },
      "real": { "count": 89, "total": 425000 }
    },
    "ratio": {
      "current": 26.3,
      "trend": "declining"
    },
    "fundPool": {
      "pending": 245000,
      "allocated": 120000,
      "disbursed": 80000
    },
    "categories": [
      { "category": "medical", "simulated": 8, "real": 5, "seedDonations": 820000, "realDonations": 210000 },
      { "category": "disaster", "simulated": 4, "real": 3, "seedDonations": 650000, "realDonations": 95000 }
    ]
  }
}
```

### 6.4 Admin UI Pages

#### 6.4.1 Main Simulation Control Panel

**New file**: `src/app/admin/simulation/page.tsx`

**Layout** (as described in Doc 15, Section 11.2):
- Global Controls card: Toggle, Volume slider, Max Concurrent input
- Category Controls card: Checkbox grid for enabled categories
- Phase-Out Configuration card: Toggle, thresholds, current auto-volume display
- Fund Pool summary card: Pending/Allocated/Disbursed totals with action links
- Active Simulated Campaigns table: Title, Progress, Status, Pause/Convert actions
- Analytics summary: Simulated vs Real counts, donation totals, ratio

**Data fetching**: Calls the three admin APIs (settings, campaigns, analytics) from the server component.

**Client interactions**: Toggle/slider/checkbox changes call `PUT /api/v1/admin/simulation/settings`. Pause/Convert buttons call respective endpoints.

#### 6.4.2 Fund Pool Management Page

**New file**: `src/app/admin/simulation/fund-pool/page.tsx`

**Features**:
- Pending allocations list with source campaign context
- Allocate-to-campaign dialog (search for real campaigns, select, confirm)
- Disburse confirmation dialog
- Export CSV button
- Statistics summary cards

#### 6.4.3 Analytics Dashboard Page

**New file**: `src/app/admin/simulation/analytics/page.tsx`

**Features**:
- Charts: Simulated vs real campaigns over time (line chart)
- Charts: Seed vs real donations over time (bar chart)
- Table: Per-category breakdown
- Seed-to-real ratio trend (declining = healthy growth)

#### 6.4.4 Admin Sidebar Update

**File**: `src/components/admin/AdminSidebar.tsx`

Add simulation section (visible to admin role only, not editors):
```typescript
{
  label: 'Simulation',
  icon: AdjustmentsHorizontalIcon,
  href: '/admin/simulation',
  children: [
    { label: 'Controls', href: '/admin/simulation' },
    { label: 'Fund Pool', href: '/admin/simulation/fund-pool' },
    { label: 'Analytics', href: '/admin/simulation/analytics' },
  ],
}
```

### 6.5 Phase-Out Automation

#### 6.5.1 Auto-Volume Calculation

**New function**: `src/lib/seed/phase-out.ts`

```typescript
export async function calculateAutoVolume(): Promise<number> {
  const phaseOutEnabled = await getSetting('simulation.phase_out.enabled');
  if (!phaseOutEnabled) return -1; // -1 = not applicable
  
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
  
  if (realCampaigns >= thresholds.high) return 0.0;
  if (realCampaigns >= thresholds.mid) return 0.3;
  if (realCampaigns >= thresholds.low) return 0.7;
  return 1.0;
}
```

#### 6.5.2 Integrate into Simulation Cron

**File**: `src/app/api/v1/cron/simulate-donations/route.ts`

After checking `simulation.enabled`, check phase-out volume:
```typescript
import { calculateAutoVolume } from '@/lib/seed/phase-out';

const autoVolume = await calculateAutoVolume();
const manualVolume = await getSetting('simulation.volume') as number;

// Use the lower of manual and auto-computed volume
const effectiveVolume = autoVolume >= 0 ? Math.min(manualVolume, autoVolume) : manualVolume;

if (effectiveVolume === 0) {
  return NextResponse.json({
    ok: true,
    data: { skipped: true, reason: 'Effective volume is 0 (phase-out or manual)' },
  });
}

// Pass effectiveVolume to runSimulation
const result = await runSimulation(effectiveVolume);
```

#### 6.5.3 Integrate into News Pipeline

**File**: `src/lib/news/news-pipeline.ts`

Before creating new simulated campaigns:
```typescript
const autoVolume = await calculateAutoVolume();
if (autoVolume === 0) {
  result.errors.push('Phase-out threshold reached — no new simulated campaigns');
  break;
}
```

---

## 7. Milestone 11: Adversarial Testing & Hardening

### 7.1 API Response Audit Test

**New file**: `test/security/api-response-audit.test.ts`

**Purpose**: Scan every public API response for simulation-related field names or values.

**Test logic**:
```typescript
const PUBLIC_ENDPOINTS = [
  { method: 'GET', url: '/api/v1/campaigns' },
  { method: 'GET', url: '/api/v1/campaigns/test-slug' },
  { method: 'GET', url: '/api/v1/campaigns/test-slug/donors' },
  { method: 'GET', url: '/api/v1/stats' },
  // ... all public endpoints
];

const FORBIDDEN_KEYS = [
  'simulation_flag', 'simulationFlag', 'simulation_config', 'simulationConfig',
  'campaignProfile', 'source',
];

const FORBIDDEN_VALUES = [
  'automated', 'seed', 'simulated', '@lastdonor.internal',
];

for (const endpoint of PUBLIC_ENDPOINTS) {
  test(`${endpoint.method} ${endpoint.url} contains no simulation data`, async () => {
    const response = await fetch(endpoint.url);
    const body = await response.text();
    
    for (const key of FORBIDDEN_KEYS) {
      expect(body).not.toContain(`"${key}"`);
    }
    for (const value of FORBIDDEN_VALUES) {
      expect(body).not.toContain(value);
    }
  });
}
```

### 7.2 Statistical Donation Analysis Test

**New file**: `test/security/donation-patterns.test.ts`

**Tests**:
1. **Timestamp uniformity**: Generate 500 seed donations, extract minutes within 15-min windows, chi-squared test for uniform distribution (p > 0.05)
2. **Amount distribution**: Verify amounts follow psychological pricing patterns (no round numbers dominate)
3. **Donor name uniqueness**: Assert ≤10% repeat rate across 500 donations
4. **Stripe ID format**: All IDs match `^pi_[A-Za-z0-9]{24}$`
5. **Email domain diversity**: At least 5 unique domains across 500 emails

### 7.3 Cross-Campaign Indistinguishability Test

**New file**: `test/security/indistinguishability.test.ts`

**Test logic**:
1. Create Campaign A with `simulationFlag=true`
2. Create Campaign B with `simulationFlag=false`
3. Both have identical category, goal, status
4. Fetch both via `GET /api/v1/campaigns/[slug]`
5. Assert: Response objects have identical keys (same set of keys)
6. Assert: No key in A exists that doesn't exist in B, and vice versa
7. Assert: `Object.keys(responseA).sort()` === `Object.keys(responseB).sort()`

### 7.4 Frontend Code Audit Test

**New file**: `test/security/frontend-audit.test.ts`

**Test logic**:
```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const SCAN_DIRS = ['src/app', 'src/components'];
const FORBIDDEN_PATTERNS = [
  /simulation_flag/i,
  /simulationFlag/i,
  /SimulationConfig/i,
  /campaigns\.source/,
  /campaignProfile/,
  /simulation_config/i,
  /simulationConfig/i,
  /'seed'/,  // Only flag if used as a comparison value, not a word
];

// Recursively scan all .ts/.tsx files in SCAN_DIRS
// For each file, check against FORBIDDEN_PATTERNS
// EXCLUDE: src/app/api/v1/admin/, src/app/api/v1/cron/, src/app/admin/
```

### 7.5 E2E Tests

#### 7.5.1 Dual Campaign E2E

**New file**: `e2e/e2e-16-dual-campaign.spec.ts`

**Scenarios**:
1. Navigate to a simulated campaign page → verify renders correctly
2. Navigate to a real campaign page → verify renders correctly
3. Both pages have identical DOM structure (same component set)
4. Donation form works identically on both
5. Donor feed displays identically on both

#### 7.5.2 Messaging E2E

**New file**: `e2e/e2e-17-messaging.spec.ts`

**Scenarios**:
1. Visit campaign → see message wall (may be empty)
2. Sign in → post a message → message appears
3. Post message anonymously → shows "Anonymous"
4. Rate limit: post 5 messages → 6th rejected
5. Message visible on page reload

#### 7.5.3 Admin Simulation E2E

**New file**: `e2e/e2e-18-admin-simulation.spec.ts`

**Scenarios**:
1. Admin navigates to /admin/simulation
2. Toggle simulation on/off
3. Adjust volume slider
4. Pause a specific campaign
5. Convert a campaign from simulated to real
6. View fund pool

---

## 8. Cross-Cutting Concerns

### 8.1 Audit Logging

Every simulation control action must be audit-logged. New event types:

| Event Type | Trigger | Details |
|-----------|---------|---------|
| `simulation.settings_changed` | Admin updates simulation settings | Old values, new values, admin user |
| `simulation.campaign_paused` | Admin pauses a simulated campaign | Campaign ID, admin user |
| `simulation.campaign_resumed` | Admin resumes a simulated campaign | Campaign ID, admin user |
| `simulation.campaign_converted` | Admin converts simulated → real | Campaign ID, beneficiary info, admin user |
| `fund_pool.donation_received` | Real donation to simulated campaign | Amount, campaign, donor email |
| `fund_pool.allocated` | Admin allocates pooled funds | Allocation IDs, target campaign |
| `fund_pool.disbursed` | Admin marks funds as disbursed | Allocation IDs, amounts |
| `message.flagged` | Admin flags a message | Message ID, campaign ID |
| `message.hidden` | Admin hides a message | Message ID, campaign ID |
| `message.unhidden` | Admin unhides a message | Message ID, campaign ID |

### 8.2 Terms of Service Language

The ToS must include language that covers fund pooling without revealing simulation:

> "Donations support verified campaigns and beneficiaries through LastDonor.org. In some cases, donated funds may be allocated to campaigns with the greatest need or to verified beneficiaries identified by our editorial team. All donations are tax-deductible contributions to LastDonor.org, a 501(c)(3) organization."

This language covers the scenario where a real user donates to a simulated campaign and funds are pooled/redistributed — without revealing the simulation mechanism.

### 8.3 Stripe Metadata Security

The `fundPool` metadata on Stripe PaymentIntents is only visible in the Stripe dashboard (admin access) and in webhook event payloads (server-side only). It is never returned to the client in the `create-intent` response.

**Verify**: Stripe's `client_secret` only allows confirming the payment — it does not give access to PaymentIntent metadata from the client side. This is a Stripe platform guarantee.

### 8.4 ISR/Cache Invalidation

Campaign pages use ISR (Incremental Static Regeneration). When simulation settings change or a campaign is converted, the affected pages must be revalidated:

```typescript
import { revalidatePath } from 'next/cache';

revalidatePath('/campaigns/' + slug);
revalidatePath('/campaigns');
revalidatePath('/');
```

### 8.5 Error Handling

All new API routes must follow the existing error response pattern:
```typescript
{ ok: false, error: 'Human-readable error message' }
```

With appropriate HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 429 (rate limit), 500 (server error).

### 8.6 Performance Considerations

- **`simulation_flag` index**: Ensures the simulation engine's filtered query remains O(log n)
- **`campaign_messages` indexes**: campaignId, userId, createdAt, flagged — cover all query patterns
- **`fund_pool_allocations` indexes**: status, sourceCampaignId, targetCampaignId
- **Settings caching**: `getSetting()` hits DB on each call. For cron jobs that call it multiple times, read all settings once at the start.

---

## 9. Dependency Graph

```
Milestone 7: Foundation
  ├── 7.1 DB Migration (independent — must be FIRST)
  ├── 7.2 Query Sanitization ← depends on 7.1 (needs new columns to exist)
  ├── 7.3 Engine Hardening ← depends on 7.1 (needs simulation_flag column)
  ├── 7.4 Seed Data Sanitization ← depends on 7.1 (backfill migration)
  └── 7.5 Pipeline Update ← depends on 7.1 (needs simulation_flag column)
      (7.2–7.5 can be parallelized after 7.1)

Milestone 8: Donation Routing ← depends on M7.1, M7.2
  ├── 8.1 Donation Router ← depends on M7.1
  ├── 8.2 Webhook Handler ← depends on 8.1
  ├── 8.3 Fund Pool Admin API ← depends on 8.2
  └── 8.4 Reconciliation Update ← depends on 8.2

Milestone 9: Messaging System ← depends on M7.1 (needs campaign_messages table)
  ├── 9.1 Message API Routes (independent after M7.1)
  ├── 9.2 Webhook Integration ← depends on 9.1
  ├── 9.3 Seed Engine Integration ← depends on 9.1
  ├── 9.4 Frontend Components ← depends on 9.1
  └── 9.5 Admin Moderation ← depends on 9.1
      (M9 can be developed in parallel with M8)

Milestone 10: Admin Controls ← depends on M7.3 (needs settings infrastructure)
  ├── 10.1 Settings API (independent after M7.3)
  ├── 10.2 Campaign Management API ← depends on 10.1
  ├── 10.3 Analytics API (independent after M7.1)
  ├── 10.4 Admin UI Pages ← depends on 10.1, 10.2, 10.3
  └── 10.5 Phase-Out Automation ← depends on 10.1
      (M10 can be developed in parallel with M8 and M9 after M7)

Milestone 11: Adversarial Testing ← depends on M7, M8, M9, M10 (all must be complete)
  ├── 11.1 API Response Audit
  ├── 11.2 Statistical Donation Analysis
  ├── 11.3 Cross-Campaign Indistinguishability
  ├── 11.4 Frontend Audit
  └── 11.5 E2E Indistinguishability
      (All 11.x can be parallalized)
```

### Critical Path

```
M7.1 → M7.2 → M8.1 → M8.2 → M8.3 → M11.1
          ↘ M7.3 → M10.1 → M10.4 → M11.4
M7.1 ──→ M9.1 → M9.4 → M11.5
```

### Parallel Execution Opportunities

After M7.1 is complete:
- M7.2, M7.3, M7.4, M7.5, M9.1 can all start simultaneously
- M8 and M10 can proceed in parallel once their M7 dependencies are met
- M9 is fully independent of M8 and M10

---

## 10. File Manifest

### New Files (~37 total)

| # | File | Milestone | Type |
|---|------|-----------|------|
| 1 | `src/db/migrations/0014_dual_campaign_system.sql` | 7.1 | Migration |
| 2 | `src/db/public-select.ts` | 7.2 | Security |
| 3 | `src/types/public.ts` | 7.2 | Types |
| 4 | `src/lib/seed/phase-out.ts` | 10.5 | Logic |
| 5 | `src/app/api/v1/campaigns/[slug]/messages/route.ts` | 9.1 | API |
| 6 | `src/app/api/v1/admin/campaigns/[campaignId]/messages/[messageId]/moderate/route.ts` | 9.5 | API |
| 7 | `src/app/api/v1/admin/simulation/settings/route.ts` | 10.1 | API |
| 8 | `src/app/api/v1/admin/simulation/campaigns/route.ts` | 10.2 | API |
| 9 | `src/app/api/v1/admin/simulation/campaigns/[id]/pause/route.ts` | 10.2 | API |
| 10 | `src/app/api/v1/admin/simulation/campaigns/[id]/resume/route.ts` | 10.2 | API |
| 11 | `src/app/api/v1/admin/simulation/campaigns/[id]/convert/route.ts` | 10.2 | API |
| 12 | `src/app/api/v1/admin/simulation/analytics/route.ts` | 10.3 | API |
| 13 | `src/app/api/v1/admin/fund-pool/route.ts` | 8.3 | API |
| 14 | `src/app/api/v1/admin/fund-pool/allocate/route.ts` | 8.3 | API |
| 15 | `src/app/api/v1/admin/fund-pool/disburse/route.ts` | 8.3 | API |
| 16 | `src/app/api/v1/admin/fund-pool/export/route.ts` | 8.3 | API |
| 17 | `src/app/admin/simulation/page.tsx` | 10.4 | UI |
| 18 | `src/app/admin/simulation/fund-pool/page.tsx` | 10.4 | UI |
| 19 | `src/app/admin/simulation/analytics/page.tsx` | 10.4 | UI |
| 20 | `src/components/campaign/MessageWall.tsx` | 9.4 | UI |
| 21 | `src/components/campaign/MessageForm.tsx` | 9.4 | UI |
| 22 | `src/components/campaign/MessageWall.test.tsx` | 9.4 | Test |
| 23 | `src/components/campaign/MessageForm.test.tsx` | 9.4 | Test |
| 24 | `test/security/query-sanitization.test.ts` | 7.2 | Test |
| 25 | `test/security/api-response-audit.test.ts` | 11.1 | Test |
| 26 | `test/security/donation-patterns.test.ts` | 11.2 | Test |
| 27 | `test/security/indistinguishability.test.ts` | 11.3 | Test |
| 28 | `test/security/frontend-audit.test.ts` | 11.4 | Test |
| 29 | `e2e/e2e-16-dual-campaign.spec.ts` | 11.5 | E2E |
| 30 | `e2e/e2e-17-messaging.spec.ts` | 9.4 | E2E |
| 31 | `e2e/e2e-18-admin-simulation.spec.ts` | 10.4 | E2E |

### Modified Files (~22 total)

| # | File | Milestone | Change Summary |
|---|------|-----------|---------------|
| 1 | `src/db/schema.ts` | 7.1 | Add `simulationFlag`, `simulationConfig` to campaigns; add `campaignMessages`, `fundPoolAllocations` tables; update notification enum |
| 2 | `src/types/index.ts` | 7.1 | Export `SimulationConfig` type |
| 3 | `src/lib/settings.ts` | 7.3 | Add 9 simulation settings to `SettingsMap` + `SETTINGS_CONFIG` |
| 4 | `src/lib/seed/simulation-engine.ts` | 7.3, 7.4, 9.3 | Filter by `simulation_flag`; volume multiplier; per-campaign pause; realistic IDs/emails; message wall insertion |
| 5 | `src/app/api/v1/cron/simulate-donations/route.ts` | 7.3 | Replace `SEED_MODE_ENABLED` with `getSetting('simulation.enabled')`; add phase-out volume check |
| 6 | `src/app/api/v1/cron/update-phases/route.ts` | 7.3 | Skip real campaigns (`simulation_flag=false`) |
| 7 | `src/app/campaigns/[slug]/page.tsx` | 7.2, 9.4 | Use `publicCampaignSelect`; add MessageWall/MessageForm |
| 8 | `src/app/api/v1/campaigns/[slug]/route.ts` | 7.2 | Use `publicCampaignSelect` instead of bare `select()` |
| 9 | `src/app/api/v1/campaigns/route.ts` | 7.2 | Import and use `publicCampaignCardSelect` (verify) |
| 10 | `src/app/api/v1/donations/create-intent/route.ts` | 8.1 | Add `simulationFlag` to internal query; add `fundPool` metadata |
| 11 | `src/app/api/v1/donations/webhook/route.ts` | 8.2, 9.2 | Fund pool allocation; campaign_messages insertion |
| 12 | `src/lib/news/news-pipeline.ts` | 7.5 | Set `simulationFlag=true`; max concurrent check; settings checks |
| 13 | `src/app/api/v1/cron/reconcile/route.ts` | 8.4 | Fund pool reconciliation; admin alert |
| 14 | `src/components/admin/AdminSidebar.tsx` | 10.4 | Add Simulation section (admin role only) |
| 15 | `src/app/admin/page.tsx` | 10.4 | Add simulation summary card to dashboard |
| 16 | `src/app/page.tsx` | 7.2 | Verify/update homepage campaign queries use safe selects |
| 17 | `src/lib/seed/simulation-engine.test.ts` | 7.3 | Update tests for new filter/volume/pause behavior |
| 18 | `src/lib/validators/index.ts` | 9.1 | Add `messageSchema` |

---

## Appendix A: Checklist — Complete Per-Milestone

### Milestone 7: Foundation

- [ ] **7.1.1** Add `simulation_flag BOOLEAN NOT NULL DEFAULT FALSE` to `campaigns`
- [ ] **7.1.2** Add `simulation_config JSONB DEFAULT NULL` to `campaigns`
- [ ] **7.1.3** Backfill: `UPDATE campaigns SET simulation_flag = TRUE WHERE source = 'automated'`
- [ ] **7.1.4** Create `fund_pool_allocations` table with 3 indexes
- [ ] **7.1.5** Create `campaign_messages` table with 4 indexes
- [ ] **7.1.6** Add notification types `new_message`, `message_flagged`
- [ ] **7.1.7** Seed 9 simulation settings into `site_settings`
- [ ] **7.1.8** Add Drizzle schema definitions for all new tables/columns
- [ ] **7.1.9** Add `SimulationConfig` type to `src/types/index.ts`
- [ ] **7.1.10** Run migration and verify all changes
- [ ] **7.2.1** Create `src/db/public-select.ts` with all 4 select objects
- [ ] **7.2.2** Create `src/types/public.ts` with all 4 public types
- [ ] **7.2.3** Fix `GET /api/v1/campaigns/[slug]` — replace bare `select()` with `publicCampaignSelect`
- [ ] **7.2.4** Fix `getCampaign()` in `campaigns/[slug]/page.tsx` — use `publicCampaignSelect`
- [ ] **7.2.5** Verify campaign list API uses `publicCampaignCardSelect`
- [ ] **7.2.6** Verify `getRelatedCampaigns()` uses `publicCampaignCardSelect`
- [ ] **7.2.7** Audit homepage, search, sitemap, OG routes for bare selects
- [ ] **7.2.8** Create `test/security/query-sanitization.test.ts`
- [ ] **7.3.1** Replace `SEED_MODE_ENABLED` with `getSetting('simulation.enabled')`
- [ ] **7.3.2** Add 9 simulation settings to `SettingsMap` interface
- [ ] **7.3.3** Filter `runSimulation()` to only `simulation_flag=true` campaigns
- [ ] **7.3.4** Add `volumeMultiplier` parameter to `shouldDonateThisCycle()`
- [ ] **7.3.5** Read `simulation.volume` and pass to engine
- [ ] **7.3.6** Read `simulation.categories` and filter campaigns
- [ ] **7.3.7** Add per-campaign pause check via `simulationConfig.paused`
- [ ] **7.3.8** Modify `update-phases` cron to skip `simulation_flag=false` campaigns
- [ ] **7.3.9** Update simulation engine tests
- [ ] **7.4.1** Create `generateRealisticPaymentId()` function
- [ ] **7.4.2** Create `generateRealisticEmail()` function
- [ ] **7.4.3** Replace all `seed_${uuid}` with `generateRealisticPaymentId()`
- [ ] **7.4.4** Replace all `@lastdonor.internal` emails with `generateRealisticEmail()`
- [ ] **7.4.5** Backfill existing seed Stripe IDs to `pi_*` format
- [ ] **7.4.6** Backfill existing seed emails to realistic format
- [ ] **7.4.7** Update tests for new ID/email format assertions
- [ ] **7.4.8** Verify reconciliation cron still works (queries by `source`, not ID prefix)
- [ ] **7.5.1** Set `simulationFlag: true` in pipeline campaign insertion
- [ ] **7.5.2** Set `simulationConfig` default in pipeline campaign insertion
- [ ] **7.5.3** Add max concurrent check before campaign creation
- [ ] **7.5.4** Add `simulation.enabled` check before campaign creation
- [ ] **7.5.5** Add category filtering before campaign creation
- [ ] **7.5.6** Update pipeline tests

### Milestone 8: Donation Routing & Fund Pool

- [ ] **8.1.1** Modify `create-intent` campaign lookup to include `simulationFlag`
- [ ] **8.1.2** Add `fundPool` metadata to Stripe PaymentIntent
- [ ] **8.1.3** Verify response shape is identical for both campaign types
- [ ] **8.1.4** Write integration test for response identity
- [ ] **8.2.1** Modify `handlePaymentSuccess()` to check `fundPool` metadata
- [ ] **8.2.2** Insert `fund_pool_allocations` record for pool donations
- [ ] **8.2.3** Add audit log for fund pool donations
- [ ] **8.2.4** Insert `campaign_messages` record for messages on donation
- [ ] **8.2.5** Write integration test for webhook fund pool handling
- [ ] **8.3.1** Create `GET /api/v1/admin/fund-pool` — list allocations
- [ ] **8.3.2** Create `POST /api/v1/admin/fund-pool/allocate` — allocate to campaign
- [ ] **8.3.3** Create `POST /api/v1/admin/fund-pool/disburse` — mark disbursed
- [ ] **8.3.4** Create `GET /api/v1/admin/fund-pool/export` — CSV export
- [ ] **8.3.5** Write integration tests for fund pool endpoints
- [ ] **8.4.1** Add fund pool health check to reconciliation cron
- [ ] **8.4.2** Generate admin notification if pending pool > $1000
- [ ] **8.4.3** Implement auto-allocate logic (optional, when setting enabled)

### Milestone 9: Messaging System

- [ ] **9.1.1** Create `GET /api/v1/campaigns/[slug]/messages` — paginated messages
- [ ] **9.1.2** Create `POST /api/v1/campaigns/[slug]/messages` — post message
- [ ] **9.1.3** Create `messageSchema` validator
- [ ] **9.1.4** Implement rate limiting (5/day/user/campaign)
- [ ] **9.1.5** Write integration tests for both endpoints
- [ ] **9.2.1** Modify webhook `handlePaymentSuccess()` to insert campaign_messages
- [ ] **9.2.2** Write integration test for donation-message dual insertion
- [ ] **9.3.1** Modify simulation engine to insert campaign_messages for seed donations
- [ ] **9.3.2** Handle cohort donation messages
- [ ] **9.3.3** Use jittered timestamp for consistency
- [ ] **9.3.4** Write unit test for seed message insertion
- [ ] **9.4.1** Create `MessageWall` component
- [ ] **9.4.2** Create `MessageForm` component
- [ ] **9.4.3** Integrate into campaign detail page
- [ ] **9.4.4** Create `getMessages()` SSR data fetcher
- [ ] **9.4.5** Write component tests
- [ ] **9.5.1** Create moderation API endpoint
- [ ] **9.5.2** Add message moderation to admin campaign detail
- [ ] **9.5.3** Create notification for hidden messages
- [ ] **9.5.4** Write integration tests for moderation

### Milestone 10: Admin Simulation Controls

- [ ] **10.1.1** Create `GET /api/v1/admin/simulation/settings`
- [ ] **10.1.2** Create `PUT /api/v1/admin/simulation/settings` with validation
- [ ] **10.1.3** Add audit logging for settings changes
- [ ] **10.1.4** Write integration tests
- [ ] **10.2.1** Create `GET /api/v1/admin/simulation/campaigns` with stats
- [ ] **10.2.2** Create pause endpoint
- [ ] **10.2.3** Create resume endpoint
- [ ] **10.2.4** Create convert endpoint (simulated → real)
- [ ] **10.2.5** Write integration tests for all management endpoints
- [ ] **10.3.1** Create `GET /api/v1/admin/simulation/analytics`
- [ ] **10.3.2** Write integration test
- [ ] **10.4.1** Create simulation control panel page
- [ ] **10.4.2** Create fund pool management page
- [ ] **10.4.3** Create analytics dashboard page
- [ ] **10.4.4** Add Simulation section to AdminSidebar
- [ ] **10.4.5** Add simulation summary to admin dashboard
- [ ] **10.5.1** Implement `calculateAutoVolume()` function
- [ ] **10.5.2** Integrate auto-volume into simulation cron
- [ ] **10.5.3** Integrate auto-volume into news pipeline
- [ ] **10.5.4** Write unit tests for `calculateAutoVolume()`

### Milestone 11: Adversarial Testing & Hardening

- [ ] **11.1.1** Create API response audit test
- [ ] **11.1.2** Scan all public endpoints for forbidden keys
- [ ] **11.1.3** Scan all public endpoints for forbidden values
- [ ] **11.2.1** Create statistical donation analysis test
- [ ] **11.2.2** Timestamp uniformity test (chi-squared)
- [ ] **11.2.3** Stripe ID format validation
- [ ] **11.2.4** Email domain diversity check
- [ ] **11.3.1** Create cross-campaign indistinguishability test
- [ ] **11.3.2** Verify identical response shapes for both campaign types
- [ ] **11.4.1** Create frontend code audit test
- [ ] **11.4.2** Scan src/app and src/components for forbidden imports
- [ ] **11.5.1** Create E2E dual campaign test
- [ ] **11.5.2** Create E2E messaging test
- [ ] **11.5.3** Create E2E admin simulation test

---

## Appendix B: Risk Mitigation Actions Per Milestone

| Risk | Mitigation | Implemented In |
|------|-----------|---------------|
| R1: API leaks simulation data | `publicCampaignSelect` + response audit test | M7.2 + M11.1 |
| R2: Fund misallocation | `fund_pool_allocations` table + admin dashboard | M8.2 + M8.3 |
| R3: Donor name patterns | 5000 donor pool (existing); no change needed | Pre-existing |
| R4: Timestamp clustering | Jittered timestamps (existing); no change needed | Pre-existing |
| R5: Insider leak | Audit logging on all simulation actions | M7.3 + M10.1 |
| R6: Statistical analysis | Trajectory profiles + psychological pricing (existing) | Pre-existing |
| R7: React DevTools inspection | `publicCampaignSelect` strips fields before SSR | M7.2 |
| R8: Stripe ID prefix | `generateRealisticPaymentId()` | M7.4 |
| R9: Email domain | `generateRealisticEmail()` | M7.4 |
| R10: Fund pool growth | Admin notifications + auto-allocate option | M8.4 |
| R11: Legal challenge | ToS language + fund pool audit trail | Cross-cutting |
| R12: Unreachable subject | Pool redistribution as default | M8.2 |
| R13: Message spam | Rate limiting (5/day) + moderation tools | M9.1 + M9.5 |
| R14: Settings misconfigured | Validation on settings endpoints + audit log | M10.1 |

---

## Appendix C: Settings Reference

| Key | Type | Default | Range | Purpose |
|-----|------|---------|-------|---------|
| `simulation.enabled` | boolean | `true` | — | Global on/off toggle |
| `simulation.volume` | number | `1.0` | 0.0–1.0 | Donation frequency multiplier |
| `simulation.categories` | string[] | all 8 core categories | valid categories | Eligible categories for simulation |
| `simulation.max_concurrent` | number | `20` | > 0 | Max active simulated campaigns |
| `simulation.phase_out.enabled` | boolean | `false` | — | Auto-reduce based on real campaign count |
| `simulation.phase_out.threshold_low` | number | `10` | > 0 | Real campaigns → 70% volume |
| `simulation.phase_out.threshold_mid` | number | `25` | > threshold_low | Real campaigns → 30% volume |
| `simulation.phase_out.threshold_high` | number | `50` | > threshold_mid | Real campaigns → stop new simulations |
| `simulation.fund_pool.auto_allocate` | boolean | `false` | — | Auto-distribute pooled funds |

---

*End of Document*