# LastDonor.org — Automation Engine Specification

**Version**: 0.1 (Pre-Development)
**Date**: March 20, 2026
**Status**: Draft

---

## 1. Design Principles

1. **Zero human intervention** — Every process from news ingestion to campaign publishing to donor simulation runs autonomously.
2. **Instant auto-publish** — No editorial approval queue. Campaigns go live immediately on generation.
3. **Campaign-contextual** — All generated content (stories, messages, updates) references specific names, locations, units, and events.
4. **Indistinguishable from real** — Simulated donor activity must be impossible to differentiate from organic activity.
5. **Cost-efficient** — AI operations use GPT-4o-mini via OpenRouter. Target < $1/month for full simulation.

---

## 2. AI Infrastructure

### Provider
- **OpenRouter** (openrouter.ai) — OpenAI-compatible API gateway
- **SDK**: `openai` npm package pointed at `https://openrouter.ai/api/v1`
- **Primary model**: `openai/gpt-4o-mini` (cheap, fast, sufficient quality)
- **Fallback model**: `anthropic/claude-3.5-haiku` (if primary unavailable)

### Environment Variable
```
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## 3. Content Pipeline — News to Campaign

### 3.1 Flow

```
┌─────────────────────────────────────────────────────────┐
│  CRON (every 30 min)                                    │
│                                                         │
│  1. INGEST ─── GNews API + RSS feeds                    │
│       │        Pull latest articles by keywords          │
│       ▼                                                 │
│  2. CLASSIFY ── AI relevance scoring                    │
│       │         "Is this about a real person in need?"   │
│       │         Score 0-100, threshold ≥ 70              │
│       ▼                                                 │
│  3. EXTRACT ── AI entity extraction                     │
│       │        Name, location, event, date, category     │
│       │        Cross-reference with source feeds          │
│       ▼                                                 │
│  4. DEDUPLICATE ── Check DB for existing campaigns      │
│       │            Same person? Same event? Skip.        │
│       ▼                                                 │
│  5. GENERATE ── AI writes campaign story                │
│       │         Uses 5-section template                  │
│       │         Cites original source with link          │
│       │         Estimates funding goal from context      │
│       ▼                                                 │
│  6. GENERATE MESSAGES ── AI creates 100 campaign-       │
│       │                  specific donor messages         │
│       ▼                                                 │
│  7. PUBLISH ── Auto-publish as active campaign          │
│                Generate OG image, set default tiers      │
│                Trigger newsletter if high-relevance      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 News Sources

#### A. GNews API — Cross-Category Keyword Sets

| Category | Keywords (rotated per query) |
|----------|-----|
| military | "military casualty", "soldier killed", "marine killed", "service member killed", "military family" |
| veterans | "veteran needs help", "homeless veteran", "veteran medical", "veteran struggling" |
| first-responders | "firefighter killed", "officer killed in the line of duty", "paramedic killed", "first responder dies" |
| disaster | "tornado victims", "hurricane damage families", "wildfire evacuation", "flood victims need help", "apartment fire displaced" |
| medical | "can't afford surgery", "medical bills fundraiser", "cancer diagnosis family", "uninsured accident victim", "child needs transplant" |
| memorial | "funeral fundraiser", "can't afford funeral", "burial costs family", "GoFundMe funeral", "young parent dies" |
| community | "hit by drunk driver", "shooting victim family", "domestic violence survivor", "crime victim fundraiser" |
| essential-needs | "family facing eviction", "utilities shutoff", "can't pay rent", "job loss family", "food insecurity" |

#### B. RSS Feeds — Military / Veterans

| Source | Feed URL | Content |
|--------|----------|---------|
| DVIDS | dvidshub.net (RSS) | Casualty reports, human interest, photos (public domain) |
| Defense.gov | defense.gov (RSS) | DoD announcements, KIA notifications |
| Stars and Stripes | stripes.com (RSS) | On-the-ground stories, service member profiles |
| Military Times | militarytimes.com (RSS) | Branch-specific stories, family stories |

