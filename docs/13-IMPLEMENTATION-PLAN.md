# 13 — Implementation Plan

> **Document ID**: LD-IMPL-001  
> **Purpose**: Comprehensive, step-by-step development blueprint for LastDonor.org. Every phase, step, substep, file, configuration, and test is documented. This document is the single source of truth for development execution.  
> **Status**: Active  
> **Prerequisite Docs**: 01 through 11 (all read and reconciled)

---

## Contradictions Resolved Before Implementation

The following inconsistencies were found across docs and are resolved here. All implementation follows these resolutions:

| # | Issue | Resolution |
|---|---|---|
| 1 | **Phase boundaries** — Doc 01 says "0-25% First Believers" but doc 08 tests treat 25% as still `first_believers`. Is 25% included in first_believers or the_push? | **25% is the upper bound of `first_believers` (inclusive)**. Thresholds: `0-25` = first_believers, `26-60` = the_push, `61-90` = closing_in, `91-100` = last_donor_zone. Boundary check: `percent <= 25` → first_believers. |
| 2 | **Phase enum values** — Doc 01 uses "First Believers" (plural), doc 03 uses `first_believer` (singular), doc 07 uses `first_believers` (plural) | **Use snake_case plural**: `first_believers`, `the_push`, `closing_in`, `last_donor_zone`. These are the DB enum and API values. |
| 3 | **RSS feed check frequency** — Doc 03 says "every 6 hours", doc 04 says "daily", doc 11 says "every 30 min" for GNews and "every 6 hours" for RSS | **GNews API + NWS**: every 30 minutes (via `/api/v1/cron/ingest-news`). **RSS feeds** (DVIDS, Stripes, Military Times, Defense.gov, ODMP, USFA, Firehouse, FireRescue1, Police1): every 6 hours (via `/api/v1/cron/fetch-news`). |
| 4 | **API route prefix** — Doc 03 uses `/api/campaigns`, doc 07 uses `/api/v1/campaigns`, doc 09 uses both | **All routes use `/api/v1/` prefix** per doc 07 (the API specification doc is authoritative). |
| 5 | **CSP header** — Doc 06 specifies full CSP, `next.config.ts` omits it | **Add CSP header to `next.config.ts`** in Phase 1.1. |
| 6 | **Permissions-Policy** — Doc 06 includes `payment=(self)`, current config omits it | **Add `payment=(self)`** to the Permissions-Policy header. |
| 7 | **Minimum donation (seed vs real)** — Doc 06/07 say $5 minimum. Doc 11 simulation uses $20 minimum | **Platform minimum**: $5 (500 cents) for real donations. **Seed minimum**: $20 (2000 cents) for simulation realism. Both are correct in their respective domains. |
| 8 | **CMS for blog** — Doc 03 says "MDX files or Sanity (evaluate)" | **Use database-driven blog** (`blog_posts` table) for MVP. MDX adds build complexity. Sanity adds a third-party dependency. Blog content enters via the admin CampaignEditor. |
| 9 | **File storage** — Doc 03 says "Supabase Storage or Cloudflare R2 (evaluate)" | **Use Supabase Storage** for MVP. Already integrated. R2 is a Phase 2 migration if storage costs grow. |
| 10 | **`impactTiers` storage** — Not in DB schema but in API spec request/response | **Add `impact_tiers JSONB DEFAULT '[]'` column to `campaigns` table**. Schema: `[{amount: number, label: string}]`. |
| 11 | **`source` column on donations** — Doc 11 adds it but doc 03 schema doesn't have it | **Add `source TEXT DEFAULT 'real' CHECK (source IN ('real', 'seed'))` to `donations` table**. |
| 12 | **`phase_at_time` enum values** — Doc 03 uses `first_believer` (singular) | **Normalize to plurals**: `first_believers`, `the_push`, `closing_in`, `last_donor_zone` — matches doc 07 API spec. |
| 13 | **Photo credit storage** — Mentioned but no DB field | **Add `photo_credit TEXT` column to `campaigns` table**. Format: `"Photo: [name] / DVIDS, [date]"`. |
| 14 | **Campaign auto-archive** — Doc 11 says "after 90 days of completion" but no cron for it | **Add archive logic to the reconciliation cron** (`/api/v1/cron/reconcile`): any campaign with `status = 'completed'` and `completed_at < NOW() - 90 days` → set `status = 'archived'`. |
| 15 | **HSTS max-age** — Doc 06 says `31536000` (1 year), `next.config.ts` says `63072000` (2 years) | **Keep 2 years (63072000)** — more secure, already deployed. |

---

## Phase Overview

| Phase | Name | Scope | Depends On |
|:---:|---|---|---|
| **1** | Foundation & Infrastructure | Project scaffold, DB schema, auth, brand tokens, core utilities | None |
| **2** | Campaign System & Donations | Campaign pages, Stripe integration, donor flow, real-time feed | Phase 1 |
| **3** | Content, User & Admin Systems | Blog, user dashboard, admin panel, newsletter | Phase 2 |
| **4** | Automation Engine | News pipeline, AI prompts, seed simulation, cron jobs, image pipeline | Phase 3 |
| **5** | Testing, Performance & Launch Prep | Full test suite, performance optimization, SEO, CI/CD, security hardening | Phase 4 |

---

## PHASE 1 — Foundation & Infrastructure

### 1.1 — Install Missing Dependencies

**Packages not yet in `package.json` that are required:**

```
npm install @heroicons/react framer-motion sonner react-hook-form @hookform/resolvers @vercel/og recharts isomorphic-dompurify sharp
```

| Package | Purpose | Doc Reference |
|---|---|---|
| `@heroicons/react` | Icon library (NOT Lucide) | Doc 03 UI Components |
| `framer-motion` | Complex animations (progress bars, counters, page transitions) | Doc 03 Animation |
| `sonner` | Toast notifications (~3KB) | Doc 03 Toasts |
| `react-hook-form` | Form state management | Doc 03 UI Components |
| `@hookform/resolvers` | Zod resolver for react-hook-form | Doc 03 UI Components |
| `@vercel/og` | Dynamic OG image generation | Doc 07 OG API |
| `recharts` | Charts for admin dashboard only | Doc 03 UI Components |
| `isomorphic-dompurify` | HTML sanitization (campaign stories, blog content) | Doc 06 Input Validation |
| `sharp` | Image processing (strip EXIF, resize) | Doc 06 File Uploads |

**Dev dependencies:**

```
npm install -D @types/dompurify msw
```

| Package | Purpose |
|---|---|
| `@types/dompurify` | TypeScript types for DOMPurify |
| `msw` | API mocking for component tests |

**shadcn/ui initialization:**

```
npx shadcn@latest init
```

Configuration choices:
- Style: Default
- Base color: Slate (will override with brand tokens)
- CSS variables: Yes
- Tailwind CSS: Already configured
- Components path: `src/components/ui`
- Utils path: `src/lib/utils`

Then install required shadcn/ui components:

```
npx shadcn@latest add button input label card dialog dropdown-menu select tabs badge separator avatar sheet textarea toast skeleton table switch radio-group tooltip popover command
```

### 1.2 — Project Directory Structure

Create the following directories. Files listed without content are created in later substeps.

```
src/
  app/
    layout.tsx
    page.tsx
    globals.css
    campaigns/
      page.tsx
      [slug]/
        page.tsx
    blog/
      page.tsx
      [slug]/
        page.tsx
    about/
      page.tsx
    how-it-works/
      page.tsx
    transparency/
      page.tsx
    editorial-standards/
      page.tsx
    last-donor-wall/
      page.tsx
    share-your-story/
      page.tsx
    donate/
      page.tsx
    login/
      page.tsx
    register/
      page.tsx
    dashboard/
      page.tsx
    profile/
      page.tsx
    privacy/
      page.tsx
    terms/
      page.tsx
    admin/
      layout.tsx
      page.tsx
      campaigns/
        new/
          page.tsx
        [id]/
          edit/
            page.tsx
      news-feed/
        page.tsx
      audit-log/
        page.tsx
    api/
      v1/
        campaigns/
          route.ts
          [slug]/
            route.ts
            donors/
              route.ts
          [id]/
            route.ts
        donations/
          create-intent/
            route.ts
          webhook/
            route.ts
        newsletter/
          subscribe/
            route.ts
          unsubscribe/
            route.ts
        blog/
          route.ts
          [slug]/
            route.ts
        stats/
          route.ts
        health/
          route.ts
        og/
          campaign/
            [slug]/
              route.ts
        users/
          me/
            route.ts
        admin/
          dashboard/
            route.ts
          news-feed/
            route.ts
          audit-log/
            route.ts
          seed/
            generate-messages/
              route.ts
            purge/
              route.ts
            stats/
              route.ts
        cron/
          ingest-news/
            route.ts
          simulate-donations/
            route.ts
          update-phases/
            route.ts
          reconcile/
            route.ts
          fetch-news/
            route.ts
          send-newsletter/
            route.ts
          publish-campaigns/
            route.ts
    sitemap.ts
    robots.ts
    not-found.tsx
  db/
    schema.ts
    index.ts
    migrations/
  lib/
    ai/
      openrouter.ts
      prompts/
        classify-news.ts
        extract-entities.ts
        generate-campaign.ts
        generate-messages.ts
        generate-update.ts
        generate-impact.ts
        generate-newsletter.ts
    seed/
      amount-generator.ts
      name-generator.ts
      message-generator.ts
      simulation-engine.ts
    news/
      gnews-client.ts
      rss-parser.ts
      fema-client.ts
      weather-alerts.ts
      news-pipeline.ts
    stripe.ts
    resend.ts
    auth.ts
    utils/
      currency.ts
      slug.ts
      sanitize.ts
      phase.ts
      dates.ts
      cn.ts
    validators/
      donation.ts
      campaign.ts
      user.ts
      newsletter.ts
  components/
    ui/                      (shadcn/ui managed)
    layout/
      Navbar.tsx
      Footer.tsx
      SkipToContent.tsx
      Breadcrumbs.tsx
    campaign/
      CampaignCard.tsx
      ProgressBar.tsx
      PhaseBadge.tsx
      DonorFeed.tsx
      DonationForm.tsx
      ImpactTiers.tsx
      CampaignUpdates.tsx
      ShareButtons.tsx
      StickyMobileDonateBar.tsx
    homepage/
      HeroSection.tsx
      TrustBar.tsx
      ImpactCounter.tsx
      WhereYourMoneyGoes.tsx
      CategoryShowcase.tsx
    blog/
      BlogCard.tsx
      ArticleRenderer.tsx
      AuthorBio.tsx
    user/
      DonorProfile.tsx
      BadgeDisplay.tsx
    admin/
      CampaignEditor.tsx
      AdminDashboard.tsx
      NewsFeedMonitor.tsx
      AuditLogViewer.tsx
    DarkModeToggle.tsx
    NewsletterSignup.tsx
  middleware.ts
  types/
    index.ts
    campaign.ts
    donation.ts
    user.ts
    api.ts
e2e/
  campaigns.spec.ts
  donations.spec.ts
  admin.spec.ts
  auth.spec.ts
  newsletter.spec.ts
  mobile.spec.ts
  a11y.spec.ts
test/
  fixtures/
    campaigns.ts
    donations.ts
    users.ts
  factories/
    campaign.ts
    donation.ts
    user.ts
  setup.ts
.github/
  workflows/
    ci.yml
public/
  fonts/
    (self-hosted WOFF2 files — added in 1.4)
```

