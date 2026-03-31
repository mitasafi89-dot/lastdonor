# LastDonor.org — Technical Architecture

**Version**: 0.1 (Pre-Development)
**Date**: March 19, 2026
**Status**: Draft

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router) | SSR/SSG for SEO, React ecosystem, API routes for backend logic, ISR for campaign pages |
| **Language** | TypeScript | Type safety, fewer runtime bugs, better DX |
| **Styling** | Tailwind CSS 4 | Rapid UI development, design system consistency, dark mode support built-in |
| **UI Components** | shadcn/ui (Radix primitives) | Accessible, customizable components we own. Includes React Hook Form + Zod for forms/validation |
| **Icons** | Heroicons | Clean, SVG-based icon set by Tailwind Labs. Tree-shakeable. |
| **Animation** | Tailwind animate-* + Framer Motion | Tailwind for simple hover/fade. Framer Motion for progress bars, number counters, page transitions only |
| **Toasts** | Sonner | Lightweight toast notifications (~3KB). Integrated with shadcn/ui |
| **Database** | PostgreSQL via Supabase | Relational data (users, campaigns, donations), row-level security, real-time subscriptions for donor feeds |
| **ORM** | Drizzle ORM | Type-safe queries, lightweight, PostgreSQL-native |
| **Auth** | NextAuth.js (Auth.js v5) | Email/password + OAuth (Google), session management, role-based access |
| **Payments** | Stripe | PCI compliance handled by Stripe, recurring donations, webhooks for real-time updates |
| **CMS (Blog)** | MDX files or Sanity (evaluate) | MDX for MVP simplicity; Sanity if non-technical editors need to publish |
| **File Storage** | Supabase Storage or Cloudflare R2 | Campaign images, user uploads |
| **Email** | Resend | Transactional emails (receipts, updates), newsletter integration |
| **Image Generation** | Kling AI | Abstract illustrations, textures, decorative elements for categories without federal photo sources. Never for people/faces. |
| **Analytics** | Plausible | Privacy-first, no cookies, GDPR/CCPA compliant — trust signal for donors |
| **Hosting** | Vercel | Optimized for Next.js, global CDN, automatic HTTPS, preview deployments |
| **DNS/Domain** | Cloudflare | DDoS protection, fast DNS, page rules |
| **Error Tracking** | Sentry | Catch frontend/backend errors before users report them |
| **CI/CD** | GitHub Actions + Vercel auto-deploy | Automated testing, linting, deployment on merge to main |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                           │
│                   (DNS, DDoS, CDN edge)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                        VERCEL                               │
│              (Next.js App — SSR/SSG/ISR)                     │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  Public Pages │ │  API Routes  │ │  Admin Dashboard     │ │
│  │  (SSG/ISR)   │ │  (/api/*)    │ │  (SSR, auth-gated)   │ │
│  │              │ │              │ │                      │ │
│  │ - Homepage   │ │ - Donations  │ │ - Campaign CRUD      │ │
│  │ - Campaigns  │ │ - Campaigns  │ │ - Story editor       │ │
│  │ - Blog       │ │ - Users      │ │ - Donor mgmt         │ │
│  │ - About      │ │ - Webhooks   │ │ - Analytics          │ │
│  │ - Donate     │ │ - Newsletter │ │ - News feed monitor  │ │
│  └──────────────┘ └──────┬───────┘ └──────────────────────┘ │
└──────────────────────────┼──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
│   SUPABASE     │ │   STRIPE     │ │   RESEND     │
│                │ │              │ │              │
│ - PostgreSQL   │ │ - Payments   │ │ - Receipts   │
│ - Auth         │ │ - Recurring  │ │ - Updates    │
│ - Storage      │ │ - Webhooks   │ │ - Newsletter │
│ - Realtime     │ │              │ │              │
└────────────────┘ └──────────────┘ └──────────────┘
```

---

## 3. Data Model (Core Tables)

### campaigns
```
id              UUID PRIMARY KEY
title           TEXT NOT NULL
slug            TEXT UNIQUE NOT NULL
status          ENUM('draft', 'active', 'last_donor_zone', 'completed', 'archived')
hero_image_url  TEXT NOT NULL
story_html      TEXT NOT NULL
goal_amount     INTEGER NOT NULL (in cents)
raised_amount   INTEGER DEFAULT 0 (in cents)
donor_count     INTEGER DEFAULT 0
category        TEXT NOT NULL CHECK (category IN ('medical', 'disaster', 'military', 'veterans', 'memorial', 'first-responders', 'community', 'essential-needs'))
location        TEXT
subject_name    TEXT NOT NULL
subject_hometown TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
published_at    TIMESTAMPTZ
completed_at    TIMESTAMPTZ
last_donor_id   UUID REFERENCES users(id)
```

### donations
```
id              UUID PRIMARY KEY
campaign_id     UUID REFERENCES campaigns(id) NOT NULL
user_id         UUID REFERENCES users(id) (nullable — guest donations)
stripe_payment_id TEXT NOT NULL
amount          INTEGER NOT NULL (in cents)
donor_name      TEXT NOT NULL
donor_email     TEXT NOT NULL
donor_location  TEXT
message         TEXT
is_anonymous    BOOLEAN DEFAULT FALSE
is_recurring    BOOLEAN DEFAULT FALSE
phase_at_time   ENUM('first_believer', 'push', 'closing_in', 'last_donor')
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### users
```
id              UUID PRIMARY KEY
email           TEXT UNIQUE NOT NULL
name            TEXT
location        TEXT
avatar_url      TEXT
role            ENUM('donor', 'editor', 'admin') DEFAULT 'donor'
total_donated   INTEGER DEFAULT 0 (in cents)
campaigns_supported INTEGER DEFAULT 0
last_donor_count INTEGER DEFAULT 0
badges          JSONB DEFAULT '[]'
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### campaign_updates
```
id              UUID PRIMARY KEY
campaign_id     UUID REFERENCES campaigns(id) NOT NULL
title           TEXT NOT NULL
body_html       TEXT NOT NULL
image_url       TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### blog_posts
```
id              UUID PRIMARY KEY
title           TEXT NOT NULL
slug            TEXT UNIQUE NOT NULL
body_html       TEXT NOT NULL
excerpt         TEXT
cover_image_url TEXT
author_name     TEXT NOT NULL
author_bio      TEXT
category        ENUM('campaign_story', 'impact_report', 'news')
published       BOOLEAN DEFAULT FALSE
published_at    TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### newsletter_subscribers
```
id              UUID PRIMARY KEY
email           TEXT UNIQUE NOT NULL
subscribed_at   TIMESTAMPTZ DEFAULT NOW()
unsubscribed_at TIMESTAMPTZ
source          TEXT (e.g., 'homepage', 'campaign_page', 'blog')
```

---

## 4. Key API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/campaigns` | GET | List active campaigns (public) |
| `/api/campaigns/[slug]` | GET | Get single campaign with donor feed (public) |
| `/api/campaigns` | POST | Create campaign (admin auth) |
| `/api/campaigns/[id]` | PUT | Update campaign (admin auth) |
| `/api/donations/create-intent` | POST | Create Stripe payment intent |
| `/api/donations/webhook` | POST | Stripe webhook — confirm payment, update campaign |
| `/api/newsletter/subscribe` | POST | Add email to newsletter |
| `/api/blog` | GET | List published posts (public) |
| `/api/admin/stats` | GET | Dashboard analytics (admin auth) |
| `/api/news/feed` | GET | Aggregated RSS feed from military news sources (admin) |

---

## 5. Stripe Integration Flow

```
Donor clicks "Donate $50"
        │
        ▼
Frontend calls /api/donations/create-intent
        │
        ▼
Server creates Stripe PaymentIntent ($50, campaign metadata)
        │
        ▼
Returns client_secret to frontend
        │
        ▼
Stripe.js collects card → confirms payment
        │
        ▼
Stripe fires webhook → /api/donations/webhook
        │
        ▼
Server verifies webhook signature
        │
        ▼
Server:
  1. Creates donation record in DB
  2. Updates campaign raised_amount + donor_count
  3. Checks if goal is met → update status to 'completed', set last_donor_id
  4. Sends receipt email via Resend
  5. If goal met → sends "Last Donor" celebration email
  6. Triggers ISR revalidation of campaign page
```

---

## 6. Performance Targets

| Metric | Target | How |
|--------|--------|-----|
| First Contentful Paint | < 1.2s | SSG homepage, optimized images, Vercel CDN |
| Largest Contentful Paint | < 2.0s | Hero image preload, WebP format, responsive sizes |
| Time to Interactive | < 2.5s | Code splitting, lazy load below-fold, minimal JS |
| Core Web Vitals (CLS) | < 0.1 | Fixed image dimensions, font-display: swap |
| Lighthouse Score | 90+ | All of the above + accessibility |
| API Response Time | < 200ms | Supabase connection pooling, indexed queries |

---

## 7. Security

| Concern | Solution |
|---------|----------|
| Payment data | Never touches our server — Stripe.js handles all card data |
| SQL injection | Drizzle ORM parameterized queries — no raw SQL |
| XSS | React auto-escapes, CSP headers, sanitize campaign HTML |
| CSRF | SameSite cookies, Stripe webhook signature verification |
| Auth | Bcrypt password hashing, HttpOnly cookies, short session expiry |
| Rate limiting | Vercel Edge middleware rate limiting on donation + auth endpoints |
| DDoS | Cloudflare in front of Vercel |
| Secrets | Environment variables only — never committed. Vercel encrypted env. |
| Admin access | Role-based access control, admin routes behind auth middleware |
| Data privacy | Plausible (no cookies), minimal PII collection, encrypted at rest (Supabase) |

---

## 8. News Feed Infrastructure (RSS Aggregation)

### Sources
| Source | Feed URL | Check Frequency |
|--------|----------|----------------|
| DVIDS | dvidshub.net/rss/* | Every 6 hours |
| Stars and Stripes | stripes.com/rss | Every 6 hours |
| Military Times | militarytimes.com/rss | Every 6 hours |
| Defense.gov | defense.gov RSS feeds | Every 12 hours |

### Implementation
- Vercel Cron Job (or external: GitHub Actions) fetches RSS feeds on schedule
- Parses entries, stores in `news_items` table with title, link, source, date, summary
- Admin dashboard shows latest items with "Create Campaign From This" button
- No public-facing news page in MVP — news is internal editorial fuel only

---

## 9. Deployment Pipeline

```
Developer pushes to GitHub
        │
        ▼
GitHub Actions:
  1. Lint (ESLint)
  2. Type check (tsc)
  3. Unit tests (Vitest)
  4. Build (next build)
        │
        ▼
If main branch: Vercel auto-deploys to production
If PR branch: Vercel creates preview deployment
        │
        ▼
Post-deploy: Sentry release tracking
```

---

## 10. Environment Variables Required

```
# Database
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Stripe
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=

# Analytics
PLAUSIBLE_DOMAIN=lastdonor.org

# Sentry
SENTRY_DSN=

# News APIs (optional, for enhanced monitoring)
GNEWS_API_KEY=
```