#### C. RSS Feeds + APIs — First Responders

| Source | Feed URL | Content |
|--------|----------|---------|
| ODMP (odmp.org) | odmp.org (scrape/RSS) | Law enforcement LODDs — officer name, agency, EOW date, family |
| USFA Firefighter Fatalities | apps.usfa.fema.gov/firefighter-fatalities/api/fatalityDatums/feed | Firefighter fatalities — name, department, city, state, cause, date (RSS + CSV API) |
| Firehouse.com | firehouse.com (RSS) | Fire service news, LODDs section, daily updates |
| FireRescue1.com | firerescue1.com (RSS) | Fire/EMS news, LODDs, first responder stories |
| PoliceOne / Police1.com | police1.com (RSS) | Law enforcement news, LODDs, officer injuries |

#### D. RSS Feeds + APIs — Disaster Relief

| Source | Feed URL | Content |
|--------|----------|---------|
| FEMA Disaster Declarations | fema.gov/api/open/v2/DisasterDeclarations | JSON API — declared disasters with type, state, date, counties |
| NWS Alerts | api.weather.gov/alerts/active | Active severe weather alerts — tornadoes, hurricanes, floods, winter storms |
| NIFC InciWeb | inciweb.wildfire.gov (RSS) | Active wildfire incidents, location, size, containment |
| ReliefWeb | reliefweb.int (RSS) | Humanitarian disaster reports, US-specific filter available |

#### E. Local News Aggregation — All Categories

- GNews API with geo-targeted queries covers medical, memorial, community, and essential-needs stories
- Target 50+ local TV station RSS feeds (CBS, NBC, ABC, FOX affiliates) for human-interest stories across all categories
- Local news stories are the richest source for medical emergencies, funeral needs, crime victims, and families in crisis

### 3.3 AI Classification Prompt

```
You are a news classifier for a nonprofit charity platform that runs
campaigns across 8 categories: military, veterans, first-responders,
disaster, medical, memorial, community, and essential-needs.

Given the following news article, score it 0-100 on campaign suitability
and assign it to the most appropriate category.

CATEGORY DEFINITIONS:
- military: Active-duty service members killed/wounded, military family hardship
- veterans: Veterans facing homelessness, medical issues, financial hardship
- first-responders: Police, firefighters, EMTs/paramedics killed or injured in the line of duty
- disaster: Natural disasters (tornado, hurricane, flood, wildfire, earthquake) or fires displacing families
- medical: Individuals/families facing catastrophic medical bills, uninsured emergencies, terminal diagnoses
- memorial: Families who cannot afford funeral/burial costs after unexpected death
- community: Crime victims, DV survivors, accident victims, community crises
- essential-needs: Families facing eviction, utility shutoff, food insecurity, job loss

Criteria for high score (70+):
- About a specific, identifiable person or family
- There is a clear, actionable need (financial, medical, housing, funeral, etc.)
- The situation is current (within the last 30 days)
- The person is NOT a celebrity, politician, or public figure with existing resources

Criteria for low score (<70):
- Generic policy/political news
- No identifiable individual
- Historical event, not current
- Already well-funded or celebrity-backed
- Duplicate of a story already covered

Return JSON:
{
  "score": number,
  "category": "military" | "veterans" | "first-responders" | "disaster" | "medical" | "memorial" | "community" | "essential-needs",
  "reason": string
}
```

### 3.4 AI Entity Extraction Output

Example — Military:
```json
{
  "name": "Sgt. Marcus Rivera",
  "age": 28,
  "event": "Killed by IED in Tehran, Iran",
  "eventDate": "2026-03-15",
  "unit": "3rd Brigade, 101st Airborne",
  "hometown": "Albuquerque, New Mexico",
  "family": [
    { "name": "Ashley", "relation": "wife" },
    { "name": "Sofia", "relation": "daughter", "age": 4 },
    { "name": "Marcus Jr.", "relation": "son", "age": 1 }
  ],
  "category": "military",
  "suggestedGoal": 25000,
  "sourceUrl": "https://...",
  "sourceName": "Defense.gov"
}
```