### 1.3 — Tailwind CSS 4 Brand Configuration

**File: `src/app/globals.css`**

Tailwind CSS 4 uses CSS-first configuration. Define brand tokens as CSS custom properties and Tailwind theme extensions.

```css
@import "tailwindcss";

@theme {
  /* Brand Colors — Light Mode */
  --color-brand-teal: #0F766E;
  --color-brand-amber: #D97706;
  --color-brand-red: #8B2332;
  --color-brand-green: #2D6A4F;
  --color-brand-white: #F8F6F2;
  --color-brand-black: #1A1A1A;
  --color-brand-gray: #6B7280;
  --color-brand-border: #E5E7EB;

  /* Brand Colors — Dark Mode */
  --color-dark-bg: #0F1A19;
  --color-dark-surface: #1A2E2B;
  --color-dark-text: #F1F5F9;
  --color-dark-text-secondary: #94A3B8;
  --color-dark-teal: #14B8A6;
  --color-dark-border: #2D4A47;

  /* Font Families */
  --font-display: 'DM Serif Display', serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;
}

/* Dark Mode */
[data-theme="dark"] {
  --color-brand-teal: #14B8A6;
  --color-brand-white: #0F1A19;
  --color-brand-black: #F1F5F9;
  --color-brand-gray: #94A3B8;
  --color-brand-border: #2D4A47;
}

/* Focus indicator (Warm Amber) */
*:focus-visible {
  outline: 3px solid #D97706;
  outline-offset: 2px;
}

[data-theme="dark"] *:focus-visible {
  outline-color: #FBBF24;
}
```

### 1.4 — Font Loading (Self-Hosted)

**Font files to download and place in `public/fonts/`:**

| File | Source | Size |
|---|---|---|
| `dm-serif-display-latin-400.woff2` | Google Fonts (subset Latin) | ~20KB |
| `dm-sans-latin-400.woff2` | Google Fonts (subset Latin) | ~10KB |
| `dm-sans-latin-500.woff2` | Google Fonts (subset Latin) | ~10KB |
| `dm-sans-latin-600.woff2` | Google Fonts (subset Latin) | ~8KB |
| `dm-mono-latin-400.woff2` | Google Fonts (subset Latin) | ~15KB |

**Alternative approach (recommended)**: Use `next/font/google` which automatically self-hosts, subsets, and preloads.

**File: `src/app/layout.tsx`** — Font configuration:

```typescript
import { DM_Serif_Display, DM_Sans, DM_Mono } from 'next/font/google';

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
```

Apply font CSS variables to `<html>` via `className={`${dmSerifDisplay.variable} ${dmSans.variable} ${dmMono.variable}`}`.

### 1.5 — Database Schema (Drizzle ORM)

**File: `src/db/schema.ts`**

All tables with exact column definitions, types, constraints, defaults, and relationships.

#### Enums

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'active', 'last_donor_zone', 'completed', 'archived'
]);

export const campaignCategoryEnum = pgEnum('campaign_category', [
  'medical', 'disaster', 'military', 'veterans',
  'memorial', 'first-responders', 'community', 'essential-needs'
]);

export const donationPhaseEnum = pgEnum('donation_phase', [
  'first_believers', 'the_push', 'closing_in', 'last_donor_zone'
]);

export const donationSourceEnum = pgEnum('donation_source', ['real', 'seed']);

export const userRoleEnum = pgEnum('user_role', ['donor', 'editor', 'admin']);

export const blogCategoryEnum = pgEnum('blog_category', [
  'campaign_story', 'impact_report', 'news'
]);

export const auditSeverityEnum = pgEnum('audit_severity', [
  'info', 'warning', 'error', 'critical'
]);
```

#### Tables

**`campaigns`** — 22 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `title` | `text` | NOT NULL |
| `slug` | `text` | UNIQUE, NOT NULL |
| `status` | `campaign_status` | NOT NULL, DEFAULT `'draft'` |
| `hero_image_url` | `text` | NOT NULL |
| `photo_credit` | `text` | nullable |
| `story_html` | `text` | NOT NULL |
| `goal_amount` | `integer` | NOT NULL (cents) |
| `raised_amount` | `integer` | NOT NULL, DEFAULT `0` (cents) |
| `donor_count` | `integer` | NOT NULL, DEFAULT `0` |
| `category` | `campaign_category` | NOT NULL |
| `location` | `text` | nullable |
| `subject_name` | `text` | NOT NULL |
| `subject_hometown` | `text` | nullable |
| `impact_tiers` | `jsonb` | DEFAULT `'[]'` — `[{amount, label}]` |
| `source` | `text` | DEFAULT `'manual'` — `'manual'` or `'automated'` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `published_at` | `timestamptz` | nullable |
| `completed_at` | `timestamptz` | nullable |
| `last_donor_id` | `uuid` | FK → `users.id`, nullable |

**`donations`** — 16 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `campaign_id` | `uuid` | FK → `campaigns.id`, NOT NULL |
| `user_id` | `uuid` | FK → `users.id`, nullable (guest donations) |
| `stripe_payment_id` | `text` | NOT NULL |
| `amount` | `integer` | NOT NULL (cents), CHECK `amount >= 500` |
| `donor_name` | `text` | NOT NULL |
| `donor_email` | `text` | NOT NULL |
| `donor_location` | `text` | nullable |
| `message` | `text` | nullable, max 500 chars |
| `is_anonymous` | `boolean` | NOT NULL, DEFAULT `false` |
| `is_recurring` | `boolean` | NOT NULL, DEFAULT `false` |
| `phase_at_time` | `donation_phase` | NOT NULL |
| `source` | `donation_source` | NOT NULL, DEFAULT `'real'` |
| `refunded` | `boolean` | NOT NULL, DEFAULT `false` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**`users`** — 12 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `email` | `text` | UNIQUE, NOT NULL |
| `email_verified` | `timestamptz` | nullable |
| `password_hash` | `text` | nullable (null for OAuth-only) |
| `name` | `text` | nullable |
| `location` | `text` | nullable |
| `avatar_url` | `text` | nullable |
| `role` | `user_role` | NOT NULL, DEFAULT `'donor'` |
| `total_donated` | `integer` | NOT NULL, DEFAULT `0` (cents) |
| `campaigns_supported` | `integer` | NOT NULL, DEFAULT `0` |
| `last_donor_count` | `integer` | NOT NULL, DEFAULT `0` |
| `badges` | `jsonb` | NOT NULL, DEFAULT `'[]'` — `[{type, campaignSlug, earnedAt}]` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**`campaign_updates`** — 6 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `campaign_id` | `uuid` | FK → `campaigns.id`, NOT NULL |
| `title` | `text` | NOT NULL |
| `body_html` | `text` | NOT NULL |
| `image_url` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**`blog_posts`** — 12 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `title` | `text` | NOT NULL |
| `slug` | `text` | UNIQUE, NOT NULL |
| `body_html` | `text` | NOT NULL |
| `excerpt` | `text` | nullable |
| `cover_image_url` | `text` | nullable |
| `author_name` | `text` | NOT NULL |
| `author_bio` | `text` | nullable |
| `category` | `blog_category` | NOT NULL |
| `published` | `boolean` | NOT NULL, DEFAULT `false` |
| `published_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**`newsletter_subscribers`** — 5 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `email` | `text` | UNIQUE, NOT NULL |
| `subscribed_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `unsubscribed_at` | `timestamptz` | nullable |
| `source` | `text` | nullable — `'homepage'`, `'campaign'`, `'blog'`, `'footer'` |

**`news_items`** — 11 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `title` | `text` | NOT NULL |
| `url` | `text` | UNIQUE, NOT NULL |
| `source` | `text` | NOT NULL — `'gnews'`, `'dvids'`, `'stripes'`, `'military_times'`, `'defense_gov'`, `'odmp'`, `'usfa'`, `'firehouse'`, `'firerescue1'`, `'police1'`, `'fema'`, `'nws'`, `'inciweb'`, `'reliefweb'` |
| `summary` | `text` | nullable |
| `category` | `campaign_category` | nullable |
| `relevance_score` | `integer` | nullable (0-100) |
| `campaign_created` | `boolean` | NOT NULL, DEFAULT `false` |
| `campaign_id` | `uuid` | FK → `campaigns.id`, nullable |
| `published_at` | `timestamptz` | nullable |
| `fetched_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**`campaign_seed_messages`** — 7 columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `campaign_id` | `uuid` | FK → `campaigns.id`, NOT NULL |
| `message` | `text` | NOT NULL |
| `persona` | `text` | nullable — `'veteran'`, `'spouse'`, `'neighbor'`, etc. |
| `phase` | `donation_phase` | NOT NULL |
| `used` | `boolean` | NOT NULL, DEFAULT `false` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**`audit_logs`** — 10 columns (append-only):

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PRIMARY KEY, `defaultRandom()` |
| `timestamp` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `event_type` | `text` | NOT NULL — e.g. `'campaign.published'`, `'donation.recorded'`, `'user.login'` |
| `actor_id` | `uuid` | nullable (null for system events) |
| `actor_role` | `user_role` | nullable |
| `actor_ip` | `text` | nullable |
| `target_type` | `text` | nullable — `'campaign'`, `'donation'`, `'user'`, `'blog_post'` |
| `target_id` | `uuid` | nullable |
| `details` | `jsonb` | DEFAULT `'{}'` |
| `severity` | `audit_severity` | NOT NULL, DEFAULT `'info'` |

**NextAuth.js required tables** (via `@auth/drizzle-adapter`):

The Drizzle adapter for NextAuth v5 requires `accounts`, `sessions`, and `verification_tokens` tables. These are created using the adapter's schema helper:

```typescript
import { pgTable, text, timestamp, primaryKey, integer } from 'drizzle-orm/pg-core';

// accounts — OAuth provider links
// sessions — active sessions  
// verification_tokens — email verification + password reset
```

Follow the `@auth/drizzle-adapter` documentation for exact column definitions. The adapter auto-manages these tables.

#### Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_category ON campaigns(category);
CREATE INDEX idx_campaigns_status_category ON campaigns(status, category);
CREATE INDEX idx_campaigns_slug ON campaigns(slug);
CREATE INDEX idx_campaigns_published_at ON campaigns(published_at DESC);

CREATE INDEX idx_donations_campaign_id ON donations(campaign_id);
CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX idx_donations_stripe_payment_id ON donations(stripe_payment_id);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON blog_posts(published, published_at DESC);

