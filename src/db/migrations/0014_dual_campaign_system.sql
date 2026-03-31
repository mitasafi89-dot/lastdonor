-- Migration 0014: Dual Campaign System Foundation
-- Adds simulation_flag + simulation_config to campaigns,
-- creates fund_pool_allocations and campaign_messages tables,
-- extends notification_type enum, and seeds simulation settings.

-- ── 1. Campaigns: simulation columns ────────────────────────────────────────

ALTER TABLE campaigns ADD COLUMN simulation_flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN simulation_config JSONB DEFAULT NULL;

CREATE INDEX idx_campaigns_simulation_flag ON campaigns (simulation_flag);

-- Backfill: existing automated campaigns become simulated
UPDATE campaigns SET simulation_flag = TRUE WHERE source = 'automated';
UPDATE campaigns SET simulation_config = '{"paused": false, "fundAllocation": "pool"}'::jsonb WHERE simulation_flag = TRUE;

-- ── 2. Fund Pool Allocations ────────────────────────────────────────────────

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

-- ── 3. Campaign Messages ────────────────────────────────────────────────────

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

-- ── 4. Notification types ───────────────────────────────────────────────────

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'message_flagged';

-- ── 5. Simulation settings ──────────────────────────────────────────────────

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

-- ── 6. Backfill seed donation stripe IDs and emails ─────────────────────────
-- Replace 'seed_' prefixed stripe IDs with realistic 'pi_' format
UPDATE donations
SET stripe_payment_id = 'pi_' || substring(encode(gen_random_bytes(18), 'hex') from 1 for 24)
WHERE source = 'seed' AND stripe_payment_id LIKE 'seed_%';

-- Replace @lastdonor.internal emails with realistic domains
-- Uses a deterministic rotation through common domains based on row position
UPDATE donations
SET donor_email = (
  LOWER(REGEXP_REPLACE(donor_name, '[^a-zA-Z]', '', 'g')) ||
  (EXTRACT(EPOCH FROM created_at)::int % 999)::text ||
  '@' ||
  (ARRAY['gmail.com','yahoo.com','outlook.com','hotmail.com','aol.com','icloud.com','mail.com','protonmail.com','comcast.net','att.net','msn.com','verizon.net'])[1 + (EXTRACT(EPOCH FROM created_at)::int % 12)]
)
WHERE source = 'seed' AND donor_email LIKE '%@lastdonor.internal';