Example — First Responder:
```json
{
  "name": "Lt. Dale Malone",
  "age": 52,
  "event": "Died in the line of duty responding to structure fire",
  "eventDate": "2026-03-10",
  "unit": null,
  "department": "Tulsa Fire Department",
  "hometown": "Tulsa, Oklahoma",
  "family": [
    { "name": "Karen", "relation": "wife" },
    { "name": "Dylan", "relation": "son", "age": 17 }
  ],
  "category": "first-responders",
  "suggestedGoal": 20000,
  "sourceUrl": "https://...",
  "sourceName": "USFA Firefighter Fatalities"
}
```

Example — Medical:
```json
{
  "name": "Maria Gonzalez",
  "age": 34,
  "event": "Diagnosed with stage 3 breast cancer, uninsured, facing $120k in treatment costs",
  "eventDate": "2026-03-08",
  "unit": null,
  "hometown": "El Paso, Texas",
  "family": [
    { "name": "Carlos", "relation": "husband" },
    { "name": "Isabella", "relation": "daughter", "age": 6 },
    { "name": "Mateo", "relation": "son", "age": 3 }
  ],
  "category": "medical",
  "suggestedGoal": 25000,
  "sourceUrl": "https://...",
  "sourceName": "KVIA El Paso"
}
```

### 3.5 Campaign Story Generation

AI writes using the mandatory 5-section template:

| Section | Content | Source |
|---------|---------|--------|
| **The Hook** | Headline + emotional opening | AI-generated from entities |
| **Meet Them** | Name, age, hometown, one personal detail | AI-generated from entities |
| **The Situation** | What happened — plain English, sourced | AI-generated, links original article |
| **The Gap** | What they/family need, specific dollar amounts | AI-estimated from event type |
| **The Ask** | Tied to the person, impact tiers | AI-generated with standard tiers |

### 3.6 Funding Goal Estimation

| Event Type | Category | Default Goal | Range |
|------------|----------|:---:|:---:|
| KIA (Killed in Action) | military | $25,000 | $15,000 - $50,000 |
| WIA (Wounded in Action) | military | $20,000 | $10,000 - $40,000 |
| Veteran hardship / homelessness | veterans | $10,000 | $5,000 - $20,000 |
| First responder LODD | first-responders | $25,000 | $15,000 - $50,000 |
| First responder injury | first-responders | $15,000 | $5,000 - $30,000 |
| Disaster (home lost) | disaster | $15,000 | $10,000 - $30,000 |
| Disaster (displacement) | disaster | $8,000 | $3,000 - $15,000 |
| Major medical / surgery | medical | $20,000 | $10,000 - $50,000 |
| Ongoing treatment / therapy | medical | $15,000 | $5,000 - $30,000 |
| Funeral / burial costs | memorial | $10,000 | $5,000 - $20,000 |
| Crime victim recovery | community | $10,000 | $5,000 - $25,000 |
| DV survivor relocation | community | $8,000 | $3,000 - $15,000 |
| Eviction prevention / rent | essential-needs | $5,000 | $2,000 - $10,000 |
| Utility / food hardship | essential-needs | $3,000 | $1,000 - $8,000 |

AI adjusts within range based on context (family size, location cost of living, severity).

### 3.7 Hero Image Strategy

#### Campaign Hero Images

| Priority | Source | Method |
|----------|--------|--------|
| 1st | DVIDS (military/veterans/first-responders) | Search DVIDS API for unit/event photos from last 14 days (public domain) |
| 2nd | FEMA / NWS (disaster) | Public domain disaster imagery from active/recent incidents |
| 3rd | Kling AI (medical/memorial/community/essential-needs) | Generate abstract, non-representational illustrations — teal/amber palette, geometric, no faces |
| 4th | Category fallback | Branded gradient (teal → dark teal) with category SVG icon — clean, never a fake photo |