CREATE INDEX idx_news_items_url ON news_items(url);
CREATE INDEX idx_news_items_fetched_at ON news_items(fetched_at DESC);
CREATE INDEX idx_news_items_campaign_created ON news_items(campaign_created);

CREATE INDEX idx_seed_messages_campaign_used ON campaign_seed_messages(campaign_id, used);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
```

#### Row Level Security (RLS) Policies

Configure in Supabase Dashboard or via SQL migration:

```sql
-- Public: read active campaigns and published blog posts
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_public_read ON campaigns FOR SELECT
  USING (status IN ('active', 'last_donor_zone', 'completed'));

-- Authenticated: read own donations and profile
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY donations_own_read ON donations FOR SELECT
  USING (user_id = auth.uid());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_own_read ON users FOR SELECT
  USING (id = auth.uid());
CREATE POLICY users_own_update ON users FOR UPDATE
  USING (id = auth.uid());

-- Editor: write campaigns
CREATE POLICY campaigns_editor_write ON campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('editor', 'admin')));

-- Admin: full access
CREATE POLICY admin_full ON campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Service role bypasses all RLS (for API routes using SUPABASE_SERVICE_ROLE_KEY)
```

**Note**: Because API routes use Drizzle ORM with the `DATABASE_URL` connection (not Supabase client), RLS is bypassed in API routes. Authorization is enforced in middleware/route handlers. RLS is a defense-in-depth layer for any direct Supabase client access (e.g., Realtime subscriptions on the frontend).

### 1.6 — Database Connection & Client

**File: `src/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

`prepare: false` is required for Supabase connection pooling (PgBouncer in transaction mode).

### 1.7 — Run Initial Migration

```bash
npm run db:generate
npm run db:migrate
```

Verify all 10 tables created in Supabase Dashboard: `campaigns`, `donations`, `users`, `campaign_updates`, `blog_posts`, `newsletter_subscribers`, `news_items`, `campaign_seed_messages`, `audit_logs`, plus NextAuth tables (`accounts`, `sessions`, `verification_tokens`).

### 1.8 — Authentication (NextAuth v5)

**File: `src/lib/auth.ts`**

Configure NextAuth with:

1. **Drizzle Adapter** — Connects to Supabase PostgreSQL
2. **Credentials Provider** — Email + password with bcrypt (cost factor 12)
3. **Google Provider** — OAuth via `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
4. **Session Strategy** — `"jwt"` (stateless JWT in HTTP-only cookie)
5. **Callbacks**:
   - `jwt`: Add `role` to JWT token from database
   - `session`: Expose `role` and `id` in session object
6. **Pages**:
   - `signIn: '/login'`
   - `newUser: '/register'`

**Password requirements** (enforced in registration API):
- Minimum 10 characters
- At least 1 uppercase, 1 lowercase, 1 digit
- Check against HaveIBeenPwned API (k-anonymity model: hash password, send first 5 chars of SHA-1 prefix, check if suffix appears in response)
- Hash with bcrypt cost factor 12

**Session configuration by role**:

| Role | `maxAge` |
|---|---|
| `donor` | 7 days (604800 seconds) |
| `editor` | 24 hours (86400 seconds) |
| `admin` | 8 hours (28800 seconds) |

**Account lockout**: Track failed login attempts. After 5 failures for the same email within 15 minutes → lock account for 15 minutes. Send lockout notification email via Resend.

**File: `src/middleware.ts`**

NextAuth middleware for route protection:

```typescript
export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/api/v1/users/:path*',
    '/api/v1/admin/:path*',
  ],
};
```

**Role enforcement helper** (used in every protected API route):

```typescript
// src/lib/auth.ts (exported)
export async function requireRole(allowedRoles: UserRole[]) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!allowedRoles.includes(session.user.role)) throw new ForbiddenError();
  return session;
}
```

### 1.9 — Core Utility Functions

**File: `src/lib/utils/currency.ts`**

```typescript
export function centsToDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
```

**File: `src/lib/utils/slug.ts`**

```typescript
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}
```

Alphanumeric + hyphens only, 3-100 characters.

**File: `src/lib/utils/sanitize.ts`**

```typescript
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'h2', 'h3', 'strong', 'em', 'a', 'img', 'blockquote', 'ul', 'ol', 'li'];
const ALLOWED_ATTRS = { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'] };

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [...ALLOWED_ATTRS.a, ...ALLOWED_ATTRS.img],
  });
}
```

**File: `src/lib/utils/phase.ts`**

```typescript
import type { DonationPhase } from '@/types';

export function getCampaignPhase(raisedAmount: number, goalAmount: number): DonationPhase {
  const percent = Math.floor((raisedAmount / goalAmount) * 100);
  if (percent <= 25) return 'first_believers';
  if (percent <= 60) return 'the_push';
  if (percent <= 90) return 'closing_in';
  return 'last_donor_zone';
}

export function getPhaseLabel(phase: DonationPhase): string {
  const labels: Record<DonationPhase, string> = {
    first_believers: 'First Believers',
    the_push: 'The Push',
    closing_in: 'Closing In',
    last_donor_zone: 'Last Donor Zone',
  };
  return labels[phase];
}
```

**File: `src/lib/utils/dates.ts`**

```typescript
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}
```

**File: `src/lib/utils/cn.ts`** (shadcn/ui convention)

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 1.10 — Zod Validation Schemas

**File: `src/lib/validators/donation.ts`**

```typescript
import { z } from 'zod';

export const createIntentSchema = z.object({
  campaignId: z.string().uuid(),
  amount: z.number().int().min(500, 'Minimum donation is $5.00').max(10_000_000, 'Maximum donation is $100,000'),
  donorName: z.string().min(1).max(100),
  donorEmail: z.string().email(),
  donorLocation: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
});
```

**File: `src/lib/validators/campaign.ts`**

```typescript
import { z } from 'zod';

const CATEGORIES = [
  'medical', 'disaster', 'military', 'veterans',
  'memorial', 'first-responders', 'community', 'essential-needs',
] as const;

export const createCampaignSchema = z.object({
  title: z.string().min(5).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(100),
  category: z.enum(CATEGORIES),
  heroImageUrl: z.string().url(),
  photoCredit: z.string().max(200).optional(),
  subjectName: z.string().min(1).max(200),
  subjectHometown: z.string().max(200).optional(),
  storyHtml: z.string().min(50),
  goalAmount: z.number().int().min(100_000).max(10_000_000), // $1,000 - $100,000
  impactTiers: z.array(z.object({
    amount: z.number().int().min(500),
    label: z.string().min(3).max(200),
  })).max(10).default([]),
  status: z.enum(['draft', 'active']).default('draft'),
});

export const updateCampaignSchema = createCampaignSchema.partial();
```

**File: `src/lib/validators/user.ts`**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
  name: z.string().min(1).max(100),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
});
```

**File: `src/lib/validators/newsletter.ts`**

```typescript
import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.enum(['homepage', 'campaign', 'blog', 'footer']).optional(),
});
```

### 1.11 — TypeScript Type Definitions

**File: `src/types/index.ts`**

Export core types inferred from the Drizzle schema:

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { campaigns, donations, users, blogPosts, newsletterSubscribers, newsItems, campaignUpdates, campaignSeedMessages, auditLogs } from '@/db/schema';

export type Campaign = InferSelectModel<typeof campaigns>;
export type NewCampaign = InferInsertModel<typeof campaigns>;
export type Donation = InferSelectModel<typeof donations>;
export type User = InferSelectModel<typeof users>;
export type BlogPost = InferSelectModel<typeof blogPosts>;
export type NewsletterSubscriber = InferSelectModel<typeof newsletterSubscribers>;
export type NewsItem = InferSelectModel<typeof newsItems>;
export type CampaignUpdate = InferSelectModel<typeof campaignUpdates>;
export type CampaignSeedMessage = InferSelectModel<typeof campaignSeedMessages>;
export type AuditLog = InferSelectModel<typeof auditLogs>;

export type CampaignStatus = 'draft' | 'active' | 'last_donor_zone' | 'completed' | 'archived';
export type CampaignCategory = 'medical' | 'disaster' | 'military' | 'veterans' | 'memorial' | 'first-responders' | 'community' | 'essential-needs';
export type DonationPhase = 'first_believers' | 'the_push' | 'closing_in' | 'last_donor_zone';
export type UserRole = 'donor' | 'editor' | 'admin';
```

**File: `src/types/api.ts`**

```typescript
export interface ApiResponse<T = unknown> {
  ok: true;
  data: T;
  meta?: {
    cursor?: string;
    hasMore?: boolean;
  };
}

export interface ApiError {
  ok: false;
  error: {
    code: 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
    message: string;
    field?: string;
    requestId: string;
  };
}
```

### 1.12 — Stripe Client Configuration

**File: `src/lib/stripe.ts`**

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia', // pin to version
  typescript: true,
});
```

Only imported in server-side code (API routes). Never imported in client components.

### 1.13 — Resend Email Client

**File: `src/lib/resend.ts`**

```typescript
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);
```

### 1.14 — OpenRouter AI Client

**File: `src/lib/ai/openrouter.ts`**

```typescript
import OpenAI from 'openai';

export const ai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://lastdonor.org',
    'X-Title': 'LastDonor.org',
  },
});

export const PRIMARY_MODEL = 'openai/gpt-4o-mini';
export const FALLBACK_MODEL = 'anthropic/claude-3.5-haiku';
```

### 1.15 — Security Headers Update

**Update `next.config.ts`** to add CSP header and `payment=(self)` to Permissions-Policy:

Add this header to the existing headers array:

```typescript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' js.stripe.com plausible.io",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: *.supabase.co dvidshub.net",
    "connect-src 'self' api.stripe.com *.supabase.co",
    "frame-src js.stripe.com",
    "font-src 'self'",
  ].join('; '),
},
```

Update Permissions-Policy to include `payment=(self)`:

```typescript
{
  key: 'Permissions-Policy',
  value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
},
```

### 1.16 — Root Layout

**File: `src/app/layout.tsx`**

Core responsibilities:
- Apply font CSS variables (DM Serif Display, DM Sans, DM Mono)
- Set root metadata (title template, description, OpenGraph defaults, Twitter card)
- Include `<SkipToContent>` link
- Include `<Navbar>` and `<Footer>`
- Dark mode initialization script (read `localStorage`, apply `data-theme` attribute synchronously to prevent flash)
- Plausible analytics `<script defer data-domain="lastdonor.org" src="https://plausible.io/js/script.js" />`

Metadata configuration:

