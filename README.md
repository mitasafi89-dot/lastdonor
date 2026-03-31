# LastDonor

A crowdfunding platform for charitable campaigns built with Next.js 15, Stripe, and PostgreSQL.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth v5 (credentials + Google OAuth)
- **Payments**: Stripe (Checkout, Connect, Webhooks)
- **Storage**: Supabase (file/image uploads)
- **Email**: Resend (transactional + newsletter)
- **Styling**: Tailwind CSS 4, Radix UI, shadcn/ui
- **Error Tracking**: Sentry
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Deployment**: Vercel

## Prerequisites

- **Node.js** >= 18
- **npm** (or pnpm)
- **PostgreSQL** database (local, Supabase, or Neon)
- **Stripe CLI** (for webhook testing in dev)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd lastdonor
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values. See `.env.example` for descriptions of each variable.

**Minimum required for local dev:**

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) (test mode) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same Stripe Dashboard page |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen` output (see below) |
| `SUPABASE_URL` | [Supabase project settings](https://supabase.com/dashboard) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings > API |
| `RESEND_API_KEY` | [Resend Dashboard](https://resend.com) |
| `CRON_SECRET` | Any random string |
| `SETTINGS_ENCRYPTION_KEY` | Run `openssl rand -hex 32` |

### 3. Set up the database

```bash
# Generate migration files from schema
npm run db:generate

# Apply migrations
npm run db:migrate

# (Optional) Open Drizzle Studio to browse data
npm run db:studio
```

### 4. Start the dev server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

### 5. Stripe webhooks (local dev)

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/v1/donations/webhook
```

Copy the webhook signing secret (`whsec_...`) into your `.env.local` as `STRIPE_WEBHOOK_SECRET`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test:unit` | Run unit tests (Vitest) |
| `npm run test:unit:watch` | Unit tests in watch mode |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:ui` | E2E tests with Playwright UI |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run stripe:listen` | Forward Stripe webhooks to local |

## Project Structure

```
src/
  app/            # Next.js App Router pages & API routes
  components/     # React components
  db/             # Drizzle schema, migrations, queries
  lib/            # Shared utilities (auth, stripe, email, AI, etc.)
docs/             # Product & technical documentation
e2e/              # Playwright E2E tests
test/             # Unit & integration tests
scripts/          # Utility scripts (blog pipeline, diagnostics)
public/           # Static assets (fonts, images)
```

## Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires DATABASE_URL)
npm run test:integration

# E2E tests (requires running dev server)
npm run dev &
npm run test:e2e
```