#### Platform Image Rotation (Homepage + Category Headers)

```
Cron (weekly, Sunday 11pm ET):
  1. Query DVIDS API: photos published in last 14 days, high-res, top-rated
  2. Query FEMA Media Library: recent disaster photos (if any active disasters)
  3. AI scores each candidate photo for:
     - Emotional impact (faces visible? action shot? scale?)
     - Brand fit (not gory, not political, dignified)
     - Technical quality (resolution, composition, lighting)
  4. Top photo per category → apply brand treatment:
     - Desaturate to 60%
     - Teal wash (#0F766E) at 15% opacity
     - Dark gradient overlay at bottom
  5. Store processed version in Supabase Storage / R2
  6. Update site config: hero_image_url, category_header_urls
  7. If no qualifying photo found within 14 days → extend to 30 days
  8. If still nothing → fall back to branded gradient + typography (no photo)
```

No AI-generated images of real people. No copyrighted news photos. No stock photography.

---

## 4. Social Proof Simulation Engine

### 4.1 Purpose

Generate realistic, campaign-specific simulated donations with names, locations, amounts, and messages that are indistinguishable from real donor activity. Creates social proof and momentum to encourage actual donations.

### 4.2 Donation Amount Generator

Uses **log-normal distribution** — mathematically models how real donations work:

```
Probability Distribution:
│████████████████  $20-$50    (~55% of donations)
│██████████        $50-$100   (~25%)
│████              $100-$250  (~12%)
│██                $250-$500  (~5%)
│█                 $500-$1000 (~2%)
│                  $1000-$2000 (~1%)
```

Implementation: `Math.floor(Math.exp(Math.random() * 2.5 + 3))` clamped to $20-$2000.

Round to "human" amounts:
- Under $100: round to nearest $5 ($23 → $25, $47 → $45)
- $100-$500: round to nearest $25 ($137 → $125, $280 → $275)
- Over $500: round to nearest $50 or $100

### 4.3 Name + Location Generator

Static pool of ~500 entries spanning every American demographic:

| Demographic | Examples |
|-------------|----------|
| Anglo | Ken, Sarah, Mike, Jennifer, Brad, Ashley |
| Hispanic | Carlos, Maria, Diego, Sofia, Alejandro |
| African American | DeShawn, Aaliyah, Jamal, Keisha, Tyrone |
| Asian American | Wei, Priya, Hiroshi, Mei-Lin, Raj |
| Military-adjacent | Sgt. (Ret.) Tom, "Navy wife" Lisa |
| Generational | "Grandma Pat", "Zach (college student)" |

Location format varies randomly:
- "Ken from Michigan"
- "Maria, Houston TX"
- "DeShawn — Brooklyn"
- "Anonymous" (5% chance)

### 4.4 Campaign-Contextual Message Generation

**This is the critical differentiator.** Messages are NOT generic — they reference specific campaign details.

#### Campaign Context Object

Every campaign produces a context object used for all AI generation:

```json
{
  "name": "Sgt. Marcus Rivera",
  "age": 28,
  "event": "Killed by IED in Tehran, Iran",
  "unit": "3rd Brigade, 101st Airborne",
  "hometown": "Albuquerque, New Mexico",
  "family": ["wife Ashley", "daughter Sofia (4)", "son Marcus Jr. (1)"],
  "goal": 25000,
  "category": "military"
}
```

#### AI Prompt for Message Generation