```typescript
export const metadata: Metadata = {
  title: {
    template: '%s | LastDonor.org',
    default: 'LastDonor.org — Donate to Real People in Need | 100% Transparent Charity',
  },
  description: 'Verified fundraising campaigns for military families, veterans, first responders, disaster victims, and people in crisis. 100% transparent. You're the reason it's done.',
  metadataBase: new URL('https://lastdonor.org'),
  openGraph: {
    siteName: 'LastDonor.org',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### 1.17 — Layout Components

**`src/components/layout/SkipToContent.tsx`**

Renders `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>`.

**`src/components/layout/Navbar.tsx`**

- Logo (SVG or text "LastDonor" with styled period)
- Navigation items: Campaigns, About, Blog, Transparency
- Dark mode toggle
- Login/Register buttons (or user menu if authenticated)
- Mobile: hamburger menu → Sheet (shadcn/ui) slide-out
- Responsive: collapses at `md:` breakpoint

**`src/components/layout/Footer.tsx`**

- Link groups: About, How It Works, Transparency, Editorial Standards, Privacy, Terms
- Social media links (placeholders until accounts created)
- Newsletter signup (reuse `<NewsletterSignup>`)
- Physical address line (CAN-SPAM requirement)
- 501(c)(3) badge/notice
- Copyright

**`src/components/layout/Breadcrumbs.tsx`**

- Auto-generates from URL path
- Used on campaign pages and blog posts
- JSON-LD `BreadcrumbList` structured data

### 1.18 — Dark Mode Toggle

**File: `src/components/DarkModeToggle.tsx`**

- Reads initial theme from `localStorage.getItem('theme')` or `prefers-color-scheme`
- Applies `data-theme="dark"` to `<html>` element
- Stores preference in `localStorage`
- Icon toggles between Sun (Heroicons) and Moon (Heroicons)
- Accessible: `aria-label="Toggle dark mode"`

---

## PHASE 2 — Campaign System & Donations

### 2.1 — Campaign Listing Page

**File: `src/app/campaigns/page.tsx`**

- **Data**: Fetch active + LDZ campaigns from DB via server component
- **Filters**: Category tabs (all 8 categories + "All") — URL param `?category=military`
- **Sort**: Dropdown — newest, most_funded, least_funded, closing_soon
- **Pagination**: Cursor-based, "Load More" button
- **Layout**: Responsive grid — 3 columns desktop, 2 tablet, 1 mobile
- **SEO**: `<title>Active Campaigns | LastDonor.org</title>`, description, canonical
- **Components used**: `<CampaignCard>`, filter tabs (shadcn Tabs), sort Select

### 2.2 — CampaignCard Component

**File: `src/components/campaign/CampaignCard.tsx`**

- Hero image (16:9 aspect ratio, Next.js `<Image>` with `sizes`, WebP, lazy loading)
- Title (heading level)
- Subject name + hometown
- Category badge (colored by category)
- `<ProgressBar>` component
- Percentage funded (e.g., "73% funded")
- Donate button (Link to campaign page)
- Location text
- `<PhaseBadge>` component

### 2.3 — ProgressBar Component

**File: `src/components/campaign/ProgressBar.tsx`**

- Animated width via Framer Motion (`animate={{ width: `${percent}%` }}`)
- Color changes by phase:
  - `first_believers`: `bg-brand-teal`
  - `the_push`: `bg-brand-teal`
  - `closing_in`: `bg-brand-amber`
  - `last_donor_zone`: `bg-brand-red` (pulsing animation)
- ARIA: `role="progressbar"`, `aria-valuenow={raised}`, `aria-valuemin={0}`, `aria-valuemax={goal}`, `aria-label="Campaign progress: {percent}% funded"`

### 2.4 — PhaseBadge Component

**File: `src/components/campaign/PhaseBadge.tsx`**

- Displays phase label: "First Believers" / "The Push" / "Closing In" / "Last Donor Zone"
- Color matches phase
- `aria-label` with full description: "Campaign phase: First Believers — 0 to 25% funded"

### 2.5 — Individual Campaign Page

**File: `src/app/campaigns/[slug]/page.tsx`**

- **Data**: Fetch campaign by slug with recent donors (last 10), updates, impact tiers
- **Rendering**: Server component for initial data, client components for interactive elements
- **Layout**:
  1. Hero image (full-width, `priority` loading for LCP)
  2. Photo credit line (if present)
  3. Breadcrumbs (Home > Campaigns > {title})
  4. Title (h1, DM Serif Display)
  5. Subject name, location, category badge
  6. `<ProgressBar>` + funding stats (raised / goal, donor count, phase badge)
  7. `<DonationForm>` (right sidebar on desktop, sticky mobile bar on mobile)
  8. `<ImpactTiers>`
  9. Story content (sanitized HTML via `dangerouslySetInnerHTML` + DOMPurify)
  10. `<CampaignUpdates>` timeline
  11. `<DonorFeed>` (real-time)
  12. `<ShareButtons>`
  13. "Report Inaccuracy" button
  14. Related campaigns (same category, up to 3)

- **SEO**: Dynamic title `Help {Name} — {Situation} | LastDonor.org`, dynamic description, dynamic OG image (`/api/v1/og/campaign/{slug}`), `DonateAction` + `Article` + `BreadcrumbList` JSON-LD

- **ISR**: `revalidate = 60` (revalidated on demand after donations via `revalidatePath`)

### 2.6 — DonationForm Component

**File: `src/components/campaign/DonationForm.tsx`**

- **Form library**: React Hook Form + Zod resolver
- **Fields**:
  1. Preset amounts: $25, $50, $100 as radio group (`role="radiogroup"`, each button `role="radio"`)
  2. Custom amount input (number, min $5, max $100,000)
  3. Donor name (text input)
  4. Donor email (email input)
  5. Donor location (optional text input, city/state)
  6. Message (optional textarea, max 500 chars, character counter)
  7. Anonymous toggle (Switch from shadcn/ui)
  8. Recurring toggle (Switch) — "Make this a monthly donation"
  9. Stripe Elements card input (loaded dynamically when form is in viewport)
  10. Submit button: "Donate {amount}" (Warm Amber background, white text)

- **Stripe flow**:
  1. On submit → call `POST /api/v1/donations/create-intent` with form data
  2. Receive `clientSecret`
  3. Call `stripe.confirmPayment()` with Stripe Elements
  4. On success → redirect to confirmation page or show Sonner toast
  5. On failure → show error via Sonner toast

- **Loading state**: Disable form during API call, show spinner on button
- **Validation**: All client-side validation mirrors server-side Zod schema
- **Accessibility**: All inputs have associated `<label>`, error messages linked via `aria-describedby`
- **Stripe.js loading**: Load `@stripe/stripe-js` only when campaign page renders, using `loadStripe()` with `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`

### 2.7 — Stripe Integration API Routes

**File: `src/app/api/v1/donations/create-intent/route.ts`**

```
POST handler:
1. Parse & validate body with createIntentSchema (Zod)
2. Verify campaign exists & status IN ('active', 'last_donor_zone')
3. Create Stripe PaymentIntent:
   - amount (cents)
   - currency: 'usd'
   - metadata: { campaignId, donorName, donorEmail, donorLocation, message, isAnonymous, isRecurring }
   - idempotency_key (if provided)
4. Return { clientSecret, paymentIntentId, amount, campaignTitle }
5. Rate limit: 10 per minute per IP
```

**File: `src/app/api/v1/donations/webhook/route.ts`**

```
POST handler:
1. Read raw request body (NOT parsed JSON — Stripe needs raw body for signature)
2. Verify Stripe webhook signature using stripe.webhooks.constructEvent()
3. If invalid signature → return 400
4. Check if event.id already processed (idempotency) → skip if duplicate
5. Switch on event.type:

   case 'payment_intent.succeeded':
     a. Extract metadata (campaignId, donor info)
     b. Determine current phase via getCampaignPhase()
     c. INSERT INTO donations (all fields, source='real', phase_at_time=phase)
     d. UPDATE campaigns SET raised_amount = raised_amount + amount,
        donor_count = donor_count + 1, updated_at = NOW()
        WHERE id = campaignId
     e. Refetch campaign to check if goal met:
        - If raised_amount >= goal_amount:
          i. UPDATE campaigns SET status = 'completed',
             completed_at = NOW(), last_donor_id = userId
          ii. Award 'last_donor' badge to user (if registered)
          iii. Send "Last Donor Celebration" email via Resend
        - If raised_amount crosses 90% threshold:
          i. UPDATE campaigns SET status = 'last_donor_zone'
     f. Send tax receipt email via Resend
     g. Update user stats (total_donated, campaigns_supported)
     h. Award phase badge to user (if registered)
     i. Log to audit_logs (event_type='donation.recorded')
     j. Trigger ISR revalidation: revalidatePath('/campaigns/[slug]')
     k. Broadcast donation to Supabase Realtime channel

   case 'payment_intent.payment_failed':
     a. Log failure to audit_logs (severity='warning')
     b. NO donation record created

   case 'charge.refunded':
     a. Find donation by stripe_payment_id
     b. UPDATE donations SET refunded = true
     c. UPDATE campaigns SET raised_amount = raised_amount - amount,
        donor_count = donor_count - 1
     d. Log to audit_logs (event_type='donation.refunded')
     e. Trigger ISR revalidation

   case 'invoice.payment_succeeded':
     a. Process recurring donation (same flow as payment_intent.succeeded)

6. Return 200 OK (always, to prevent Stripe retries)
```

### 2.8 — DonorFeed Component (Real-Time)

**File: `src/components/campaign/DonorFeed.tsx`**

- Client component (`'use client'`)
- Initial data: server-fetched recent 10 donors passed as prop
- Real-time updates: Subscribe to Supabase Realtime channel `donations:campaign_id=eq.{campaignId}`
- On new donation received → prepend to list with Framer Motion `AnimatePresence` slide-in animation
- Display: donor name (or "Anonymous"), location, amount (DM Mono), relative time, message (if present)
- `aria-live="polite"`, `aria-atomic="false"` — screen readers announce new donations
- Anonymous donations: Show "Anonymous" as name, hide location

### 2.9 — ImpactTiers Component

**File: `src/components/campaign/ImpactTiers.tsx`**

- Display impact labels for preset amounts from campaign's `impactTiers` JSONB
- Example: "$25 covers a week of groceries", "$100 pays one month of utilities"
- Clicking an impact tier pre-selects that amount in the DonationForm
- Styled as cards with Warm Amber accent

### 2.10 — CampaignUpdates Component

**File: `src/components/campaign/CampaignUpdates.tsx`**

- Timeline layout (vertical line with dots)
- Each update: title, HTML body (sanitized), optional image, timestamp
- Sorted newest first
- Collapsible if more than 3 updates (show first 3, "Show all" button)

### 2.11 — ShareButtons Component

**File: `src/components/campaign/ShareButtons.tsx`**

- Facebook share (opens `https://www.facebook.com/sharer/sharer.php?u={url}`)
- X/Twitter share (opens `https://twitter.com/intent/tweet?url={url}&text={title}`)
- Copy link (copies URL to clipboard, Sonner toast: "Link copied!")
- Email share (opens `mailto:?subject={title}&body={url}`)
- Accessible: each button has `aria-label`

