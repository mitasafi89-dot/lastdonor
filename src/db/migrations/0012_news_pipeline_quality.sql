-- Migration: 0012_news_pipeline_quality
-- Milestone 5: News Pipeline Quality improvements

-- Add article_body column to news_items for storing fetched full article text
ALTER TABLE "news_items" ADD COLUMN "article_body" text;

-- Keyword rotation tracking table
CREATE TABLE IF NOT EXISTS "keyword_rotation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL,
  "keyword" text NOT NULL,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_keyword_rotation_category" ON "keyword_rotation" ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_keyword_rotation_category_keyword" ON "keyword_rotation" ("category", "keyword");
