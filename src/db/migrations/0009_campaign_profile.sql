-- Add campaign_profile JSONB column to campaigns table.
-- Stores the trajectory profile that drives simulation behavior.
ALTER TABLE "campaigns" ADD COLUMN "campaign_profile" jsonb;