### 2.12 — StickyMobileDonateBar Component

**File: `src/components/campaign/StickyMobileDonateBar.tsx`**

- Fixed to bottom of viewport on mobile only (`md:hidden`)
- Shows: progress bar mini, "Donate" button (Warm Amber)
- Clicking scrolls to / opens DonationForm
- Z-index above page content

### 2.13 — Campaign API Routes

**File: `src/app/api/v1/campaigns/route.ts`**

```
GET handler (public):
1. Parse query params: status, category, sort, limit (max 50), cursor
2. Build Drizzle query with filters
3. Apply cursor-based pagination (WHERE id < cursor ORDER BY ...)
4. Select public fields only (no internal fields)
5. Return { ok: true, data: campaigns[], meta: { cursor, hasMore } }
6. Rate limit: 100/min/IP

POST handler (editor/admin):
1. requireRole(['editor', 'admin'])
2. Validate body with createCampaignSchema
3. Sanitize storyHtml with DOMPurify
4. INSERT INTO campaigns
5. Log to audit_logs (event_type='campaign.created')
6. Return 201 with campaign object
```

**File: `src/app/api/v1/campaigns/[slug]/route.ts`**

```
GET handler (public):
1. Fetch campaign by slug
2. If not found or status = 'draft' → return 404
3. Include recentDonors (last 10), updates, impactTiers
4. Return full campaign object
```

**File: `src/app/api/v1/campaigns/[id]/route.ts`**

```
PUT handler (editor/admin):
1. requireRole(['editor', 'admin'])
2. Validate body with updateCampaignSchema (partial)
3. Sanitize storyHtml if present
4. UPDATE campaigns WHERE id = params.id
5. Log to audit_logs (event_type='campaign.updated', details={diff})
6. Trigger ISR revalidation
7. Return updated campaign

DELETE handler (admin only):
1. requireRole(['admin'])
2. Verify campaign status is 'draft' or 'completed' (can't delete active)
3. UPDATE campaigns SET status = 'archived' (soft delete)
4. Log to audit_logs (event_type='campaign.deleted')
5. Return 200
```

**File: `src/app/api/v1/campaigns/[slug]/donors/route.ts`**

```
GET handler (public):
1. Parse query: limit (default 20, max 50), cursor
2. Fetch donations for campaign WHERE campaign_id = (SELECT id FROM campaigns WHERE slug = params.slug)
3. Map anonymous donations: name → "Anonymous", location → null
4. Return donor list with pagination
```

### 2.14 — OG Image Generation

**File: `src/app/api/v1/og/campaign/[slug]/route.ts`**

Uses `@vercel/og` (Satori) to generate 1200×630 PNG:

- Campaign hero image (background, cropped)
- Dark gradient overlay (bottom 50%)
- Campaign title (DM Serif Display, white)
- Progress bar (colored by phase)
- "{raised} of {goal} raised" text
- LastDonor.org logo (bottom right)
- "lastdonor.org" watermark

Response: `Content-Type: image/png`, cache: `Cache-Control: public, max-age=86400, s-maxage=86400`.

---

## PHASE 3 — Content, User & Admin Systems

### 3.1 — Homepage

**File: `src/app/page.tsx`**

Server component. Fetches featured campaign (most recently published active), active campaigns (3-5), platform stats, latest blog posts (3).

**Sections in order**:

1. **HeroSection** — Full-width featured campaign photo, headline ("Every Dollar Has a Name Behind It"), tagline, primary CTA "See Current Campaigns", secondary CTA "How It Works"
2. **TrustBar** — "501(c)(3) · 100% transparent · {totalDonors} donors and counting"
3. **CategoryShowcase** — 8 category cards linking to filtered campaign listings
4. **Active Campaigns** — Grid of 3-5 `<CampaignCard>` components, "View All Campaigns" link
5. **ImpactCounter** — Total raised (DM Mono), total donors, campaigns completed, people supported — animated counters (Framer Motion `useSpring`)
6. **WhereYourMoneyGoes** — Visual breakdown (90% to causes, 10% max operations, 0% platform fee)
7. **BlogPreview** — Latest 3 `<BlogCard>` components, "Read More Stories" link
8. **NewsletterSignup** — Email input + "One story a week. See your impact." CTA

**SEO**: Title "LastDonor.org — Donate to Real People in Need | 100% Transparent Charity", JSON-LD `Organization` + `WebSite` + `SearchAction`

### 3.2 — Homepage Components

**`src/components/homepage/HeroSection.tsx`** — Full-width hero with featured campaign image, headline, CTA buttons. Uses Next.js `<Image>` with `priority` for LCP.

**`src/components/homepage/TrustBar.tsx`** — Inline text bar. Stats fetched server-side.

**`src/components/homepage/ImpactCounter.tsx`** — Client component. Animated number counters using Framer Motion `useSpring`. Numbers displayed in DM Mono. `aria-label` with full text for screen readers.

**`src/components/homepage/WhereYourMoneyGoes.tsx`** — Three bars or pie segments. Static data (90/10/0 split). Clean visual, no Recharts (too heavy for public page).

**`src/components/homepage/CategoryShowcase.tsx`** — Grid of 8 cards, each linking to `/campaigns?category={slug}`. Icon per category (Heroicons). Category name, brief description.

### 3.3 — Blog System

**File: `src/app/blog/page.tsx`**

- List published blog posts, paginated (cursor-based)
- Filter by category tabs: All, Campaign Stories, Impact Reports, News
- Display as `<BlogCard>` grid (3-column desktop)
- SEO: Title "Stories & Impact Reports | LastDonor.org"

**File: `src/app/blog/[slug]/page.tsx`**

- Fetch blog post by slug
- Render: cover image, title (h1), author name + bio, published date, category badge
- Body HTML rendered via `<ArticleRenderer>` (sanitized `dangerouslySetInnerHTML`)
- Related posts (same category, up to 3)
- Share buttons
- Breadcrumbs
- SEO: Dynamic title, description from excerpt, OG image from cover image, `Article` + `Author` + `BreadcrumbList` JSON-LD

**`src/components/blog/BlogCard.tsx`** — Cover image (16:9), title, excerpt (2 lines), author name, date, category badge.

**`src/components/blog/ArticleRenderer.tsx`** — Renders sanitized HTML with styled prose classes (Tailwind typography-like styling).

**`src/components/blog/AuthorBio.tsx`** — Author avatar (96×96), name, bio text.

### 3.4 — Blog API Routes

**File: `src/app/api/v1/blog/route.ts`**

```
GET handler (public):
1. Parse query: category, limit (default 10, max 50), cursor
2. Fetch published blog posts with pagination
3. Return blog post summaries (no bodyHtml for list)
```

**File: `src/app/api/v1/blog/[slug]/route.ts`**

```
GET handler (public):
1. Fetch blog post by slug
2. If not found or not published → 404
3. Return full blog post including bodyHtml, authorBio
```

### 3.5 — Static Pages

Each static page is a server component with hardcoded content.

**`src/app/about/page.tsx`** — Mission statement, team, advisory board (placeholder names), JSON-LD `Organization` + `Person`.

**`src/app/how-it-works/page.tsx`** — 3-step explainer: (1) We find stories, (2) You donate, (3) We show you the impact. Visual icons per step.

**`src/app/transparency/page.tsx`** — Dynamic: monthly/annual financial data (fetched from DB or static JSON initially). Pie chart breakdown. Monthly reports. IRS Form 990 link (when available). JSON-LD `Organization`.

**`src/app/editorial-standards/page.tsx`** — How we verify stories, source requirements, corrections policy.

**`src/app/last-donor-wall/page.tsx`** — Query completed campaigns with Last Donor info. Display as list: campaign title, Last Donor name, amount, date. JSON-LD `ItemList`.

**`src/app/share-your-story/page.tsx`** — Form with fields: name, email, story description (textarea), category selector, source links (optional). Submits to an email or internal system (MVP: sends email to admin via Resend).

**`src/app/donate/page.tsx`** — General fund donation form (not tied to a specific campaign). Uses modified `<DonationForm>` without campaign context. Stripe PaymentIntent with metadata `{ type: 'general_fund' }`.

**`src/app/privacy/page.tsx`** — Full privacy policy text. Cookie policy, data handling, CCPA rights, deletion requests.

**`src/app/terms/page.tsx`** — Terms of service. Donation terms, refund policy, minimum age 18, content policies.

**`src/app/not-found.tsx`** — Custom 404 page. Styled with brand colors. "Page not found" message. Search bar or popular campaign links. Link back to homepage.

### 3.6 — User Authentication Pages

**File: `src/app/login/page.tsx`**

- Email + password form (React Hook Form + Zod)
- "Or continue with Google" button (Google OAuth via NextAuth)
- "Forgot password?" link
- "Don't have an account? Register" link
- Error display for invalid credentials, locked account

**File: `src/app/register/page.tsx`**

- Name, email, password fields (React Hook Form + Zod)
- Password strength indicator (checks 10 char, uppercase, lowercase, digit)
- HaveIBeenPwned check on submit (k-anonymity: hash password, send first 5 chars, check response)
- "Or continue with Google" button
- "Already have an account? Login" link
- On success → redirect to dashboard

### 3.7 — User Dashboard

**File: `src/app/dashboard/page.tsx`**

Protected route (donor/editor/admin).

- Donation history: table of all user's donations (campaign name, amount, date, phase badge)
- Total donated (DM Mono, large)
- Campaigns supported count
- Last Donor count (how many campaigns they were the Last Donor for)
- `<BadgeDisplay>` — earned badges with icons
- Recent campaign updates for campaigns they've donated to

### 3.8 — User Profile

**File: `src/app/profile/page.tsx`**

Protected route (donor/editor/admin).

- Profile editor: name, location, avatar URL
- Notification preferences (future: toggles for email types)
- "Delete my account" button (requires confirmation dialog, calls `DELETE /api/v1/users/me`)

### 3.9 — User Profile API

**File: `src/app/api/v1/users/me/route.ts`**

```
GET handler (authenticated):
1. Get session user
2. Fetch user from DB
3. Return user object (exclude password_hash)

PUT handler (authenticated):
1. Validate body with updateProfileSchema
2. UPDATE users WHERE id = session.user.id
3. Return updated user

DELETE handler (authenticated):
1. Require confirmation (body: { confirm: true })
2. Anonymize donations: SET donor_name = 'Deleted User', donor_email = NULL, message = NULL
3. DELETE user record
4. Invalidate session
5. Send confirmation email via Resend
6. Log to audit_logs
```

### 3.10 — Newsletter System

**`src/components/NewsletterSignup.tsx`** — Reusable component used in homepage, footer, campaign pages.
- Email input + submit button
- Source tracking (homepage, campaign, blog, footer prop)
- Sonner toast on success
- Client-side email validation

**File: `src/app/api/v1/newsletter/subscribe/route.ts`**