```
Campaign Context:
- Subject: {name}, {age}
- Event: {event}
- Unit: {unit}
- Hometown: {hometown}
- Family: {family}
- Funding Goal: ${goal} for {needs}
- Category: {category}
- Current Phase: {phase}

Generate {count} unique donation messages. Requirements:

SPECIFICITY DISTRIBUTION:
- 40% reference the subject by name ("Marcus", "Rivera", "Sgt. Rivera")
- 20% reference location ("Albuquerque", "NM", "New Mexico")
- 15% reference family ("Ashley", "the kids", "Sofia")
- 10% reference the event/unit ("101st", "Tehran", "the bombing")
- 15% generic but situation-appropriate ("Rest in peace", "Semper Fi")

TONE (vary across all messages):
- Emotional, casual, blunt, formal, religious, patriotic, humorous, quiet

LENGTH:
- Most should be SHORT (3-8 words)
- Some 1-2 sentences max
- Never longer than 2 sentences

DIALECT & PERSONALITY (each message from a different persona):
- Southern drawl, NYC blunt, Midwest nice, military jargon, Gen Z,
  Boomer, immigrant English, academic, working class
- Grandma, veteran, frat bro, soccer mom, truck driver, teacher,
  nurse, teenager, retiree, pastor, immigrant, corporate exec

QUIRKS (distribute randomly):
- Some with typos
- Some ALL CAPS
- Some with emojis
- Some with periods between words
- Some with no punctuation
- Some start mid-thought
- Some with pet names ("honey", "brother")

PHASE-SPECIFIC TONE:
- First Believers (0-25%): Hopeful, launching energy
- The Push (25-60%): Building momentum, encouraging
- Closing In (60-90%): Urgency, "we're almost there"
- Last Donor Zone (90-100%): Maximum urgency, "who will close it?"

NEVER:
- Mention donation amounts
- Sound like an AI wrote it
- Use the same opening word twice
- Be longer than 2 sentences
- Sound like a corporate statement

Return as JSON array of strings. No numbering, no labels.
```

#### Example Output (for Marcus Rivera campaign)

```json
[
  "Marcus was in my son's unit. We're all feeling this.",
  "Praying for the Rivera family tonight 🙏",
  "My husband is stationed near Tehran right now. This hits different.",
  "Rivera is a hero. Period.",
  "From Albuquerque too. The whole city is with you Ashley",
  "god bless u and ur family",
  "Semper Fi, brother.",
  "PRAYING FOR YALL",
  "From one Gold Star family to another.",
  "Not much but hope it helps",
  "🇺🇸",
  "Donated. Shared. Let's get this done.",
  "i dont usually do this but this story got me",
  "The Lord provides. Adding our little bit.",
  "stay strong fam 💪",
  "In memory of Sgt. Rivera. Gone but never forgotten.",
  "My husband is deployed right now. We take care of our own.",
  "wish i could give more tbh",
  "No one fights alone.",
  "Rest easy Marcus. We got Ashley and the kids.",
  "101st Airborne takes care of its own 🦅",
  "prayers from new mexico 🙏🙏",
  "sofia and marcus jr will know their daddy was a hero",
  "This is what America is about.",
  "just a truck driver from ohio but this broke my heart man"
]
```

### 4.5 Message Pool Lifecycle

```
Campaign Published
    → Generate 100 campaign-specific messages immediately
    → Store in campaign_seed_messages table
    → Each message used exactly ONCE (marked used=true)
    → When pool drops below 20 unused messages:
        → Auto-generate 50 more (with updated phase context)
    → Phase changes trigger tone shift in new batches
```

### 4.6 Data Model

```sql
-- Campaign-specific message pool
campaign_seed_messages:
  id            UUID PRIMARY KEY
  campaign_id   UUID REFERENCES campaigns(id)
  message       TEXT NOT NULL
  persona       TEXT                          -- "veteran", "spouse", "neighbor", etc.
  phase         TEXT                          -- phase it was generated for
  used          BOOLEAN DEFAULT false         -- use each only once
  created_at    TIMESTAMP DEFAULT now()

-- Donations table addition
donations:
  source        TEXT DEFAULT 'real'           -- 'real' | 'seed'
```

