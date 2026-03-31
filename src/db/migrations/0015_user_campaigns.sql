-- Migration 0015: User-Created Campaigns
-- Adds creator ownership, verification status, and withdrawal tracking

-- 1. New enum for verification status
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified');

-- 2. New enum for withdrawal status
CREATE TYPE withdrawal_status AS ENUM ('requested', 'approved', 'completed', 'rejected');

-- 3. Add columns to campaigns table
ALTER TABLE campaigns
  ADD COLUMN creator_id UUID REFERENCES users(id),
  ADD COLUMN beneficiary_relation TEXT,
  ADD COLUMN verification_status verification_status NOT NULL DEFAULT 'unverified';

-- 4. Add campaigns_created counter to users table
ALTER TABLE users
  ADD COLUMN campaigns_created INTEGER NOT NULL DEFAULT 0;

-- 5. Create campaign_withdrawals table
CREATE TABLE campaign_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'requested',
  stripe_connect_account TEXT,
  processed_by UUID REFERENCES users(id),
  notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Add notification types for campaign creators
-- (PostgreSQL enums require ALTER TYPE to add new values)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_donation_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_milestone';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_message_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_processed';

-- 7. Indexes
CREATE INDEX idx_campaigns_creator_id ON campaigns(creator_id);
CREATE INDEX idx_campaign_withdrawals_campaign ON campaign_withdrawals(campaign_id);
CREATE INDEX idx_campaign_withdrawals_status ON campaign_withdrawals(status);
CREATE INDEX idx_campaign_withdrawals_requested_by ON campaign_withdrawals(requested_by);

-- 8. Add unique constraint on stripe_payment_id to prevent duplicate webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_stripe_payment_id_unique ON donations(stripe_payment_id);
