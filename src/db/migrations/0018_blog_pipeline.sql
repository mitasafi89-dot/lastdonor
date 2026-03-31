-- Migration 0018: Blog Automation Pipeline
-- Adds blog_topic_queue, blog_generation_logs tables
-- Extends blog_posts with pipeline-specific columns

-- ─── New Enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE blog_topic_status AS ENUM (
    'pending',
    'generating',
    'generated',
    'published',
    'rejected',
    'stale'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE blog_source AS ENUM (
    'ai_generated',
    'manual',
    'refresh'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Blog Topic Queue ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_topic_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  primary_keyword TEXT NOT NULL,
  secondary_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_intent TEXT,
  target_word_count INTEGER NOT NULL DEFAULT 3000,
  cause_category TEXT,
  priority_score INTEGER NOT NULL DEFAULT 50,
  seasonal_boost INTEGER NOT NULL DEFAULT 0,
  news_hook TEXT,
  source_news_id UUID REFERENCES news_items(id),
  content_brief JSONB,
  outline JSONB,
  status blog_topic_status NOT NULL DEFAULT 'pending',
  generated_post_id UUID REFERENCES blog_posts(id),
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_topic_queue_status ON blog_topic_queue(status);
CREATE INDEX IF NOT EXISTS idx_blog_topic_queue_priority ON blog_topic_queue(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_blog_topic_queue_category ON blog_topic_queue(cause_category);

-- ─── Blog Generation Logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blog_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES blog_topic_queue(id),
  post_id UUID REFERENCES blog_posts(id),
  step TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_gen_logs_topic ON blog_generation_logs(topic_id);
CREATE INDEX IF NOT EXISTS idx_blog_gen_logs_step ON blog_generation_logs(step);
CREATE INDEX IF NOT EXISTS idx_blog_gen_logs_created ON blog_generation_logs(created_at);

-- ─── Extend blog_posts Table ────────────────────────────────────────────────

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS source blog_source NOT NULL DEFAULT 'manual';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS primary_keyword TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS secondary_keywords JSONB DEFAULT '[]'::jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_score INTEGER;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS word_count INTEGER;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS readability_score REAL;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS internal_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS external_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS faq_data JSONB;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES blog_topic_queue(id);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cause_category TEXT;
