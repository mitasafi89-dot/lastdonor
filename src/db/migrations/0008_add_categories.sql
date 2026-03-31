-- Add new campaign category enum values
-- PostgreSQL supports ALTER TYPE ... ADD VALUE for enums

ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'emergency';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'charity';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'education';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'animal';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'environment';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'business';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'competition';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'creative';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'faith';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'family';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'sports';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'travel';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'volunteer';
ALTER TYPE "campaign_category" ADD VALUE IF NOT EXISTS 'wishes';

-- Migrate existing 'disaster' campaigns to 'emergency'
UPDATE "campaigns" SET "category" = 'emergency' WHERE "category" = 'disaster';

-- Migrate existing 'essential-needs' campaigns to 'charity'
UPDATE "campaigns" SET "category" = 'charity' WHERE "category" = 'essential-needs';
