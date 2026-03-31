-- Migration 0022: Stripe Connect Express payout system
-- Adds creator payout infrastructure: Connect account tracking on users,
-- withdrawn amount tracking on campaigns, transfer tracking on withdrawals.

-- Stripe Connect account status enum
CREATE TYPE stripe_connect_status AS ENUM (
  'not_started',
  'onboarding_started',
  'pending_verification',
  'verified',
  'restricted',
  'rejected'
);

-- Users: Stripe Connect account columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_connect_status stripe_connect_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_currency TEXT;

-- Campaigns: track actually-withdrawn amount (distinct from admin-approved totalReleasedAmount)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS total_withdrawn_amount INTEGER NOT NULL DEFAULT 0;

-- Campaign withdrawals: Stripe transfer tracking
ALTER TABLE campaign_withdrawals
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Extend withdrawal_status enum with processing and failed states
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'approved';
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'failed' AFTER 'rejected';

-- Index for efficient Connect account lookups by Stripe account ID (webhook handler)
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account ON users (stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;
