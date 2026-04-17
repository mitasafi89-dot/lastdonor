-- Migration: Remove milestone-based fund release system
-- Replaces the 3-phase milestone system with lump-sum release after verification.
-- Drops campaign_milestones, milestone_evidence, and fund_releases tables.
-- Removes the milestoneFundRelease flag column from campaigns.

-- ── Step 1: Drop tables in FK-dependency order ────────────────────────────

-- fund_releases references campaign_milestones, so drop first
DROP TABLE IF EXISTS "fund_releases";

-- milestone_evidence references campaign_milestones, so drop second
DROP TABLE IF EXISTS "milestone_evidence";

-- campaign_milestones has no dependents left
DROP TABLE IF EXISTS "campaign_milestones";

-- ── Step 2: Remove milestone flag from campaigns ──────────────────────────

ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "milestone_fund_release";

-- ── Step 3: Drop enums that are no longer referenced ──────────────────────

DROP TYPE IF EXISTS "fund_release_status";
DROP TYPE IF EXISTS "milestone_status";