```
POST handler (public):
1. Validate with subscribeSchema
2. Check if email already subscribed (and not unsubscribed)
3. If duplicate and active → return 200 (no error, idempotent)
4. If duplicate and unsubscribed → re-subscribe (clear unsubscribed_at)
5. INSERT INTO newsletter_subscribers
6. Send welcome email (first of 3-email sequence) via Resend
7. Rate limit: 5/min/IP
```

**File: `src/app/api/v1/newsletter/unsubscribe/route.ts`**

```
POST handler:
1. Verify signed unsubscribe token (contains subscriber ID)
2. If invalid → return 400
3. UPDATE newsletter_subscribers SET unsubscribed_at = NOW()
4. Return 200
```

### 3.11 — Admin Dashboard

**File: `src/app/admin/layout.tsx`**

- Protected layout: `requireRole(['editor', 'admin'])`
- Admin sidebar navigation: Dashboard, Campaigns, New Campaign, News Feed, Audit Log
- Breadcrumbs

**File: `src/app/admin/page.tsx`**

- Dashboard overview (editor/admin):
  - Today's stats: donations count, total amount, new subscribers
  - This month stats: same + campaigns launched/completed
  - Active campaigns list with progress
  - Recent 10 donations
  - Quick links: Create Campaign, View News Feed

- For admin only: Recharts bar chart (daily donations last 30 days), user management link

**`src/components/admin/AdminDashboard.tsx`** — Stats cards (shadcn Card), recent donations table, Recharts chart (admin only, lazy loaded).

### 3.12 — Campaign Editor (Admin)

**File: `src/app/admin/campaigns/new/page.tsx`**

**File: `src/app/admin/campaigns/[id]/edit/page.tsx`**

Both use the same `<CampaignEditor>` component:

**`src/components/admin/CampaignEditor.tsx`**

- Form fields (React Hook Form + Zod):
  1. Title (text input)
  2. Slug (text input, auto-generated from title, editable)
  3. Category (select from 8 categories)
  4. Hero Image URL (text input + image preview + upload button)
  5. Photo Credit (text input)
  6. Subject Name (text input)
  7. Subject Hometown (text input)
  8. Goal Amount (number input, in dollars, converted to cents)
  9. Story HTML (rich text editor — use a simple `<textarea>` with preview toggle for MVP, or integrate a lightweight editor like Tiptap in Phase 2)
  10. Impact Tiers (dynamic form array: add/remove rows of {amount, label})
  11. Status selector (Draft / Active)
  12. Submit button: "Create Campaign" or "Update Campaign"

- On submit (new): `POST /api/v1/campaigns`
- On submit (edit): `PUT /api/v1/campaigns/{id}`
- Preview panel: renders campaign story HTML with sanitization

### 3.13 — News Feed Monitor

**File: `src/app/admin/news-feed/page.tsx`**

**`src/components/admin/NewsFeedMonitor.tsx`**

- List of news items from `news_items` table
- Filterable by source
- Each item shows: title, source, published date, summary, link to original
- Flag indicating if campaign was already created from this item
- "Create Campaign From This" button → pre-fills CampaignEditor with extracted data (if available) or navigates to `/admin/campaigns/new?newsItemId={id}`

### 3.14 — Audit Log Viewer

**File: `src/app/admin/audit-log/page.tsx`**

**`src/components/admin/AuditLogViewer.tsx`**

- Admin only (not editors)
- Table of audit log entries
- Filterable by: event type, actor, date range
- Columns: timestamp, event type, actor (name + role), target, severity, details (expandable JSON)
- Paginated (cursor-based)

### 3.15 — Admin API Routes

**File: `src/app/api/v1/admin/dashboard/route.ts`**

```
GET handler (admin):
1. requireRole(['admin'])
2. Query: today's donations count/sum, this month's count/sum, subscribers, campaigns active/completed
3. Query: recent 10 donations
4. Return dashboard stats object
```

**File: `src/app/api/v1/admin/news-feed/route.ts`**

```
GET handler (editor/admin):
1. requireRole(['editor', 'admin'])
2. Parse query: source filter, limit, since (default 24h)
3. Fetch news items from DB
4. Return news items array
```

**File: `src/app/api/v1/admin/audit-log/route.ts`**

```
GET handler (admin only):
1. requireRole(['admin'])
2. Parse query: eventType, actorId, since (default 7d), until (default now), limit, cursor
3. Fetch audit logs with filters
4. Log this access to audit_logs (meta-logging)
5. Return audit log entries
```

### 3.16 — Platform Stats API

**File: `src/app/api/v1/stats/route.ts`**

```
GET handler (public):
1. Query aggregate stats:
   - totalRaised: SUM(amount) from donations WHERE source='real' AND refunded=false
   - totalDonors: COUNT(DISTINCT donor_email) from donations WHERE source='real'
   - campaignsCompleted: COUNT from campaigns WHERE status IN ('completed', 'archived')
   - campaignsActive: COUNT from campaigns WHERE status IN ('active', 'last_donor_zone')
   - peopleSupported: COUNT(DISTINCT subject_name) from campaigns WHERE status IN ('completed')
2. Cache: Cache-Control: s-maxage=300, stale-while-revalidate=600
3. Return stats object
```

### 3.17 — Health Check API

**File: `src/app/api/v1/health/route.ts`**

```
GET handler (public):
1. Check database connectivity (SELECT 1)
2. Check Stripe reachability (stripe.balance.retrieve() with timeout)
3. Check Resend reachability (if feasible, or skip)
4. Return { status, timestamp, checks, version, commit }
5. Return 200 if all checks pass, 503 if any fail
```

### 3.18 — SEO Files

**File: `src/app/sitemap.ts`**

Auto-generated sitemap with:
- Static pages (about, how-it-works, transparency, etc.)
- All active/completed campaigns (from DB)
- All published blog posts (from DB)
- Completed campaigns: `priority: 0.3`
- Active campaigns: `priority: 0.8`
- Homepage: `priority: 1.0`

**File: `src/app/robots.ts`**

```typescript
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/login', '/register', '/dashboard', '/profile'],
    },
    sitemap: 'https://lastdonor.org/sitemap.xml',
  };
}
```

---

## PHASE 4 — Automation Engine

### 4.1 — AI Prompt Files

Each prompt file exports a function that takes structured input and returns the formatted system/user prompt for the OpenRouter API call.

**File: `src/lib/ai/prompts/classify-news.ts`**

- Input: article title, article body text
- System prompt: "You are a news classifier for a nonprofit fundraising platform..."
- Scoring criteria: identifiable person/family, clear actionable financial need, current (within 30 days), NOT celebrity/politician, NOT military operation without casualty
- Output schema: `{ score: number (0-100), category: CampaignCategory, reason: string }`
- Threshold: score ≥ 70 passes to entity extraction

**File: `src/lib/ai/prompts/extract-entities.ts`**

- Input: classified article text, category
- Output schema: `{ name, age?, event, eventDate, unit?, department?, hometown, family: [{name, relation}], category, suggestedGoal, sourceUrl, sourceName }`

**File: `src/lib/ai/prompts/generate-campaign.ts`**

- Input: entity data object
- Output: 5-section HTML story (The Hook, Meet Them, The Situation, The Gap, The Ask)
- Must cite original source with link
- Plain language, 3rd person, empathetic but not manipulative

**File: `src/lib/ai/prompts/generate-messages.ts`**

- Input: `{ name, age, event, unit, hometown, family, goal, category, phase }`
- Output: JSON array of 50-100 unique messages
- Distribution: 40% name-specific, 20% location-specific, 15% family-specific, 10% event-specific, 15% generic
- Varied tone, length, dialect, quirks (per doc 11 Section 4.4)

**File: `src/lib/ai/prompts/generate-update.ts`**

- Input: campaign data + phase transition info
- Output: 2-3 sentence update celebrating milestone, referencing person by name

**File: `src/lib/ai/prompts/generate-impact.ts`**

- Input: completed campaign data
- Output: 3-paragraph impact report (recap, disbursement estimate, thank you with Last Donor name)

**File: `src/lib/ai/prompts/generate-newsletter.ts`**

- Input: hottest campaign + recent impact data + context piece
- Output: 3-section newsletter (~300 words): featured campaign (50%), impact update (30%), one thing to know (20%)

### 4.2 — News Source Clients

**File: `src/lib/news/gnews-client.ts`**

- GNews API client using `GNEWS_API_KEY`
- 8 keyword sets (one per category, from doc 11 Section 3.2)
- Rotates through keyword sets, respecting API rate limits
- Returns normalized news item objects

**File: `src/lib/news/rss-parser.ts`**

- Generic RSS/Atom feed parser
- Fetches feed URL, parses XML, extracts title/link/description/pubDate
- Used for DVIDS, Stars & Stripes, Military Times, Defense.gov, ODMP, USFA, Firehouse, FireRescue1, Police1

**File: `src/lib/news/fema-client.ts`**

- FEMA Disaster Declarations API client
- Endpoint: `https://www.fema.gov/api/open/v2/DisasterDeclarations`
- Filters: recent declarations (last 30 days), US only
- Returns declaration type, state, counties, date

**File: `src/lib/news/weather-alerts.ts`**

- NWS Alerts API client
- Endpoint: `https://api.weather.gov/alerts/active`
- Filters: severe (tornado, hurricane, flood), significant impact
- Returns alert type, affected areas, severity

**File: `src/lib/news/news-pipeline.ts`**

- Full ingestion orchestrator
- Coordinates: GNews fetch → RSS fetch → classify all → extract entities → deduplicate → generate campaigns → generate messages → publish
- Called by the ingest-news cron route

### 4.3 — Seed Donation Engine

**File: `src/lib/seed/amount-generator.ts`**

- Log-normal distribution: `Math.floor(Math.exp(Math.random() * 2.5 + 3))`
- Clamped to $20-$2000
- Rounded to human amounts: <$100 → nearest $5, $100-$500 → nearest $25, >$500 → nearest $50/$100

**File: `src/lib/seed/name-generator.ts`**

- Static pool of ~500 name + location entries
- Diverse demographics: Anglo, Hispanic, African American, Asian American, military-adjacent, generational
- Location format varies randomly: "Ken from Michigan", "Maria, Houston TX", "DeShawn — Brooklyn"
- 5% chance of "Anonymous"

**File: `src/lib/seed/message-generator.ts`**

- Manages campaign message pool lifecycle
- Calls generate-messages AI prompt when pool needs refill
- Tracks used messages, prevents reuse
- Auto-refills when pool < 20 unused messages

**File: `src/lib/seed/simulation-engine.ts`**

- Full simulation orchestrator
- Per active campaign:
  1. Probability check (based on campaign age, progress, time of day)
  2. Generate 1-3 donations
  3. Insert with source='seed'
  4. Update campaign totals
  5. Broadcast via Supabase Realtime
  6. Check phase transitions
  7. Check completion

### 4.4 — Cron Job Routes

All cron endpoints verify `Authorization: Bearer {CRON_SECRET}`.