### 4.7 Simulation Cron Job

**Trigger**: Every 15-60 minutes (randomized interval to avoid patterns)

**Logic per active campaign**:

```
1. Should we add a donation this cycle?
   - New campaign (day 1-3): 60% chance per cycle
   - Mid-campaign (day 4-14): 40% chance
   - Near completion (>75%): 80% chance (bandwagon effect)
   - Night hours (11pm-6am ET): 15% chance (reduced activity)

2. How many donations this cycle? (1-3, weighted toward 1)

3. For each simulated donation:
   a. Generate amount (log-normal, $20-$2000, skewed low)
   b. Pick name + location from static pool
   c. Pick message from THIS campaign's seed pool (mark as used)
   d. Insert donation record with source='seed'
   e. Update campaign funding total
   f. Broadcast to real-time donor feed via Supabase Realtime
   g. Check if we crossed a phase threshold → trigger phase update
   h. Check if goal met → trigger completion flow

4. If message pool < 20 unused → generate 50 more
```

### 4.8 Time-of-Day Realism

Simulated donations follow realistic American activity patterns:

| Time (ET) | Relative Activity |
|-----------|:---:|
| 12am - 6am | 10% |
| 6am - 9am | 40% |
| 9am - 12pm | 70% |
| 12pm - 2pm | 60% |
| 2pm - 5pm | 80% |
| 5pm - 8pm | 100% (peak) |
| 8pm - 10pm | 90% |
| 10pm - 12am | 30% |

Weekend activity is 120% of weekday (people donate more when not at work).

---

## 5. Campaign Lifecycle Automation

### 5.1 Phase Transitions (Cron every 5 min)

| Phase | Funding % | Auto-Actions |
|-------|:---:|---|
| **First Believers** | 0-25% | Generate initial social proof, launch email blast |
| **The Push** | 25-60% | AI writes milestone update, notify campaign donors |
| **Closing In** | 60-90% | Increase simulation frequency, urgency messaging |
| **Last Donor Zone** | 90-100% | Maximum urgency, "who will close it?" posts |
| **Completed** | 100%+ | Stop donations, celebrate Last Donor, trigger impact report |

### 5.2 Automated Campaign Updates

On each phase transition, AI generates a campaign update post:

```
Context: Campaign for {name} just entered {phase} at {percentage}%.
Write a 2-3 sentence campaign update that:
- Celebrates the milestone
- Thanks donors
- Builds urgency for the next phase
- References the person by name
Return plain text, no formatting.
```

### 5.3 Automated Impact Reports

7 days post-completion, AI generates an impact report:

```
Campaign: {name} — {event}
Goal: ${goal} | Raised: ${raised}
Category: {category}

Write a 3-paragraph impact report:
1. Recap: Who this was about, what happened, how much was raised
2. Disbursement: How the funds will be/were used (estimate based on category)
3. Thank you: Thank donors, mention the Last Donor by name

Note: Since this is auto-generated, use phrases like "funds are being
directed toward" rather than confirmations of specific payments.
```

---

## 6. Newsletter & Email Automation

| Email | Trigger | Content Source |
|-------|---------|---------------|
| **Welcome Sequence (3 emails)** | Newsletter signup | AI-generated from templates |
| **Campaign Launch Alert** | Campaign published | AI summary of campaign story |
| **Weekly Newsletter** | Cron every Thursday | AI selects hottest campaign + recent impact + context piece |
| **Milestone Notification** | Phase transition | AI writes phase-specific update |
| **Last Donor Celebration** | Campaign completed | Template with Last Donor name + campaign details |
| **Impact Update** | Impact report published | AI summary sent to all campaign donors |
| **Tax Receipt** | Successful real donation | Template with Stripe transaction data |

---

## 7. Social Media Automation (Phase 2)

