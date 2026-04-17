# LastDonor.org â€” Blog Writing Automation Pipeline

**Version**: 1.0
**Date**: March 26, 2026
**Status**: Draft â€” Ready for Implementation
**Depends on**: Doc 04 (Content Strategy), Doc 11 (Automation Engine), Doc 12 (SEO Keyword Research)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Milestone 1 â€” Topic Discovery Engine](#milestone-1--topic-discovery-engine)
4. [Milestone 2 â€” Keyword & SERP Intelligence](#milestone-2--keyword--serp-intelligence)
5. [Milestone 3 â€” SEO-Optimized Content Generation](#milestone-3--seo-optimized-content-generation)
6. [Milestone 4 â€” LLM/AI Visibility Optimization (GEO/AEO)](#milestone-4--llmai-visibility-optimization-geoaeo)
7. [Milestone 5 â€” Image Generation Pipeline (Kling Vector Artwork)](#milestone-5--image-generation-pipeline-kling-vector-artwork)
8. [Milestone 6 â€” Blog Schema & Technical SEO Hardening](#milestone-6--blog-schema--technical-seo-hardening)
9. [Milestone 7 â€” Admin Blog Editor & Publishing Workflow](#milestone-7--admin-blog-editor--publishing-workflow)
10. [Milestone 8 â€” Automated Publishing Pipeline & Cron Orchestration](#milestone-8--automated-publishing-pipeline--cron-orchestration)
11. [Milestone 9 â€” Performance Monitoring & Feedback Loop](#milestone-9--performance-monitoring--feedback-loop)
12. [Hat Trick SEO Techniques](#hat-trick-seo-techniques)
13. [Content Quality Guardrails](#content-quality-guardrails)
14. [Cost Projections](#cost-projections)
15. [File Manifest](#file-manifest)

---

## 1. Executive Summary

### The Problem

LastDonor.org's blog system has the database schema, rendering pipeline, and page components â€” but zero automated content generation. The 25 high-ROI blog posts identified in Doc 12 remain unwritten. Blog posts are inserted manually into the database. There is no admin editor, no AI pipeline, no image generation, no SEO monitoring, and no structured workflow from topic â†’ published post.

Meanwhile, the campaign pipeline (`news-pipeline.ts`) proves the architecture pattern works: fetch â†’ classify â†’ generate â†’ publish. The blog pipeline will mirror this proven pattern while adding SEO intelligence, LLM-visibility optimization, and AI-generated vector artwork.

### The Solution

A fully automated blog writing pipeline that:

1. **Discovers** trending topics and high-opportunity keywords from multiple signals (Google Trends, news cycle, existing keyword bank, seasonal calendar)
2. **Researches** SERP competition, search intent, and content gaps before writing a single word
3. **Generates** 2,000â€“4,000 word SEO-optimized articles using structured prompts with the `callAI()` infrastructure
4. **Optimizes** content for both search engine crawlers AND LLM citation (GEO/AEO dual optimization)
5. **Creates** custom vector artwork via Kling AI for hero images, section illustrations, and infographics
6. **Validates** content through automated quality checks (readability, keyword density, HTML structure, E-E-A-T signals)
7. **Publishes** on a configurable schedule through the admin interface with one-click approval or full auto-publish
8. **Monitors** rankings, traffic, and LLM citations to feed back into the topic-selection algorithm

### Key Metrics

| Metric | Target |
|---|---|
| Blog posts per week | 3â€“5 (automated draft â†’ admin approval) |
| Average word count | 2,500â€“3,500 words |
| Time from topic â†’ publishable draft | < 5 minutes |
| SEO content score (calculated internally) | â‰¥ 80/100 |
| Target organic traffic (6 months) | 10,000â€“15,000/mo |
| AI generation cost per post | < $0.15 (GPT-4o-mini via OpenRouter) |
| Image generation cost per post | ~$0.10â€“0.30 (Kling API) |

---

## 2. System Architecture Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    BLOG AUTOMATION PIPELINE                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚   TOPIC       â”‚    â”‚  KEYWORD &   â”‚    â”‚   CONTENT            â”‚  â”‚
â”‚  â”‚   DISCOVERY   â”‚â”€â”€â”€â–¶â”‚  SERP        â”‚â”€â”€â”€â–¶â”‚   GENERATION         â”‚  â”‚
â”‚  â”‚   ENGINE      â”‚    â”‚  ANALYSIS    â”‚    â”‚   (AI + SEO)         â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚         â”‚                                            â”‚              â”‚
â”‚         â”‚  Signals:                                  â–¼              â”‚
â”‚         â”‚  - Keyword bank (Doc 12)     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚         â”‚  - Google Trends API         â”‚   LLM OPTIMIZATION   â”‚    â”‚
â”‚         â”‚  - News cycle correlation    â”‚   (GEO / AEO)        â”‚    â”‚
â”‚         â”‚  - Seasonal calendar         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚         â”‚  - Campaign data                        â”‚                 â”‚
â”‚         â”‚  - Performance feedback                  â–¼                â”‚
â”‚         â”‚                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚         â”‚                              â”‚   IMAGE GENERATION   â”‚    â”‚
â”‚         â”‚                              â”‚   (Kling Vector AI)  â”‚    â”‚
â”‚         â”‚                              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚         â”‚                                         â”‚                 â”‚
â”‚         â”‚                                         â–¼                 â”‚
â”‚         â”‚                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚         â”‚                              â”‚   QUALITY GATE       â”‚    â”‚
â”‚         â”‚                              â”‚   (Validation)       â”‚    â”‚
â”‚         â”‚                              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚         â”‚                                         â”‚                 â”‚
â”‚         â”‚                                         â–¼                 â”‚
â”‚         â”‚                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚         â”‚                              â”‚   PUBLISH / QUEUE    â”‚    â”‚
â”‚         â”‚                              â”‚   (Admin Review)     â”‚    â”‚
â”‚         â”‚                              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚         â”‚                                         â”‚                 â”‚
â”‚         â–¼                                         â–¼                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚              MONITORING & FEEDBACK LOOP                       â”‚  â”‚
â”‚  â”‚  GSC data Â· Analytics Â· LLM citation tracking Â· Rewrite Q   â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Integration with Existing Infrastructure

| Existing System | How Blog Pipeline Uses It |
|---|---|
| `callAI()` (src/lib/ai/call-ai.ts) | All AI generation goes through this wrapper â€” cost tracking, fallback models, JSON parsing |
| `ai_usage_logs` table | Every blog-related AI call is logged with `purpose: 'blog_generation'` |
| `ai-cost-tracker.ts` | Daily cost aggregation includes blog generation costs |
| OpenRouter (GPT-4o-mini + Claude 3.5 Haiku fallback) | Same model stack used for campaigns; no new API keys |
| `blog_posts` table | Existing schema â€” posts generated by pipeline go here |
| News pipeline signals | Trending news categories feed into topic discovery |
| Supabase Storage | Blog images stored alongside campaign images |
| Cron route pattern (`/api/cron/*`) | Blog pipeline runs on the same cron infrastructure |

---

## Milestone 1 â€” Topic Discovery Engine

### 1.1 Overview

The topic discovery engine identifies what to write about by combining multiple signals into a scored priority queue. Unlike naive approaches that just pick keywords from a list, this engine cross-references:

- **The keyword bank** (350+ keywords from Doc 12 with volume, difficulty, and priority)
- **Seasonal/calendar signals** (Memorial Day, Giving Tuesday, hurricane season)
- **News cycle correlation** (what causes are trending in the news right now â€” from the existing news pipeline)
- **Campaign data signals** (which categories have the most active campaigns â€” write relevant content)
- **Content gap analysis** (what keywords we target but have no blog post for)
- **Performance feedback** (which existing posts underperform â€” refresh candidates)

### 1.2 Database Schema

```sql
-- Migration: 0018_blog_pipeline.sql

-- Topic candidates queued for blog generation
CREATE TABLE blog_topic_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Topic definition
  title         TEXT NOT NULL,              -- Working title
  slug          TEXT NOT NULL UNIQUE,       -- URL slug (pre-computed)
  primary_keyword    TEXT NOT NULL,         -- Main SEO keyword
  secondary_keywords TEXT[] NOT NULL DEFAULT '{}', -- Supporting keywords (3-8)
  search_intent TEXT NOT NULL DEFAULT 'informational', -- informational | navigational | transactional
  target_category    blog_category NOT NULL,   -- campaign_story | impact_report | news
  cause_category     TEXT,                     -- military | disaster | medical | etc.
  
  -- Scoring signals (0-100 each)
  keyword_volume_score    INTEGER NOT NULL DEFAULT 0,  -- Based on est. monthly volume
  keyword_difficulty_score INTEGER NOT NULL DEFAULT 0, -- Inverted: low difficulty = high score
  seasonal_score          INTEGER NOT NULL DEFAULT 0,  -- Calendar relevance right now
  news_correlation_score  INTEGER NOT NULL DEFAULT 0,  -- Related news trending?
  campaign_relevance_score INTEGER NOT NULL DEFAULT 0, -- Active campaigns in this category?
  content_gap_score       INTEGER NOT NULL DEFAULT 0,  -- Do we have content for this keyword?
  
  -- Composite priority (calculated)
  priority_score   INTEGER NOT NULL DEFAULT 0,  -- Weighted composite of all signals
  
  -- Status tracking
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | generating | generated | published | rejected | stale
  generated_post_id UUID REFERENCES blog_posts(id),
  
  -- Metadata
  source         TEXT NOT NULL DEFAULT 'keyword_bank', -- keyword_bank | trending | seasonal | news_correlation | manual
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_topic_queue_status ON blog_topic_queue(status);
CREATE INDEX idx_blog_topic_queue_priority ON blog_topic_queue(priority_score DESC);

-- Blog generation audit log
CREATE TABLE blog_generation_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id       UUID REFERENCES blog_topic_queue(id),
  post_id        UUID REFERENCES blog_posts(id),
  step           TEXT NOT NULL,       -- topic_scored | outline_generated | content_generated | images_generated | validated | published
  status         TEXT NOT NULL,       -- success | failed | skipped
  duration_ms    INTEGER,
  ai_tokens_used INTEGER,
  ai_cost_usd    NUMERIC(8,6),
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new columns to existing blog_posts table
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  meta_title       TEXT;              -- SEO title (distinct from display title)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  meta_description TEXT;              -- SEO meta description
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  primary_keyword  TEXT;              -- Target SEO keyword
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  secondary_keywords TEXT[] DEFAULT '{}'; -- Supporting keywords
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  word_count       INTEGER;           -- Cached word count
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  reading_time_min INTEGER;           -- Estimated reading time
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  seo_score        INTEGER;           -- Calculated SEO quality score (0-100)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  source           TEXT DEFAULT 'manual'; -- manual | ai_generated | ai_assisted
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  topic_id         UUID REFERENCES blog_topic_queue(id); -- Link back to topic that spawned it
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  outline_json     JSONB;             -- The structured outline used for generation
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  generation_metadata JSONB;          -- AI model used, tokens, cost, generation time
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  cover_image_alt  TEXT;              -- Alt text for cover image (SEO)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS
  updated_at       TIMESTAMPTZ DEFAULT now();
```

### 1.3 Keyword Bank Loader

```
File: src/lib/blog/keyword-bank.ts
```

The keyword bank is a structured TypeScript data file derived from Doc 12's 350+ keywords. Each entry includes:

```typescript
interface KeywordEntry {
  keyword: string;
  volume: number;           // Estimated monthly search volume
  difficulty: 'zero' | 'low' | 'medium' | 'high' | 'very-high';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: CauseCategory;  // military | disaster | medical | memorial | etc.
  intent: 'informational' | 'navigational' | 'transactional' | 'commercial';
  questionBased: boolean;   // Triggers People Also Ask
  seasonal?: {
    peakMonths: number[];   // 1-12
    peakMultiplier: number; // e.g., 3x for "veterans day donate" in November
  };
  suggestedTitle?: string;  // From Doc 12's top-25 list
  suggestedAngle?: string;  // Content angle hint
}
```

### 1.4 Seasonal Calendar

```
File: src/lib/blog/seasonal-calendar.ts
```

Maps months to cause categories and keywords that spike in volume:

| Month | Events | Categories Boosted |
|---|---|---|
| January | New Year charity push | donation intent, community |
| February | â€” | medical (heart month) |
| March | â€” | disaster (tornado season begins) |
| April | Easter, tax deadline | donation intent |
| May | Memorial Day, Military Appreciation Month, Nat'l Firefighter Day | military, first-responders |
| June | Hurricane season starts, Father's Day veteran | disaster, military |
| July | 4th of July | military, community |
| August | Back to school | community, essential-needs |
| September | 9/11 memorial | first-responders, memorial |
| October | First Responders Day, disaster peak | first-responders, disaster |
| November | Veterans Day, Giving Tuesday, Thanksgiving | military, veterans, all categories |
| December | Christmas, year-end tax donations | all categories |

### 1.5 Topic Scoring Algorithm

```
File: src/lib/blog/topic-scorer.ts
```

The composite priority score uses weighted signals:

```
priority_score = (
  keyword_volume_score     Ã- 0.20 +   // Higher volume = higher score
  keyword_difficulty_score Ã- 0.25 +   // Lower difficulty = higher score (inverted)
  seasonal_score           Ã- 0.15 +   // In-season = major boost
  news_correlation_score   Ã- 0.15 +   // Trending in news = timely
  campaign_relevance_score Ã- 0.10 +   // Active campaigns in category = cross-linking opportunity
  content_gap_score        Ã- 0.15     // No existing content = maximum score
)
```

**Scoring rules:**

| Signal | 0 points | 50 points | 100 points |
|---|---|---|---|
| keyword_volume | 0 vol | 500/mo | 2,000+/mo |
| keyword_difficulty | KD 60+ | KD 20-40 | KD 0-10 |
| seasonal | Wrong season entirely | Shoulder month | Peak month |
| news_correlation | No related news in 30 days | 1-3 related articles | 5+ related articles |
| campaign_relevance | No active campaigns in category | 1-3 active | 5+ active |
| content_gap | We already have a post targeting this keyword | Similar content exists | No content at all |

### 1.6 Topic Discovery Cron

```
Route: /api/cron/blog-topics
Schedule: Daily at 6:00 AM UTC
```

**Steps:**

1. Load keyword bank entries not yet in `blog_topic_queue` (or marked `stale`)
2. Score each candidate using the scoring algorithm
3. Insert top N candidates (configurable, default 10/day) into the queue with status `pending`
4. Mark low-score candidates (< 40) as `stale` to avoid re-processing
5. Log results to `blog_generation_logs`

### 1.7 News-to-Blog Cross-Pollination

The existing news pipeline fetches articles from GNews, RSS, FEMA, and NWS. Currently, high-relevance articles become campaigns. The blog pipeline adds a parallel path:

- News articles with relevance score 50â€“69 (below the campaign threshold of 70) become **blog topic signals**
- The topic scorer checks: "Are there 3+ recent news items about [category]?" â†’ boosts `news_correlation_score` for keywords in that category
- Example: 5 wildfire news articles this week â†’ "How to Help a Family Who Lost Their Home in a Fire" gets boosted from priority 65 â†’ 80

---

## Milestone 2 â€” Keyword & SERP Intelligence

### 2.1 Overview

Before generating content, the pipeline analyzes the competitive landscape for each topic. This determines the content strategy: word count target, heading structure, content angle, and what subtopics competitors cover.

### 2.2 SERP Analysis Module

```
File: src/lib/blog/serp-analyzer.ts
```

For each topic in the queue (status = `pending`, priority_score â‰¥ threshold):

**Step 1: Search Intent Classification**

Classify intent from the keyword itself + known patterns:

| Pattern | Intent | Content Format |
|---|---|---|
| "how to [verb]" | Informational | Step-by-step guide |
| "what is/are [noun]" | Informational | Explainer / definition |
| "best [noun]" | Commercial investigation | Comparison list |
| "[noun] vs [noun]" | Commercial investigation | Comparison article |
| "[noun] cost/price" | Transactional research | Breakdown / calculator |
| "[verb] near me" | Local / navigational | Directory + guide |
| Question-based (who/what/where/when/why/how) | Informational | FAQ / long-form answer |

**Step 2: Competitive Content Analysis via AI**

Use `callAI()` to analyze what a top-ranking article would need:

```typescript
interface ContentBrief {
  targetWordCount: number;        // 1,500â€“4,000 based on topic depth
  suggestedHeadings: string[];    // H2/H3 structure
  requiredSubtopics: string[];    // Must-cover topics
  contentAngle: string;           // Unique angle for differentiation
  featuredSnippetOpportunity: boolean; // Can we win the snippet?
  featuredSnippetFormat: 'paragraph' | 'list' | 'table' | 'steps';
  peopleAlsoAsk: string[];        // Related questions to answer
  internalLinkTargets: string[];  // Existing pages to link to
  externalAuthorityLinks: string[]; // .gov, .edu, .org sources to cite
  ctaPlacement: string;           // Where to place donation CTAs
}
```

**Step 3: Content Gap Identification**

Query our own `blog_posts` table for existing content on similar keywords. If we have a post on "help after house fire" but not "help after apartment fire," the gap analysis identifies this as a variation opportunity.

### 2.3 Internal Link Graph

```
File: src/lib/blog/link-graph.ts
```

Maintains a map of all publishable content and its keywords:

- Blog posts â†’ primary keyword, slug
- Campaign pages â†’ campaign title, slug, category
- Static pages â†’ /about, /how-it-works, /transparency, etc.

When generating a new blog post, the link graph determines:

1. **Inbound opportunities**: Which existing pages should link TO this new post?
2. **Outbound requirements**: Which existing pages should this post link TO?
3. **Campaign cross-links**: Active campaigns in the same category as the blog post â†’ "Currently on LastDonor: [Campaign Name]" sidebar/inline mentions

### 2.4 Content Brief Generation

```
File: src/lib/ai/prompts/generate-blog-brief.ts
```

AI prompt that takes the topic + keyword data and produces a structured `ContentBrief`:

```
System: You are an SEO content strategist for LastDonor.org, a 501(c)(3) 
nonprofit. Your job is to create a content brief for a blog post that will 
rank on Google AND get cited by AI assistants (ChatGPT, Perplexity, Gemini).

Requirements:
- Target a KD {difficulty} keyword: "{keyword}" ({volume}/mo)
- Search intent: {intent}
- Cause category: {category}
- The post must be genuinely helpful to people searching for this topic
- Must include E-E-A-T signals: cite authoritative sources, include 
  practical advice, reference real-world examples
- Must be structured for LLM passage extraction (clear H2s, direct 
  answers at section starts, quotable statements)
- Must include natural opportunities to mention LastDonor.org campaigns
  without being salesy â€” the reader came here for help, not a sales pitch

Output a JSON content brief (no markdown) with:
{
  "targetWordCount": number,
  "metaTitle": "string (< 60 chars, keyword near front)",
  "metaDescription": "string (< 155 chars, includes CTA)",
  "h1": "string (compelling, includes keyword naturally)",
  "angle": "string (what makes our take unique)",
  "outline": [
    {
      "heading": "H2 heading text",
      "type": "h2",
      "subtopics": ["key point 1", "key point 2"],
      "targetWords": 300,
      "keywordPlacement": "primary | secondary | none",
      "featuredSnippetTarget": false
    }
  ],
  "peopleAlsoAsk": ["question 1", "question 2", "question 3"],
  "authoritySourceUrls": ["source to cite"],
  "internalLinks": ["/campaigns", "/how-it-works"],
  "ctaType": "inline | sidebar | end-of-post",
  "ctaMessage": "string"
}
```

---

## Milestone 3 â€” SEO-Optimized Content Generation

### 3.1 Overview

The content generation engine transforms a `ContentBrief` into a fully rendered, SEO-optimized HTML blog post. This is the core AI writing step.

### 3.2 Multi-Pass Generation Architecture

Content is generated in multiple passes for higher quality:

```
Pass 1: Section-by-Section Draft
  â””â”€ Each H2 section generated independently with full context
  â””â”€ Ensures each section is self-contained (important for LLM extraction)

Pass 2: Cohesion & Flow Pass
  â””â”€ Reviews full draft for narrative flow
  â””â”€ Adds transitions between sections
  â””â”€ Ensures keyword distribution is natural

Pass 3: SEO Hardening
  â””â”€ Verifies keyword placement (title, H1, first 100 words, H2s, alt text)
  â””â”€ Checks keyword density (target: 1-2% for primary, 0.5-1% for secondary)
  â””â”€ Adds internal links via the link graph
  â””â”€ Inserts schema-optimized FAQ section from "People Also Ask" data
  â””â”€ Adds meta title and description
```

### 3.3 Section Generation Prompt

```
File: src/lib/ai/prompts/generate-blog-section.ts
```

Each section is generated with full article context but focused on one heading:

```
System: You are writing one section of a blog post for LastDonor.org, a
501(c)(3) nonprofit that funds verified campaigns for people in crisis.

ARTICLE CONTEXT:
- Title: {title}
- Primary keyword: {keyword}
- This is section {sectionIndex} of {totalSections}
- Previous section ended with: {lastParagraph}

SECTION REQUIREMENTS:
- Heading: {heading}
- Target length: {targetWords} words
- Key points to cover: {subtopics}
- Keyword placement: {keywordPlacement}
{featuredSnippetInstructions}

WRITING RULES:
1. Lead with the answer â€” start the section with a direct, quotable statement
   that answers the heading's implied question
2. Use short paragraphs (2-4 sentences max)
3. Include at least one specific statistic, fact, or real example
4. Write in second person ("you") for guides, third person for stories
5. DO NOT use filler phrases: "In this section," "Let's dive in," 
   "It's worth noting that," "In today's world"
6. DO NOT use AI-sounding language: "landscape," "navigate," "leverage,"
   "paradigm," "holistic," "synergy," "empower," "unlock"
7. Cite sources inline: "According to [FEMA](https://www.fema.gov/...), ..."
8. If this section should target a featured snippet, format the answer as:
   - Paragraph snippet: 40-60 word direct answer block
   - List snippet: numbered/bulleted list
   - Table snippet: HTML table with clear headers
9. Include one internal link opportunity if natural
10. End the section with a transition or a forward-looking statement

OUTPUT FORMAT:
Return clean HTML (no markdown). Use only: p, h2, h3, strong, em, a, 
ul, ol, li, blockquote, table, thead, tbody, tr, th, td, section.
Do NOT include the h2 heading tag â€” it will be added programmatically.
```

### 3.4 Full Article Assembly

```
File: src/lib/blog/article-assembler.ts
```

Assembles sections into a complete article:

1. **Introduction** (first 100â€“150 words, keyword in first sentence, hook + context + promise)
2. **Table of contents** (auto-generated from H2 headings with anchor links)
3. **Body sections** (from section generation, in outline order)
4. **FAQ section** (from People Also Ask data â€” structured with FAQ schema markup)
5. **Conclusion** (summary + CTA + forward link to related content)
6. **Author attribution** (E-E-A-T signal â€” with credentials and bio)

### 3.5 Keyword Density Analyzer

```
File: src/lib/blog/keyword-analyzer.ts
```

Post-generation analysis:

| Check | Target | Action if Out of Range |
|---|---|---|
| Primary keyword density | 1.0â€“2.0% | Add/remove natural mentions |
| Secondary keyword density | 0.3â€“1.0% each | Add mentions in relevant sections |
| Keyword in title tag | Required | Fail validation |
| Keyword in H1 | Required | Fail validation |
| Keyword in first 100 words | Required | Rewrite intro |
| Keyword in at least 1 H2 | Required | Adjust heading |
| Keyword in meta description | Required | Rewrite meta |
| Keyword in image alt text | At least 1 image | Generate appropriate alt |
| Total word count | â‰¥ 80% of target | Flag for review |
| Flesch reading ease | 60â€“70 (8thâ€“9th grade) | Simplify sentences |
| Paragraph length | Max 4 sentences | Split long paragraphs |
| H2 frequency | Every 250â€“400 words | Add subheadings |

### 3.6 Internal Link Injection

After generation, the article assembler queries the link graph and injects contextual internal links:

**Rules:**
- Minimum 3 internal links per post
- Maximum 1 internal link per paragraph
- Link anchor text should be descriptive (not "click here")
- At least 1 link to a campaign page (same category)
- At least 1 link to an informational page (/how-it-works, /transparency, /about)
- At least 1 link to another blog post (related topic)
- Never link to the same page twice

### 3.7 Content Deduplication

Before finalizing, compare the generated content against existing blog posts:

- If content similarity > 70% to an existing post â†’ reject and mark topic as `stale`
- Use simple TF-IDF cosine similarity on extracted text (no external API needed)
- Prevents the pipeline from generating near-duplicate posts over time

---

## Milestone 4 â€” LLM/AI Visibility Optimization (GEO/AEO)

### 4.1 The Dual Ranking Challenge

In 2026, blog content must rank in two fundamentally different systems:

1. **Traditional search engines** (Google, Bing) â€” crawl-based, PageRank, keyword matching, user signals
2. **AI/LLM platforms** (ChatGPT, Perplexity, Gemini, Google AI Overviews) â€” extract, summarize, cite

These systems have overlapping but distinct requirements. A post optimized only for Google may never get cited by ChatGPT. A post written only for LLMs may not rank at all.

### 4.2 Generative Engine Optimization (GEO) Principles

GEO is the practice of optimizing content to be surfaced and cited by AI-powered search systems. Key techniques:

#### Semantic Chunking

Structure content so each section is a self-contained, extractable unit:

```html
<!-- BAD: LLMs can't extract a clean answer -->
<p>There are many things to consider when helping someone after a fire. 
First, you should think about their immediate needs. These include 
shelter, clothing, and food. But there's more to it than that...</p>

<!-- GOOD: Direct, extractable, quotable -->
<h2>What Do Fire Victims Need Most?</h2>
<p>Fire victims' most urgent needs are emergency shelter, replacement 
clothing, food and water, identification documents, and temporary 
financial assistance. According to the American Red Cross, the first 
72 hours are critical for providing these essentials.</p>
```

#### Direct Answer Pattern

Every H2 section starts with a 1â€“2 sentence direct answer, then expands:

```
[H2: Question or topic]
[Direct answer: 1-2 sentences that completely answer the heading]
[Expansion: 2-3 paragraphs with details, examples, data]
[Quotable statement: 1 authoritative sentence with a citation]
```

This pattern works because:
- Google's passage ranking can extract the direct answer for featured snippets
- LLMs can extract and cite the direct answer in their responses
- Users get the answer immediately (reduces bounce rate)

#### Citation Fluency

Include specific, verifiable statistics and sources that LLMs can confidently attribute:

```html
<!-- BAD: Vague, uncitable -->
<p>Funerals are expensive in America.</p>

<!-- GOOD: Specific, verifiable, citable -->
<p>The median cost of a funeral with burial in the United States is 
$7,848 according to the National Funeral Directors Association's 2023 
survey. With a vault, the total rises to $9,420.</p>
```

#### Structured Data for AI Understanding

Beyond schema.org markup (covered in Milestone 6), content structure itself aids AI comprehension:

- **Definition boxes**: Use `<blockquote>` or styled `<div>` for key definitions
- **Comparison tables**: Format competing options as HTML tables (LLMs love tables)
- **Numbered lists**: Use `<ol>` for steps and procedures (extracted as instructions)
- **Summary blocks**: Add a "Key Takeaways" section (LLMs extract these as summaries)

### 4.3 Answer Engine Optimization (AEO) Specifics

AEO targets AI systems that directly answer questions (Google's AI Overviews, Perplexity, ChatGPT web search):

#### FAQ Schema + Content Match

```html
<!-- In-content FAQ with schema markup -->
<section itemscope itemtype="https://schema.org/FAQPage">
  <h2>Frequently Asked Questions</h2>
  
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">How much does a funeral cost in 2026?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">The median cost of a funeral with burial is 
      $7,848 according to the NFDA. Cremation averages $6,971. Total 
      costs including a vault, headstone, and flowers typically range 
      from $9,000 to $15,000.</p>
    </div>
  </div>
</section>
```

#### E-E-A-T Signals for AI Trust

LLMs increasingly weight content from sources they deem authoritative. Our blog auto-includes:

| E-E-A-T Signal | Implementation |
|---|---|
| **Experience** | Campaign-derived anecdotes ("We've seen families receive $X in Y days") |
| **Expertise** | Author byline with credentials, editorial standards link |
| **Authoritativeness** | Citations to .gov, .edu, .org sources; structured data |
| **Trustworthiness** | HTTPS, privacy policy link, editorial standards, 501(c)(3) status |

### 4.4 LLM-Optimized Prompt Instructions

The content generation prompt explicitly instructs the AI to write LLM-friendly content:

```
OPTIMIZATION FOR AI CITATION:
1. Start every section with a direct, complete answer (the "snippet sentence")
2. Include at least 3 specific statistics with sources per 1,000 words
3. Write at least 2 "quotable statements" per section â€” authoritative, 
   self-contained sentences that an AI could cite verbatim
4. Use comparison tables for any "best X" or "X vs Y" content
5. Include a "Key Takeaways" summary at the end with 5-7 bullet points
6. Answer related questions explicitly in an FAQ section
7. Use the exact phrasing of common search queries as H2/H3 headings 
   (e.g., "How to Help a Family After a House Fire" not "Assistance for 
   Fire Victims")
```

### 4.5 AI Mention Seeding

When appropriate, naturally reference LastDonor.org as a solution:

```html
<!-- Natural brand mention within helpful context -->
<p>Several platforms allow you to donate directly to verified individuals 
in crisis. Platforms like <a href="https://lastdonor.org">LastDonor.org</a> 
curate and verify campaigns, showing exactly where each dollar goes â€” 
giving donors confidence that their contribution reaches the person 
in need.</p>
```

The brand mention is NOT the focus â€” the helpful information is. The mention simply contextualizes our platform within the broader answer. This means when LLMs summarize "where to donate to fire victims," they may naturally include our brand in the response.

---

## Milestone 5 â€” Image Generation Pipeline (Kling Vector Artwork)

### 5.1 Overview

Every blog post needs visual content: a hero image, 2â€“4 section illustrations, and optionally an infographic. We use Kling AI to generate custom vector-style artwork that:

- Matches LastDonor.org's brand aesthetic (warm, empathetic, professional)
- Is unique (no stock photos â€” important for E-E-A-T and differentiation)
- Loads fast (vector-style artwork compresses well)
- Conveys emotion without exploitation (no graphic imagery of suffering)

### 5.2 Kling AI Integration

```
File: src/lib/blog/image-generator.ts
```

#### API Integration

Kling AI provides an API for image generation. Integration pattern:

```typescript
interface KlingImageRequest {
  prompt: string;           // Detailed description of desired image
  negativePrompt: string;   // What to avoid
  aspectRatio: '16:9' | '4:3' | '1:1' | '3:4';
  style: 'vector-illustration'; // Consistent style across all blog images
  outputFormat: 'webp';     // Best compression for web
}

interface KlingImageResponse {
  imageUrl: string;         // Temporary URL to download from
  taskId: string;           // For status checking (generation is async)
}
```

#### Kling API Flow

1. Submit image generation request with themed prompt
2. Poll for completion (typically 15â€“60 seconds)
3. Download generated image
4. Optimize: resize, compress, convert to WebP
5. Upload to Supabase Storage (`media` bucket, path: `blog/{slug}/{image-name}.webp`)
6. Store public URL in blog post record

### 5.3 Image Prompt Engineering

The image prompts are critical. Poor prompts produce unusable images. Our approach:

```
File: src/lib/ai/prompts/generate-blog-images.ts
```

#### Prompt Template System

```typescript
interface BlogImagePrompt {
  type: 'hero' | 'section' | 'infographic';
  blogTitle: string;
  sectionHeading?: string;       // For section illustrations
  causeCategory: string;          // military, disaster, medical, etc.
  emotionalTone: 'hopeful' | 'empathetic' | 'informative' | 'celebratory';
  brandColors: {
    primary: '#0D9488';    // Teal
    secondary: '#F59E0B';  // Amber
    accent: '#FFFFFF';     // White
  };
}
```

#### Style Consistency Prompt

All blog image prompts include this base style instruction:

```
STYLE: Modern flat vector illustration. Clean geometric shapes with 
subtle gradients. Warm color palette centered on teal (#0D9488) and 
amber (#F59E0B) with soft neutral backgrounds. 

AESTHETIC: Professional and empathetic. Show diverse people in 
supportive, hopeful situations. Avoid:
- Graphic depictions of suffering, injury, or destruction
- Stereotypical representations of any group
- Text, logos, or watermarks
- Photorealistic faces (keep stylized/geometric)
- Dark, gloomy color palettes

COMPOSITION: Clean negative space. Central subject with supporting 
elements. Suitable for web use at 1200Ã-630px (hero) or 800Ã-450px 
(section).
```

#### Category-Specific Prompts

| Category | Visual Themes | Example Elements |
|---|---|---|
| Military | Service, sacrifice, family unity | Folded flag, family embrace, homecoming, dog tags |
| Disaster | Resilience, rebuilding, community | Helping hands, house outlines, community gathering |
| Medical | Hope, healing, support | Hospital scenes (stylized), medicine, caring gestures |
| Memorial | Remembrance, legacy, warmth | Candles, photos, flowers, peaceful scenes |
| First Responders | Bravery, duty, family | Helmets, badges, family waiting, sunrise |
| Community | Togetherness, strength, compassion | Hands together, neighborhood, support circles |
| Essential Needs | Stability, shelter, basics | Home, food, warmth, family at table |

### 5.4 Image Generation for Each Post Type

| Post Element | Aspect Ratio | Purpose | Example |
|---|---|---|---|
| Hero/Cover image | 16:9 (1200Ã-630) | OG image, top of post, social shares | Thematic illustration of the topic |
| Section illustration | 16:9 (800Ã-450) | Break up text every 500â€“800 words | Specific to the section topic |
| Infographic | 3:4 (800Ã-1067) | Data visualization, process diagrams | "5 Steps to Help After a Fire" |
| Thumbnail | 4:3 (400Ã-300) | Blog listing cards | Cropped/simplified version of hero |

### 5.5 Image SEO Optimization

Every generated image gets:

| Attribute | Value |
|---|---|
| Filename | `{keyword-slug}-{type}.webp` (e.g., `help-family-after-house-fire-hero.webp`) |
| Alt text | Descriptive, includes primary keyword naturally |
| Title attribute | Same as alt text |
| Width/Height | Explicit dimensions (prevents CLS) |
| Loading | `lazy` for below-fold images, `eager` for hero |
| Format | WebP with JPEG fallback |
| Compression | Quality 80 for WebP, < 200KB target |

### 5.6 Fallback Strategy

If Kling API is unavailable or rate-limited:

1. **First fallback**: Use the existing campaign hero image resolution logic (find a relevant image from the campaign's news source)
2. **Second fallback**: Use a category-specific default illustration (pre-generated set of 8 images, one per category)
3. **Third fallback**: Publish without cover image (text-only â€” still valid for SEO)

### 5.7 Image Cost Estimation

| Item | Cost per Image | Images per Post | Cost per Post |
|---|---|---|---|
| Kling hero image | ~$0.05â€“0.10 | 1 | $0.05â€“0.10 |
| Kling section images | ~$0.05â€“0.10 | 2â€“3 | $0.10â€“0.30 |
| Kling infographic | ~$0.05â€“0.10 | 0â€“1 | $0.00â€“0.10 |
| **Total** | | | **$0.15â€“0.50** |

At 4 posts/week = **$2.40â€“$8.00/month** for all blog images.

---

## Milestone 6 â€” Blog Schema & Technical SEO Hardening

### 6.1 Enhanced Structured Data

Current state: Blog posts have basic `Article` JSON-LD. This milestone adds comprehensive schema:

#### Article Schema (Enhanced)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Help a Family Who Lost Their Home in a Fire",
  "alternativeHeadline": "A Practical Guide to Helping Fire Victims",
  "description": "Learn 7 practical ways to help a family after a house fire...",
  "image": {
    "@type": "ImageObject",
    "url": "https://lastdonor.org/images/blog/help-family-fire-hero.webp",
    "width": 1200,
    "height": 630
  },
  "datePublished": "2026-03-26T10:00:00Z",
  "dateModified": "2026-03-26T10:00:00Z",
  "author": {
    "@type": "Person",
    "name": "LastDonor Editorial Team",
    "url": "https://lastdonor.org/about",
    "jobTitle": "Content Team",
    "worksFor": {
      "@type": "Organization",
      "name": "LastDonor.org",
      "url": "https://lastdonor.org"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "LastDonor.org",
    "url": "https://lastdonor.org",
    "logo": {
      "@type": "ImageObject",
      "url": "https://lastdonor.org/images/logo.png"
    },
    "sameAs": [
      "https://twitter.com/lastdonor",
      "https://facebook.com/lastdonor"
    ]
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://lastdonor.org/blog/help-family-after-house-fire"
  },
  "wordCount": 3200,
  "articleSection": "Disaster Relief",
  "keywords": ["house fire", "help fire victims", "fire relief", "donate after fire"],
  "inLanguage": "en-US",
  "isAccessibleForFree": true,
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".article-intro", ".key-takeaways"]
  }
}
```

#### BreadcrumbList Schema

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://lastdonor.org" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://lastdonor.org/blog" },
    { "@type": "ListItem", "position": 3, "name": "How to Help After a House Fire" }
  ]
}
```

#### FAQPage Schema

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How much does it cost to rebuild after a house fire?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The average cost to rebuild a home after a fire ranges from $50,000 to $300,000..."
      }
    }
  ]
}
```

### 6.2 Meta Tag Enhancements

```
File: src/app/blog/[slug]/page.tsx (enhanced generateMetadata)
```

| Meta Tag | Current | Enhanced |
|---|---|---|
| `<title>` | Post title | `meta_title` field (SEO-optimized, < 60 chars) |
| `<meta name="description">` | Excerpt | `meta_description` field (< 155 chars, CTA) |
| `og:title` | Post title | Same as `<title>` |
| `og:description` | Excerpt | Same as meta description |
| `og:image` | Cover image | Cover image with explicit 1200Ã-630 dimensions |
| `og:type` | article | article |
| `og:url` | â€” | Canonical URL |
| `article:published_time` | â€” | ISO 8601 date |
| `article:modified_time` | â€” | ISO 8601 date |
| `article:section` | â€” | Category label |
| `article:tag` | â€” | Keywords array |
| `twitter:card` | â€” | `summary_large_image` |
| `twitter:title` | â€” | Same as `<title>` |
| `twitter:description` | â€” | Same as meta description |
| `twitter:image` | â€” | Same as og:image |
| `twitter:site` | â€” | `@lastdonor` |
| `robots` | â€” | `index, follow, max-image-preview:large, max-snippet:-1` |
| `canonical` | â€” | `https://lastdonor.org/blog/{slug}` |

### 6.3 Separate Blog Sitemap

```
File: src/app/blog/sitemap.ts
```

Dedicated `/blog/sitemap.xml` with:

- All published blog posts
- Priority: 0.7 (up from current 0.5)
- Change frequency: weekly for recent posts (< 30 days), monthly for older
- `lastmod` based on `updated_at` (to signal content freshness after updates)
- Image sitemap entries for cover images

### 6.4 RSS Feed

```
File: src/app/blog/feed.xml/route.ts
```

Standard RSS 2.0 feed at `/blog/feed.xml`:

- Enables feed reader discovery and syndication
- Accelerates indexing by search engines
- Provides structured content for LLM training data crawlers
- Auto-discovery via `<link rel="alternate" type="application/rss+xml">` in `<head>`

### 6.5 Core Web Vitals for Blog Pages

| Metric | Target | Implementation |
|---|---|---|
| LCP | < 2.0s | Next.js `Image` with priority for hero, WebP format, CDN |
| INP | < 150ms | Static SSR, minimal client JS on blog pages |
| CLS | < 0.05 | Explicit image dimensions, font preloading, no layout shifts |

Blog pages are server-rendered (RSC) with zero client-side JavaScript beyond Next.js hydration. No popovers, no dropdowns, no interactive elements that could delay INP.

---

## Milestone 7 â€” Admin Blog Editor & Publishing Workflow

### 7.1 Overview

Currently there is NO admin interface for blog posts. This milestone adds:

- Blog post listing in admin with status filters
- AI-generated draft review and editing
- Rich text editing for manual adjustments
- One-click publish / schedule
- SEO score visualization
- Image management

### 7.2 Admin Routes

| Route | Purpose |
|---|---|
| `/admin/blog` | Blog post listing with filters (draft/published/scheduled) |
| `/admin/blog/new` | Manual new post form (or trigger AI generation) |
| `/admin/blog/[id]/edit` | Edit existing post â€” review AI draft, modify, publish |
| `/admin/blog/topics` | View topic queue, trigger generation, adjust priorities |

### 7.3 Admin Blog List Page

```
File: src/app/admin/blog/page.tsx
```

Table columns:
- Title (linked to edit page)
- Category (badge)
- Status (draft / published / scheduled â€” color-coded)
- SEO Score (0â€“100, color gauge)
- Word Count
- Source (manual / AI-generated)
- Published date
- Actions (Edit, Delete, Publish/Unpublish)

Filters:
- Status: All / Draft / Published / Scheduled
- Category: campaign_story / impact_report / news
- Source: All / AI-generated / Manual
- Sort: Newest / Oldest / SEO score

### 7.4 Blog Editor Page

```
File: src/app/admin/blog/[id]/edit/page.tsx
```

Two-pane layout:

**Left pane (editing):**
- Title field (auto-generates slug)
- Category selector
- Rich text editor for body HTML (using existing `ArticleRenderer` for preview)
- Excerpt field
- Author name + bio fields

**Right pane (SEO panel):**
- Meta title (with character count, < 60)
- Meta description (with character count, < 155)
- Primary keyword
- Secondary keywords (tag input)
- SEO Score gauge with breakdown:
  - Keyword in title âœ“/âœ-
  - Keyword in H1 âœ“/âœ-
  - Keyword in first 100 words âœ“/âœ-
  - Keyword in meta description âœ“/âœ-
  - Keyword density (with value)
  - Word count (with target)
  - Internal links count
  - Image alt text check
  - Readability score
- Cover image upload / Kling AI generation trigger
- Publish / Schedule / Save Draft buttons

### 7.5 Topic Queue Page

```
File: src/app/admin/blog/topics/page.tsx
```

Lists topics from `blog_topic_queue` with:
- Topic title
- Primary keyword + volume + difficulty
- Priority score (color bar)
- Source (keyword_bank / trending / seasonal / manual)
- Status (pending / generating / generated / published)
- Actions: Generate Now, Edit, Reject, Boost Priority

"Add Topic" button for manual topic entry.

### 7.6 API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/v1/admin/blog` | GET | List all blog posts (with pagination) |
| `/api/v1/admin/blog` | POST | Create new blog post |
| `/api/v1/admin/blog/[id]` | GET | Get single post for editing |
| `/api/v1/admin/blog/[id]` | PATCH | Update post |
| `/api/v1/admin/blog/[id]` | DELETE | Delete post |
| `/api/v1/admin/blog/[id]/publish` | POST | Publish / schedule post |
| `/api/v1/admin/blog/[id]/generate-images` | POST | Trigger Kling image generation |
| `/api/v1/admin/blog/topics` | GET | List topic queue |
| `/api/v1/admin/blog/topics` | POST | Add manual topic |
| `/api/v1/admin/blog/topics/[id]/generate` | POST | Trigger AI generation for a topic |
| `/api/v1/admin/blog/topics/[id]` | PATCH | Update topic (priority, status) |

All admin routes enforce `requireRole(['admin', 'editor'])`.

---

## Milestone 8 â€” Automated Publishing Pipeline & Cron Orchestration

### 8.1 Pipeline Orchestrator

```
File: src/lib/blog/blog-pipeline.ts
```

The main pipeline function that the cron route calls:

```typescript
async function runBlogPipeline(options: {
  maxPosts?: number;     // Max posts to generate per run (default: 1)
  autoPublish?: boolean; // If true, publish immediately. If false, save as draft.
  dryRun?: boolean;      // If true, score topics but don't generate
}): Promise<PipelineResult>
```

**Pipeline steps:**

```
Step 1: TOPIC SELECTION
  â””â”€ Query blog_topic_queue WHERE status = 'pending' ORDER BY priority_score DESC
  â””â”€ Take top N topics (default 1)
  â””â”€ Update status â†’ 'generating'

Step 2: CONTENT BRIEF
  â””â”€ Generate ContentBrief via AI (search intent, outline, angle)
  â””â”€ Store outline in topic record
  â””â”€ Log to blog_generation_logs (step: 'outline_generated')

Step 3: CONTENT GENERATION
  â””â”€ Generate each section via multi-pass architecture
  â””â”€ Assemble full article HTML
  â””â”€ Run keyword density analysis
  â””â”€ Inject internal links
  â””â”€ Run deduplication check
  â””â”€ Log (step: 'content_generated')

Step 4: IMAGE GENERATION
  â””â”€ Generate hero image via Kling API
  â””â”€ Generate 2-3 section illustrations
  â””â”€ Upload to Supabase Storage
  â””â”€ Inject image tags into HTML with SEO attributes
  â””â”€ Log (step: 'images_generated')

Step 5: QUALITY VALIDATION
  â””â”€ Run SEO score calculation
  â””â”€ Check keyword placement requirements
  â””â”€ Validate HTML structure (H1 count, heading hierarchy)
  â””â”€ Verify word count meets target
  â””â”€ Check readability score
  â””â”€ Log (step: 'validated')

Step 6: SAVE / PUBLISH
  â””â”€ Insert into blog_posts table
  â””â”€ If autoPublish: set published = true, publishedAt = now()
  â””â”€ Else: save as draft for admin review
  â””â”€ Update topic status â†’ 'generated'
  â””â”€ Link post back to topic via generated_post_id
  â””â”€ Log (step: 'published' | 'drafted')
```

### 8.2 Cron Routes

#### Blog Topic Scoring (Daily)

```
Route: /api/cron/blog-topics
Schedule: Daily at 06:00 UTC
Auth: CRON_SECRET header
```

Runs the topic discovery engine:
1. Load keyword bank entries not yet queued
2. Score all candidates
3. Insert top 10 into queue
4. Mark stale candidates

#### Blog Generation (Daily)

```
Route: /api/cron/blog-generate
Schedule: Daily at 08:00 UTC (2 hours after topic scoring)
Auth: CRON_SECRET header
```

Runs the full pipeline:
1. Select the highest-priority pending topic
2. Generate content, images, and metadata
3. Save as draft (default) or auto-publish (configurable via env)
4. Send admin notification: "New blog post draft ready for review"

#### Blog Content Refresh (Weekly)

```
Route: /api/cron/blog-refresh
Schedule: Weekly on Sundays at 10:00 UTC
Auth: CRON_SECRET header
```

Identifies published posts that may need updating:
1. Posts older than 90 days with no `updated_at` change
2. Posts with seasonal keywords that are in-season now but weren't when written
3. Posts where the primary keyword's search landscape may have changed
4. Creates `blog_topic_queue` entries with source `refresh` for admin to decide

### 8.3 Environment Configuration

```env
# Blog pipeline (add to .env)
BLOG_PIPELINE_ENABLED=true
BLOG_AUTO_PUBLISH=false          # true = publish without admin review
BLOG_MAX_POSTS_PER_DAY=1         # Max AI-generated posts per day
BLOG_MIN_PRIORITY_SCORE=50       # Minimum score to trigger generation
BLOG_TARGET_WORD_COUNT=3000      # Default target word count

# Kling AI
KLING_API_KEY=                   # Kling AI API key
KLING_API_URL=https://api.klingai.com/v1  # Kling API endpoint
KLING_IMAGES_PER_POST=3          # Hero + N section images
```

### 8.4 Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/blog-topics",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/blog-generate",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/blog-refresh",
      "schedule": "0 10 * * 0"
    }
  ]
}
```

---

## Milestone 9 â€” Performance Monitoring & Feedback Loop

### 9.1 Overview

The pipeline isn't complete without a feedback mechanism. Posts that perform well should inform future topic selection. Posts that underperform should be flagged for refresh or pruning.

### 9.2 Internal Analytics Tracking

```
File: src/lib/blog/analytics-tracker.ts
```

Track per blog post (stored in a new `blog_post_analytics` table or as JSONB in `blog_posts`):

| Metric | Source | Purpose |
|---|---|---|
| Page views | Internal analytics event | Volume signal |
| Average time on page | Internal analytics event | Engagement signal |
| Bounce rate | Internal analytics event | Quality signal |
| Scroll depth | Internal analytics event | Content length validation |
| CTA click rate | Click events on campaign links | Conversion signal |
| Internal link clicks | Click events | Link graph validation |

### 9.3 Search Console Data Integration (Phase 2)

For a future phase, integrate Google Search Console API to pull:

- Impressions per blog post
- Clicks per blog post
- Average position per keyword
- Click-through rate (CTR)

This data feeds back into the topic scorer:
- Posts ranking positions 5â€“15 â†’ candidates for content refresh
- Keywords with high impressions but low CTR â†’ rewrite title/meta description
- Keywords we rank for unintentionally â†’ create dedicated content

### 9.4 LLM Citation Monitoring (Phase 2)

Track whether our blog content gets cited by AI platforms:

- Periodic queries to Perplexity/ChatGPT asking our target questions
- Check if LastDonor.org appears in the AI-generated responses
- Log citations with timestamp and platform
- Posts cited by AI â†’ boost similar topics in the queue

### 9.5 Content Refresh Queue

The weekly cron (`/api/cron/blog-refresh`) evaluates all published posts and creates a refresh priority list:

| Signal | Weight | Threshold |
|---|---|---|
| Post age | 0.3 | > 90 days = needs review |
| Traffic trend | 0.3 | Declining 3 weeks in a row |
| Keyword seasonality | 0.2 | In-season but not updated |
| E-E-A-T staleness | 0.2 | Statistics > 1 year old |

Refresh actions:
1. **Minor refresh**: Update statistics, add current year to title, refresh examples
2. **Major refresh**: Rewrite sections, add new subtopics, regenerate images
3. **Prune**: If post has < 50 views in 90 days and low keyword potential â†’ unpublish (redirect to related post)

---

## Hat Trick SEO Techniques

### White Hat Techniques (Core Strategy)

These are legitimate, Google-approved practices that form our foundation:

| Technique | Implementation |
|---|---|
| **Long-tail keyword targeting** | Every post targets KD 0â€“20 keywords from Doc 12 |
| **Content clustering** | Blog posts link to each other within the same cause category, creating topic clusters around "disaster relief," "medical fundraising," etc. |
| **Internal link optimization** | Automated link graph ensures every new post gets 3+ contextual internal links and provides links to existing content |
| **Featured snippet optimization** | Direct answer pattern at section starts, formatted for paragraph/list/table snippets |
| **E-E-A-T signals** | Author bios, editorial standards page, .gov/.edu citations, 501(c)(3) status |
| **Content freshness** | Automated refresh cycle, year in titles for time-sensitive content |
| **Mobile-first design** | Blog renders perfectly on mobile (already handled by Tailwind responsive design) |
| **Core Web Vitals** | SSR, optimized images, no CLS, fast LCP |
| **Semantic HTML** | Proper heading hierarchy, `<article>`, `<section>`, `<nav>` elements |
| **Schema markup** | Article, FAQ, BreadcrumbList, Organization, Speakable |

### Gray Hat Techniques (Careful Implementation)

These are aggressive-but-common tactics used by most competing sites. Implemented carefully, they provide an edge without crossing into penalty territory:

| Technique | How We Use It | Risk Mitigation |
|---|---|---|
| **Programmatic SEO** | Auto-generate location-specific landing pages from campaign data (e.g., `/help/tulsa-tornado-relief`, `/help/miami-hurricane`) â€” each with unique content from the campaign story | Each page has genuinely unique content (the campaign story), not just templated text with swapped city names |
| **Keyword clustering in related posts** | The "Related Posts" section at the bottom of each blog post targets secondary keywords via anchor text | Links are genuinely relevant, not keyword-stuffed |
| **Content velocity** | Publishing 3â€“5 AI-generated posts per week (competitors publish manually, 1â€“2/month) | Every post passes quality gate â€” volume without quality will NOT be published |
| **Strategic 301 redirects** | Pruned low-performing posts redirect to the best-performing post on the same topic | Only redirect genuinely similar content |
| **Link magnets** | Create downloadable resources (PDFs, checklists) that other sites naturally link to â€” e.g., "House Fire Recovery Checklist" | Resources are genuinely useful, not link-bait |
| **FAQ section expansion** | Every post includes 5â€“8 FAQ entries targeting long-tail questions | FAQs genuinely answer real questions (sourced from PAA data) |

### What We Do NOT Do (Black Hat â€” Avoided)

| Technique | Why We Avoid It |
|---|---|
| Link buying/PBNs | Google penalty risk, not sustainable, violates guidelines |
| Keyword stuffing | Hurts readability, detected by algorithms, penalized |
| Cloaking | Serving different content to bots vs users â€” instant penalty |
| Hidden text/links | Detected and penalized |
| Doorway pages | Thin pages made only for ranking â€” penalized |
| Article spinning | Low quality, detected by Google's AI, penalizes domain |
| Comment spam | Nofollow links, reputation damage, zero SEO value |
| Fake reviews/testimonials | E-E-A-T violation, legal risk, ethical violation |

---

## Content Quality Guardrails

### 13.1 Automated Quality Gate

Every AI-generated post must pass ALL of these checks before publication:

| Check | Threshold | Action on Failure |
|---|---|---|
| Word count | â‰¥ 80% of target | Regenerate short sections |
| Primary keyword in title | Required | Rewrite title |
| Primary keyword in first 100 words | Required | Rewrite intro |
| Primary keyword density | 1.0â€“2.0% | Adjust (add or remove mentions) |
| Unique content (vs existing posts) | < 70% similarity | Reject topic, mark stale |
| Heading hierarchy valid | H1 â†’ H2 â†’ H3 (no skips) | Fix automatically |
| No AI filler phrases | 0 matches | Remove matched phrases |
| Internal links | â‰¥ 3 | Inject from link graph |
| External authority links | â‰¥ 2 | Add relevant .gov/.edu/.org sources |
| Image alt text | All images have alt | Generate alt text |
| Meta title length | < 60 characters | Truncate or rewrite |
| Meta description length | < 155 characters | Truncate or rewrite |
| HTML sanitization | Passes sanitizeHtml() | Strip disallowed tags |
| No broken internal links | All link targets exist | Remove or fix |
| Readability (Flesch) | 55â€“75 | Flag for manual review |
| SEO score | â‰¥ 70/100 | Flag for manual review |

### 13.2 AI Content Fingerprint Detection

To avoid Google's "helpful content" classifier flagging our content:

1. **Information gain**: Every post must include at least 1 unique data point, statistic, or insight not easily found on competitors (our campaign data provides this naturally)
2. **First-person experience signals**: Reference LastDonor.org's experience ("In the 247 disaster relief campaigns we've funded...")
3. **Practical specificity**: Include specific dollar amounts, timelines, steps â€” not generic advice
4. **Anti-pattern detection**: Scan for and remove AI-telltale phrases:

```typescript
const AI_FILLER_PHRASES = [
  'in today\'s world',
  'it\'s worth noting',
  'it\'s important to note',
  'in this article, we will',
  'let\'s dive in',
  'without further ado',
  'at the end of the day',
  'navigate the complex landscape',
  'leverage',
  'paradigm',
  'holistic approach',
  'game-changer',
  'unlock the power',
  'empower',
  'synergy',
  'cutting-edge',
  'state-of-the-art',
  'revolutionary',
  'delve into',
  'tapestry',
  'multifaceted',
  'in conclusion',
  'as we discussed',
  'it goes without saying',
  'needless to say',
];
```

### 13.3 Editorial Policy Compliance

Per Doc 04 (Content Strategy):

- AI-generated content is always labeled `source: 'ai_generated'` in the database
- AI-generated content is NOT attributed to a human author â€” uses "LastDonor Editorial Team"
- Every claim backed by a verifiable source (linked)
- No exploitation of suffering â€” empathetic tone, focus on solutions and hope
- No medical, legal, or financial advice â€” always defer to professionals
- Campaign mentions are contextual, never misleading about current status

---

## Cost Projections

### 14.1 AI Content Generation Costs

| Component | Model | Tokens per Post | Cost per Post | Posts/Month | Monthly Cost |
|---|---|---|---|---|---|
| Content brief | GPT-4o-mini | ~2,000 | $0.003 | 16 | $0.05 |
| Section generation (Ã-8 sections) | GPT-4o-mini | ~12,000 | $0.018 | 16 | $0.29 |
| Cohesion pass | GPT-4o-mini | ~6,000 | $0.009 | 16 | $0.14 |
| SEO hardening pass | GPT-4o-mini | ~4,000 | $0.006 | 16 | $0.10 |
| Image prompts | GPT-4o-mini | ~1,000 | $0.002 | 16 | $0.03 |
| **AI subtotal** | | ~25,000 | **~$0.038** | | **$0.61** |

### 14.2 Image Generation Costs

| Component | Per Image | Images/Post | Posts/Month | Monthly Cost |
|---|---|---|---|---|
| Kling hero image | $0.08 | 1 | 16 | $1.28 |
| Kling section images | $0.08 | 2 | 16 | $2.56 |
| **Image subtotal** | | | | **$3.84** |

### 14.3 Total Monthly Cost

| Category | Monthly Cost |
|---|---|
| AI content generation | $0.61 |
| Image generation (Kling) | $3.84 |
| Supabase Storage (images) | ~$0.10 |
| **Total** | **~$4.55/month** |

For 16 published blog posts per month (4/week), the total cost is under $5/month. This is extremely cost-effective compared to:
- Freelance writer: $100â€“500 per post = $1,600â€“8,000/month
- Content agency: $300â€“2,000 per post = $4,800â€“32,000/month

---

## File Manifest

### New Files to Create

```
src/lib/blog/
â”œâ”€â”€ keyword-bank.ts            # M1: 350+ keywords from Doc 12
â”œâ”€â”€ seasonal-calendar.ts       # M1: Monthly cause-category boosts
â”œâ”€â”€ topic-scorer.ts            # M1: Weighted multi-signal scoring
â”œâ”€â”€ topic-discovery.ts         # M1: Orchestrator for topic queue
â”œâ”€â”€ serp-analyzer.ts           # M2: Search intent classification
â”œâ”€â”€ link-graph.ts              # M2: Internal link opportunity mapping
â”œâ”€â”€ content-brief.ts           # M2: Brief data structures
â”œâ”€â”€ article-assembler.ts       # M3: Multi-pass content assembly
â”œâ”€â”€ keyword-analyzer.ts        # M3: Density + placement validation
â”œâ”€â”€ content-dedup.ts           # M3: TF-IDF similarity check
â”œâ”€â”€ geo-optimizer.ts           # M4: LLM/GEO optimization passes
â”œâ”€â”€ image-generator.ts         # M5: Kling API integration
â”œâ”€â”€ image-optimizer.ts         # M5: Resize, compress, upload
â”œâ”€â”€ seo-scorer.ts              # M6: Calculate SEO score (0-100)
â”œâ”€â”€ blog-pipeline.ts           # M8: Main orchestrator
â”œâ”€â”€ analytics-tracker.ts       # M9: Internal analytics
â””â”€â”€ content-refresh.ts         # M9: Refresh queue logic

src/lib/ai/prompts/
â”œâ”€â”€ generate-blog-brief.ts     # M2: Content brief prompt
â”œâ”€â”€ generate-blog-section.ts   # M3: Section writing prompt
â”œâ”€â”€ generate-blog-cohesion.ts  # M3: Cohesion/flow pass prompt
â”œâ”€â”€ generate-blog-seo.ts       # M3: SEO hardening pass prompt
â”œâ”€â”€ generate-blog-images.ts    # M5: Kling image prompt templates
â”œâ”€â”€ generate-blog-faq.ts       # M4: FAQ generation prompt
â””â”€â”€ generate-blog-refresh.ts   # M9: Content refresh prompt

src/app/api/cron/
â”œâ”€â”€ blog-topics/route.ts       # M1: Daily topic scoring cron
â”œâ”€â”€ blog-generate/route.ts     # M8: Daily content generation cron
â””â”€â”€ blog-refresh/route.ts      # M9: Weekly content refresh cron

src/app/api/v1/admin/blog/
â”œâ”€â”€ route.ts                   # M7: List + create blog posts
â”œâ”€â”€ [id]/route.ts              # M7: Get + update + delete post
â”œâ”€â”€ [id]/publish/route.ts      # M7: Publish / schedule
â”œâ”€â”€ [id]/generate-images/route.ts # M7: Trigger image generation
â”œâ”€â”€ topics/route.ts            # M7: List + create topics
â””â”€â”€ topics/[id]/route.ts       # M7: Update topic + trigger generation

src/app/admin/blog/
â”œâ”€â”€ page.tsx                   # M7: Blog post listing
â”œâ”€â”€ new/page.tsx               # M7: New post form
â”œâ”€â”€ [id]/edit/page.tsx         # M7: Edit post page
â””â”€â”€ topics/page.tsx            # M7: Topic queue management

src/app/blog/
â”œâ”€â”€ sitemap.ts                 # M6: Dedicated blog sitemap
â””â”€â”€ feed.xml/route.ts          # M6: RSS feed

src/db/
â””â”€â”€ migrations/0018_blog_pipeline.sql  # M1: Schema changes
```

### Files to Modify

```
src/db/schema.ts               # Add new tables + columns
src/types/index.ts             # Add blog pipeline types
src/app/blog/[slug]/page.tsx   # M6: Enhanced meta, schema, Twitter cards
src/app/blog/page.tsx          # M6: Updated meta tags
src/app/sitemap.ts             # M6: Reference blog sitemap
src/app/layout.tsx             # M6: RSS auto-discovery link
src/components/admin/AdminSidebar.tsx  # M7: Add Blog section
vercel.json                    # M8: Add cron schedules
```

### Implementation Order

| Phase | Milestones | Estimated Tasks |
|---|---|---|
| **Phase 1: Foundation** | M1 (Topics) + M6 (Schema/SEO) | Schema migration, keyword bank, topic scorer, enhanced meta tags |
| **Phase 2: Generation** | M2 (Brief) + M3 (Content) + M4 (GEO) | AI prompts, article assembler, quality gate, LLM optimization |
| **Phase 3: Images** | M5 (Kling) | Kling integration, prompt engineering, image pipeline |
| **Phase 4: Admin UI** | M7 (Editor) | Admin pages, API routes, publishing workflow |
| **Phase 5: Automation** | M8 (Cron) | Pipeline orchestrator, cron routes, Vercel config |
| **Phase 6: Monitoring** | M9 (Analytics) | Performance tracking, refresh queue, feedback loop |

---

*End of Document*
