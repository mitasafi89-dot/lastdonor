-- Migration 0021: Add hold/pause and flag-for-audit capabilities to fund_releases
-- Required for admin verification & fund release dashboard rewrite

-- Add 'paused' to the fund_release_status enum
ALTER TYPE fund_release_status ADD VALUE IF NOT EXISTS 'paused' AFTER 'approved';

-- Add hold/pause columns
ALTER TABLE fund_releases
  ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Add flag-for-audit columns
ALTER TABLE fund_releases
  ADD COLUMN IF NOT EXISTS flagged_for_audit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- Index for flagged releases (admin dashboard filter)
CREATE INDEX IF NOT EXISTS idx_fund_releases_flagged ON fund_releases (flagged_for_audit) WHERE flagged_for_audit = true;