**File: `src/app/api/v1/cron/ingest-news/route.ts`**

- Schedule: every 30 minutes (Vercel Cron)
- Calls `newsPipeline.ingest()` — GNews API + RSS feeds
- AI classify → extract → deduplicate → generate → publish
- Logs results to audit_logs

**File: `src/app/api/v1/cron/simulate-donations/route.ts`**

- Schedule: every 15-60 minutes (randomized)
- Guard: `if (process.env.SEED_MODE_ENABLED !== 'true') return`
- Calls `simulationEngine.run()` for each active campaign
- Time-of-day realism applied

**File: `src/app/api/v1/cron/update-phases/route.ts`**

- Schedule: every 5 minutes
- Check all active campaigns for phase transitions
- On phase change: update status, generate campaign update post, adjust simulation frequency

**File: `src/app/api/v1/cron/reconcile/route.ts`**

- Schedule: daily 04:00 UTC
- Compare Stripe totals (real donations only) with DB totals
- Alert if discrepancy > $1
- Auto-archive campaigns completed > 90 days ago

**File: `src/app/api/v1/cron/fetch-news/route.ts`**

- Schedule: every 6 hours
- Fetch all RSS feeds (DVIDS, Stripes, Military Times, Defense.gov, ODMP, USFA, Firehouse, FireRescue1, Police1)
- Parse and store in news_items table
- Deduplicate by URL

**File: `src/app/api/v1/cron/send-newsletter/route.ts`**

- Schedule: every Thursday
- AI selects hottest active campaign + recent impact report
- Generates newsletter content via generate-newsletter prompt
- Sends to all active subscribers via Resend
- Includes unsubscribe link (signed token)

**File: `src/app/api/v1/cron/publish-campaigns/route.ts`**

- Triggered by ingest-news when new campaign is auto-generated
- Sets campaign status to 'active', published_at = NOW()
- Generates OG image
- Triggers ISR revalidation of campaigns list

### 4.5 — Seed Admin API Routes

**File: `src/app/api/v1/admin/seed/generate-messages/route.ts`**

```
POST handler (admin only):
1. requireRole(['admin'])
2. Body: { campaignId, count? (default 100) }
3. Generate messages via AI prompt
4. Insert into campaign_seed_messages
5. Return { generated: count }
```

**File: `src/app/api/v1/admin/seed/purge/route.ts`**

```
POST handler (admin only):
1. requireRole(['admin'])
2. DELETE FROM donations WHERE source = 'seed'
3. DELETE FROM campaign_seed_messages
4. Recalculate all campaign raised_amount and donor_count (from remaining real donations)
5. Log to audit_logs
6. Return { purged: { donations: N, messages: N } }
```

**File: `src/app/api/v1/admin/seed/stats/route.ts`**

```
GET handler (admin only):
1. requireRole(['admin'])
2. Query: COUNT/SUM of seed vs real donations
3. Return { seed: { count, totalAmount }, real: { count, totalAmount } }
```

### 4.6 — Vercel Cron Configuration

**Add to `vercel.json`** (create file):

```json
{
  "crons": [
    { "path": "/api/v1/cron/ingest-news", "schedule": "*/30 * * * *" },
    { "path": "/api/v1/cron/update-phases", "schedule": "*/5 * * * *" },
    { "path": "/api/v1/cron/simulate-donations", "schedule": "*/15 * * * *" },
    { "path": "/api/v1/cron/reconcile", "schedule": "0 4 * * *" },
    { "path": "/api/v1/cron/fetch-news", "schedule": "0 */6 * * *" },
    { "path": "/api/v1/cron/send-newsletter", "schedule": "0 14 * * 4" },
    { "path": "/api/v1/cron/publish-campaigns", "schedule": "*/30 * * * *" }
  ]
}
```

### 4.7 — Image Pipeline

**Weekly cron** (can be added to reconcile route or its own route):

1. Query DVIDS API for photos published in last 14 days (high-res, top-rated)
2. Query FEMA Media Library for recent disaster photos
3. AI score each for emotional impact, brand fit, technical quality
4. Top photo per category → apply brand treatment:
   - Desaturate to 60% (Sharp)
   - Teal wash overlay at 15% opacity
   - Dark gradient overlay (bottom 40%)
5. Process with Sharp: resize, convert to WebP, strip EXIF
6. Upload to Supabase Storage
7. Update site configuration / cache

---

## PHASE 5 — Testing, Performance & Launch Prep

### 5.1 — Test Setup

**File: `vitest.config.ts`** (unit tests):

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

**File: `vitest.config.integration.ts`** (integration tests):

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

**File: `test/setup.ts`** — Import `@testing-library/jest-dom`.

**File: `playwright.config.ts`**:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 5.2 — Unit Tests (Target: 200+, < 15s)

**Business Logic Tests:**

| File | Tests |
|---|---|
| `src/lib/utils/phase.test.ts` | `getCampaignPhase()`: 0% → first_believers, 25% → first_believers, 26% → the_push, 60% → the_push, 61% → closing_in, 90% → closing_in, 91% → last_donor_zone, 100% → last_donor_zone, edge cases (negative, >100%, 0 goal) |
| `src/lib/utils/currency.test.ts` | `centsToDollars()`: 0 → "$0.00", 500 → "$5.00", 1050 → "$10.50", 100000 → "$1,000.00". `dollarsToCents()`: 5 → 500, 10.50 → 1050, 0.01 → 1 |
| `src/lib/utils/slug.test.ts` | Normal title → slug, special characters stripped, multiple spaces → single hyphen, max 100 chars, empty string handling |
| `src/lib/utils/dates.test.ts` | `formatDate()` output format, `formatRelativeTime()`: just now, minutes, hours, days, weeks |
| `src/lib/utils/sanitize.test.ts` | Allowed tags preserved, script tags stripped, event handlers stripped, safe attributes kept, unsafe attributes stripped |
| `src/lib/validators/donation.test.ts` | Valid donation passes, amount < 500 fails, amount > 10M fails, missing email fails, message > 500 chars fails, invalid UUID fails |
| `src/lib/validators/campaign.test.ts` | Valid campaign passes, invalid category fails, slug with spaces fails, missing required fields fail |

**Component Tests (React Testing Library):**

| File | Tests |
|---|---|
| `src/components/campaign/CampaignCard.test.tsx` | Renders title, subject name, progress bar, category badge, donate button. Links to correct campaign slug. |
| `src/components/campaign/ProgressBar.test.tsx` | Width matches percentage. ARIA attributes correct. Color changes by phase. |
| `src/components/campaign/PhaseBadge.test.tsx` | Correct label per phase. Correct aria-label. |
| `src/components/campaign/DonationForm.test.tsx` | Renders all fields. Validates required fields. Shows error messages. Preset amount selection. Custom amount input. Anonymous toggle. |
| `src/components/DarkModeToggle.test.tsx` | Toggles data-theme attribute. Persists to localStorage. Correct icon per state. |
| `src/components/NewsletterSignup.test.tsx` | Email validation. Submit calls API. Success toast shown. |
| `src/components/layout/Footer.test.tsx` | All links present. Physical address present (CAN-SPAM). |

**Seed Engine Tests:**

| File | Tests |
|---|---|
| `src/lib/seed/amount-generator.test.ts` | Generated amounts between $20-$2000. Distribution is skewed low. Rounding rules applied. |
| `src/lib/seed/name-generator.test.ts` | Returns name + location object. Pool size ~500. 5% anonymous rate. |

### 5.3 — Integration Tests (Target: 50+, < 2 min)

| Test Suite | Key Tests |
|---|---|
| **Campaign API** | GET list with filters/sorts/pagination; GET by slug (active, draft → 404, completed); POST create (auth, validation, sanitization); PUT update (partial, auth); DELETE (admin only, draft/completed only) |
| **Donation API** | POST create-intent (valid, campaign not found, campaign not active, amount too low, rate limit); Webhook (valid signature, invalid signature, duplicate event, payment succeeded → donation created + campaign updated + receipt sent, payment failed → no record, refund → decrement) |
| **Newsletter API** | Subscribe (new email, duplicate email → idempotent, re-subscribe after unsubscribe); Unsubscribe (valid token, invalid token) |
| **Blog API** | GET list with category filter/pagination; GET by slug (published, unpublished → 404) |
| **User API** | GET me (authenticated, unauthenticated → 401); PUT me (update name, invalid data); DELETE me (anonymize donations, delete user) |
| **Stats API** | Returns correct aggregates; Excludes seed donations; Excludes refunded donations |
| **Auth** | Register (valid, weak password, breached password, duplicate email); Login (valid, wrong password, locked account); Role enforcement (donor → admin route → 403) |
| **Critical path: Donation completes campaign** | Create donation that meets goal → campaign status=completed, completedAt set, lastDonorId set, badge awarded, email sent, ISR revalidated, audit logged. 10 assertions minimum. |
| **Concurrency: Two final donations** | Two simultaneous donations when campaign is $10 from goal. Both donations for $10. Both recorded. Total correct. Only ONE lastDonorId. Uses `raised_amount = raised_amount + $amount` (atomic). |
| **Financial invariants** | After any donation: `campaign.raisedAmount == SUM(donations.amount) WHERE NOT refunded`. `campaign.donorCount == COUNT(donations) WHERE NOT refunded`. No `donation.amount < 500`. |

### 5.4 — E2E Tests (Playwright, Target: 15, < 5 min)

| ID | Test | Priority |
|---|---|---|
| E2E-01 | Homepage → campaigns → campaign → read story → donate $50 → confirmation toast | P0 |
| E2E-02 | Campaign → guest donate (no login) → receipt email triggered | P0 |
| E2E-03 | LDZ campaign → donate exact remaining → campaign shows completed → Last Donor celebrated | P0 |
| E2E-04 | Register → login → profile → view donation history → see badges | P1 |
| E2E-05 | Homepage → newsletter subscribe → confirmation toast | P1 |
| E2E-06 | Admin login → create campaign → publish → appears on campaigns page | P1 |
| E2E-07 | Admin → post campaign update → appears on campaign page timeline | P1 |
| E2E-08 | Mobile viewport (iPhone 14) → homepage → campaign → sticky donate bar → donate | P0 |
| E2E-09 | Dark mode toggle → verify key pages render correctly | P2 |
| E2E-10 | Blog listing → read post → back → pagination works | P2 |
| E2E-11 | Campaign page → check OG meta tags present in HTML | P2 |
| E2E-12 | Keyboard-only navigation: Tab through entire donation flow, submit with Enter | P1 |
| E2E-13 | Admin → news feed → "Create Campaign From This" → pre-fills editor | P2 |
| E2E-14 | Donor profile → Last Donor Wall → completed campaign with donor info | P2 |
| E2E-15 | Campaign → donate → progress bar updates (poll or Realtime) | P1 |

**Stripe test cards for E2E:**
- `4242424242424242` — success
- `4000000000000002` — declined
- `4000000000009995` — insufficient funds