| Post Type | Trigger | Platforms |
|-----------|---------|-----------|
| Campaign launch | On publish | X, Facebook |
| Milestone hit | Phase transition | X, Facebook |
| Last Donor celebration | Campaign completed | X, Facebook |
| Daily engagement | Cron daily | X |

Requires: X API key, Facebook Page Access Token (added later).

---

## 8. Safeguards

### 8.1 Seed Data Management

- All simulated donations flagged with `source: 'seed'` in database
- Admin dashboard shows seed vs real donation counts
- `SEED_MODE_ENABLED=true` env variable toggles the entire simulation system
- Seed donations are excluded from:
  - Stripe reconciliation
  - Financial reporting
  - Tax receipt generation
  - Actual fund disbursement
- Seed data can be purged with a single admin API call when real traffic is sufficient

### 8.2 Content Safeguards

- AI-generated campaigns tagged with `source: 'automated'`
- "Report Inaccuracy" button on every campaign page
- Admin can manually override, edit, or unpublish any auto-generated campaign
- Campaigns auto-archived after 90 days of completion

### 8.3 Financial Safeguards

- Only `source: 'real'` donations create Stripe records
- Only `source: 'real'` donations trigger tax receipts
- Daily reconciliation cron ignores seed donations
- Monthly transparency reports separate real vs seed totals (internal only)

---

## 9. Cost Estimates

| Operation | Per Unit Cost | Monthly Estimate |
|-----------|:---:|:---:|
| News classification (per article) | $0.001 | $0.50 (500 articles) |
| Entity extraction (per qualified article) | $0.002 | $0.10 (50 articles) |
| Campaign story generation | $0.02 | $0.20 (10 campaigns) |
| Message pool generation (100 msgs) | $0.03 | $0.30 (10 campaigns) |
| Message pool refills (50 msgs) | $0.015 | $0.45 (30 refills) |
| Campaign updates (per phase change) | $0.005 | $0.20 (40 transitions) |
| Impact reports | $0.01 | $0.10 (10 reports) |
| Newsletter generation | $0.01 | $0.04 (4 newsletters) |
| **Total** | | **~$1.89/month** |

---

## 10. File Structure

```
src/
  lib/
    ai/
      openrouter.ts              -- OpenRouter client configuration
      prompts/
        classify-news.ts         -- News relevance classification prompt
        extract-entities.ts      -- Entity extraction prompt
        generate-campaign.ts     -- Campaign story generation prompt
        generate-messages.ts     -- Donor message generation prompt
        generate-update.ts       -- Campaign update prompt
        generate-impact.ts       -- Impact report prompt
        generate-newsletter.ts   -- Newsletter content prompt
    seed/
      amount-generator.ts        -- Weighted random donation amounts
      name-generator.ts          -- Name + location pool
      message-generator.ts       -- Campaign-specific AI message management
      simulation-engine.ts       -- Orchestrates full simulation
    news/
      gnews-client.ts            -- GNews API client (all categories)
      rss-parser.ts              -- RSS feed parser (DVIDS, USFA, ODMP, NWS, etc.)
      fema-client.ts             -- FEMA Disaster Declarations API client
      weather-alerts.ts          -- NWS severe weather alerts client
      news-pipeline.ts           -- Full ingestion pipeline orchestrator
  app/
    api/
      cron/
        ingest-news/route.ts     -- News ingestion cron (every 30 min)
        simulate-donations/route.ts -- Donation simulation cron
        update-phases/route.ts   -- Campaign phase checker (every 5 min)
        reconcile/route.ts       -- Stripe reconciliation (daily)
        send-newsletter/route.ts -- Weekly newsletter (Thursdays)
        publish-campaigns/route.ts -- Auto-publisher
      admin/
        seed/
          generate-messages/route.ts -- Manual message pool generation
          purge/route.ts            -- Purge all seed data
          stats/route.ts            -- Seed vs real statistics
```
