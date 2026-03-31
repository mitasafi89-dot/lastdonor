-- Migration 0016: Add fund_usage_plan to campaigns
-- Stores how fundraised money will be spent — required for user-created campaigns,
-- null for editorial campaigns where it's embedded in story HTML.

ALTER TABLE campaigns ADD COLUMN fund_usage_plan TEXT;