### 5.5 — CI/CD Pipeline

**File: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
      STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration

  build:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run build

  e2e-tests:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

Stage 1-2 fail → blocks 3+. Stage 3 fail → merge blocker. E2E P0 fail → merge blocker.

### 5.6 — Performance Optimization

**Bundle budgets** (enforced via `@next/bundle-analyzer`):

| Bundle | Max (gzipped) |
|---|---|
| Framework chunk | 45KB |
| Main app chunk | 30KB |
| Campaign page | 35KB |
| Donate flow | 20KB + Stripe.js |
| Blog page | 10KB |
| Admin dashboard | 50KB (lazy loaded) |
| **JS total** | **170KB** |

**Optimization techniques:**
- Stripe.js loaded only on donate pages (dynamic import when form in viewport)
- Sentry lazy-loaded after `onLoad` via dynamic import
- Recharts only in admin dashboard (lazy loaded)
- Framer Motion tree-shaking: import from `framer-motion/m` where possible
- Heroicons: import individual icons (tree-shakeable)
- Font subsetting: Latin only (~40% savings)
- Image optimization: WebP/AVIF via Next.js `<Image>`, `sizes` attribute, blur placeholder
- ISR for campaign pages (revalidate on demand after donations)
- SSG for static pages (about, how-it-works, privacy, terms)
- CSS: Tailwind CSS 4 is already optimized (purges unused styles)

**Core Web Vitals targets:**

| Metric | Target |
|---|---|
| LCP | < 1.5s |
| INP | < 100ms |
| CLS | < 0.05 |
| FCP | < 1.0s |
| TTFB | < 200ms |

### 5.7 — Caching Strategy

| Resource | Cache-Control |
|---|---|
| Static assets (JS/CSS/fonts) | `public, max-age=31536000, immutable` |
| Optimized images | `public, max-age=86400, s-maxage=2592000` |
| SSG HTML | `s-maxage=3600, stale-while-revalidate=86400` |
| SSR HTML | `s-maxage=60, stale-while-revalidate=600` |
| `/api/v1/stats` | `s-maxage=300, stale-while-revalidate=600` |
| Donation API | `no-store` |
| OG images | `public, max-age=86400, s-maxage=86400` |

### 5.8 — Sentry Integration

**Setup:**

```bash
npx @sentry/wizard@latest -i nextjs
```

Configure in `sentry.client.config.ts` and `sentry.server.config.ts`:
- DSN from `SENTRY_DSN` env var
- Release tracking (git commit SHA)
- Source maps uploaded on deploy
- Lazy-loaded on client: load after page interactive
- Tree-shake to ~15KB gzipped
- Environment: `production` / `staging` / `preview`

### 5.9 — Security Hardening Checklist

Before launch, verify every item:

- [ ] CSP header deployed and tested
- [ ] All API routes have auth middleware where required
- [ ] Rate limiting on public endpoints (campaigns, donations, newsletter, auth)
- [ ] Stripe webhook signature verification
- [ ] DOMPurify sanitization on all HTML rendering
- [ ] Input validation (Zod) on every API route
- [ ] File upload validation (type, size, EXIF stripping)
- [ ] `npm audit` shows no HIGH/CRITICAL vulnerabilities
- [ ] No secrets in client-side bundles
- [ ] Error responses don't leak stack traces
- [ ] Admin/editor routes server-side role enforcement
- [ ] bcrypt cost factor 12 for passwords
- [ ] Account lockout after 5 failed attempts
- [ ] HTTP-only, Secure, SameSite cookies
- [ ] CORS properly configured (API routes)
- [ ] Cloudflare WAF rules active
- [ ] HTTPS enforced (HSTS preload)

### 5.10 — Accessibility Audit

Target: WCAG 2.1 AA, Lighthouse Accessibility 95+.

- [ ] All images have alt text
- [ ] All form inputs have labels
- [ ] Color contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text)
- [ ] Keyboard navigation works for entire donation flow
- [ ] Skip-to-content link on every page
- [ ] Focus indicators visible (3px Warm Amber / Yellow Dark)
- [ ] ARIA roles on progress bar, phase badges, donor feed, modals
- [ ] `aria-live` regions for dynamic content (donor feed, toasts)
- [ ] No motion for `prefers-reduced-motion`
- [ ] Dark mode contrast ratios verified
- [ ] Screen reader tested (NVDA or VoiceOver) on key flows

### 5.11 — Pre-Launch Content

- [ ] 3 campaign stories written, reviewed, and ready to publish
- [ ] "About Us" page content (mission, team bios, advisory board)
- [ ] "How It Works" page content (3-step explainer)
- [ ] Transparency page initial data
- [ ] "Editorial Standards" page content
- [ ] "Why We Built LastDonor" launch blog post
- [ ] Privacy policy finalized (with lawyer review)
- [ ] Terms of service finalized (with lawyer review)
- [ ] Newsletter welcome sequence (3 emails — content TBD)

### 5.12 — DNS & Deployment

1. **Cloudflare DNS**: A record `@` → `76.76.21.21` (Vercel), CNAME `www` → `cname.vercel-dns.com`
2. **Vercel**: Connect GitHub repo, set production branch to `main`
3. **Vercel Environment Variables**: Copy all from `.env.local` to Vercel project settings (Production + Preview)
4. **Vercel Domain**: Add `lastdonor.org` and `www.lastdonor.org` (redirect www → root)
5. **Cloudflare Settings**: SSL Full (Strict), HSTS on, Brotli on, WAF managed rules on, Bot Fight Mode on
6. **Resend**: Verify domain `lastdonor.org`, add SPF + DKIM DNS records
7. **Stripe**: Switch from test keys to live keys in production env vars
8. **UptimeRobot**: Configure monitors for homepage, `/api/v1/health`, `/api/v1/campaigns`

---

## Open Items Requiring Decisions

These items are referenced in docs but not yet resolved. Implementation can proceed without them, but they must be addressed before or shortly after launch.

| # | Item | Blocking? | Notes |
|---|---|---|---|
| 1 | **Logo design** | No (use text logo for MVP) | Favicon also needed (16×16, 32×32) |
| 2 | **MFA implementation** | Partial | Required for editor/admin per doc 06. Implement TOTP (authenticator app) — not SMS. Use a library like `otpauth`. Blocking for editor/admin accounts in production. |
| 3 | **50+ local TV RSS feeds** | No | Doc 11 mentions. Start with GNews API coverage. Curate RSS list incrementally. |
| 4 | **Welcome email sequence content** | No | 3 emails needed. Write content before newsletter signup goes live. Timing: Day 0, Day 3, Day 7. |
| 5 | **Share Your Story form fields** | No | Implement as simple form → email to admin. Fields: name, email, story, category, source links. |
| 6 | **General fund /donate flow** | No | Use DonationForm without campaign context. Stripe metadata: `{type: 'general_fund'}`. No campaign association. |
| 7 | **Disbursement tracking** | No (post-launch) | No `disbursements` table yet. Track manually initially. Add table when first campaign completes. |
| 8 | **Badge type enum** | No | Currently `badges JSONB` with `{type, campaignSlug, earnedAt}`. Badge types: `first_believer`, `momentum_builder`, `closer`, `last_donor`. No formal enum table needed — JSONB is sufficient for MVP. |
| 9 | **Kling AI API integration** | No (fallback works) | API endpoint, auth, SDK details not fully specified. Use category fallback (branded gradient + icon) until Kling integration is built. |
| 10 | **Contact form** | No | Doc 06 mentions in attack surface. Add as simple email form if needed. Not in MVP page list. |

---

## Execution Order Summary

```
PHASE 1 — Foundation
  1.1  Install missing packages + shadcn/ui init
  1.2  Create directory structure
  1.3  Tailwind CSS 4 brand configuration (globals.css)
  1.4  Font loading (next/font/google)
  1.5  Database schema (Drizzle ORM — all 10 tables)
  1.6  Database connection client
  1.7  Run initial migration
  1.8  Authentication (NextAuth v5 + middleware)
  1.9  Core utility functions (currency, slug, sanitize, phase, dates, cn)
  1.10 Zod validation schemas
  1.11 TypeScript type definitions
  1.12 Stripe client
  1.13 Resend client
  1.14 OpenRouter AI client
  1.15 Security headers update (CSP, Permissions-Policy)
  1.16 Root layout (fonts, metadata, dark mode script)
  1.17 Layout components (Navbar, Footer, SkipToContent, Breadcrumbs)
  1.18 Dark mode toggle

PHASE 2 — Campaigns & Donations
  2.1  Campaign listing page
  2.2  CampaignCard component
  2.3  ProgressBar component (Framer Motion + ARIA)
  2.4  PhaseBadge component
  2.5  Individual campaign page
  2.6  DonationForm component (React Hook Form + Stripe Elements)
  2.7  Stripe API routes (create-intent + webhook)
  2.8  DonorFeed component (Supabase Realtime)
  2.9  ImpactTiers component
  2.10 CampaignUpdates component
  2.11 ShareButtons component
  2.12 StickyMobileDonateBar component
  2.13 Campaign API routes (CRUD)
  2.14 OG image generation

PHASE 3 — Content, Users & Admin
  3.1  Homepage
  3.2  Homepage components (Hero, TrustBar, ImpactCounter, etc.)
  3.3  Blog system (listing + detail pages)
  3.4  Blog API routes
  3.5  Static pages (about, how-it-works, transparency, etc.)
  3.6  Auth pages (login, register)
  3.7  User dashboard
  3.8  User profile
  3.9  User profile API
  3.10 Newsletter system
  3.11 Admin dashboard
  3.12 Campaign editor (admin)
  3.13 News feed monitor (admin)
  3.14 Audit log viewer (admin)
  3.15 Admin API routes
  3.16 Platform stats API
  3.17 Health check API
  3.18 SEO files (sitemap, robots)

PHASE 4 — Automation
  4.1  AI prompt files (7 prompts)
  4.2  News source clients (GNews, RSS, FEMA, NWS)
  4.3  Seed donation engine (amount, name, message, simulation)
  4.4  Cron job routes (7 endpoints)
  4.5  Seed admin API routes
  4.6  Vercel Cron configuration (vercel.json)
  4.7  Image pipeline

PHASE 5 — Testing & Launch
  5.1  Test setup (Vitest + Playwright config)
  5.2  Unit tests (200+ tests)
  5.3  Integration tests (50+ tests)
  5.4  E2E tests (15 flows)
  5.5  CI/CD pipeline (GitHub Actions)
  5.6  Performance optimization (bundle analysis, lazy loading)
  5.7  Caching strategy
  5.8  Sentry integration
  5.9  Security hardening checklist
  5.10 Accessibility audit
  5.11 Pre-launch content
  5.12 DNS & deployment
```

---

*This document is the authoritative implementation reference. All code must match the specifications herein. If a contradiction is found between this document and other docs, this document takes precedence (as it incorporates all resolutions). When in doubt, refer to the source document cited in each section.*
