-- Migration 0010: Add campaignOrganizer JSONB to campaigns, updateType to campaign_updates
-- Milestone 3: Context-Aware Messages & Organizer Simulation

ALTER TABLE "campaigns" ADD COLUMN "campaign_organizer" jsonb;

ALTER TABLE "campaign_updates" ADD COLUMN "update_type" text;
