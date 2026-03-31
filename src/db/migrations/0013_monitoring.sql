-- Migration 0013: Monitoring, Cost Control & Operational Maturity (Milestone 7)

-- AI Usage Logs: Track every AI call with token counts, latency, and model used.
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON ai_usage_logs (model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_prompt_type ON ai_usage_logs (prompt_type);

-- News items: Add admin review columns for classification override and flagging.
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS admin_flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS admin_override_category campaign_category;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_news_items_admin_flagged ON news_items (admin_flagged);

-- Seed default AI cost alert threshold in site_settings (in cents, default $5/day = 500 cents).
INSERT INTO site_settings (key, value, updated_at)
VALUES ('ai_daily_cost_alert_cents', '500'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- Seed default campaign creation rate limit (max per day).
INSERT INTO site_settings (key, value, updated_at)
VALUES ('campaign_creation_daily_limit', '10'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
