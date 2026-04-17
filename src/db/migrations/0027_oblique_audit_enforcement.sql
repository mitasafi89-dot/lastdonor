-- Migration 0027: Oblique Audit Enforcement
-- Enforces ACID, N+1, finite-resource, and data-integrity findings.

-- ============================================================================
-- 1. CHECK CONSTRAINTS: Non-negative numeric fields
-- ============================================================================

ALTER TABLE users ADD CONSTRAINT users_total_donated_nonneg CHECK (total_donated >= 0);
ALTER TABLE users ADD CONSTRAINT users_campaigns_supported_nonneg CHECK (campaigns_supported >= 0);
ALTER TABLE users ADD CONSTRAINT users_last_donor_count_nonneg CHECK (last_donor_count >= 0);
ALTER TABLE users ADD CONSTRAINT users_donor_score_nonneg CHECK (donor_score >= 0);
ALTER TABLE users ADD CONSTRAINT users_failed_login_nonneg CHECK (failed_login_count >= 0);

ALTER TABLE campaigns ADD CONSTRAINT campaigns_raised_nonneg CHECK (raised_amount >= 0);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_goal_positive CHECK (goal_amount > 0);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_donor_count_nonneg CHECK (donor_count >= 0);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_released_nonneg CHECK (total_released_amount >= 0);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_released_lte_raised CHECK (total_released_amount <= raised_amount);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_withdrawn_nonneg CHECK (total_withdrawn_amount >= 0);

-- ============================================================================
-- 2. ECHO COLUMNS: Pre-computed counters to eliminate N+1 on listing pages
-- ============================================================================

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS seed_donation_count integer NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS update_count integer NOT NULL DEFAULT 0;

-- Backfill echo columns from current data
UPDATE campaigns SET seed_donation_count = sub.cnt
FROM (
  SELECT campaign_id, COUNT(*)::int AS cnt
  FROM donations WHERE source = 'seed'
  GROUP BY campaign_id
) sub
WHERE campaigns.id = sub.campaign_id;

UPDATE campaigns SET message_count = sub.cnt
FROM (
  SELECT campaign_id, COUNT(*)::int AS cnt
  FROM campaign_messages
  GROUP BY campaign_id
) sub
WHERE campaigns.id = sub.campaign_id;

UPDATE campaigns SET update_count = sub.cnt
FROM (
  SELECT campaign_id, COUNT(*)::int AS cnt
  FROM campaign_updates
  GROUP BY campaign_id
) sub
WHERE campaigns.id = sub.campaign_id;

-- ============================================================================
-- 3. MISSING FOREIGN KEYS
-- ============================================================================

-- blog_posts.topic_id -> blog_topic_queue.id
ALTER TABLE blog_posts ADD CONSTRAINT fk_blog_posts_topic
  FOREIGN KEY (topic_id) REFERENCES blog_topic_queue(id) ON DELETE SET NULL;

-- blog_generation_logs.topic_id -> blog_topic_queue.id
ALTER TABLE blog_generation_logs ADD CONSTRAINT fk_blog_gen_logs_topic
  FOREIGN KEY (topic_id) REFERENCES blog_topic_queue(id) ON DELETE CASCADE;

-- blog_generation_logs.post_id -> blog_posts.id
ALTER TABLE blog_generation_logs ADD CONSTRAINT fk_blog_gen_logs_post
  FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. PARTIAL UNIQUE INDEX: One active fund release per milestone
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_releases_active_milestone
  ON fund_releases (milestone_id)
  WHERE status IN ('approved', 'processing', 'released');

-- ============================================================================
-- 5. TRANSACTION SAFETY: Timeouts to prevent runaway transactions
-- ============================================================================

ALTER DATABASE CURRENT SET idle_in_transaction_session_timeout = '60000';
ALTER DATABASE CURRENT SET statement_timeout = '30000';
ALTER DATABASE CURRENT SET lock_timeout = '10000';

-- ============================================================================
-- 6. MIRROR CONSTRAINT: Prevent donations to completed/cancelled campaigns
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_donation_to_inactive_campaign() RETURNS trigger AS $$
DECLARE
  campaign_status text;
BEGIN
  SELECT status INTO campaign_status FROM campaigns WHERE id = NEW.campaign_id;
  IF campaign_status IN ('completed', 'archived', 'cancelled', 'suspended') THEN
    RAISE EXCEPTION 'Cannot donate to a % campaign', campaign_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_donation_to_inactive ON donations;
CREATE TRIGGER trg_prevent_donation_to_inactive
  BEFORE INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION prevent_donation_to_inactive_campaign();
