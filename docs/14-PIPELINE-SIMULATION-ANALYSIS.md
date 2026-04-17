# 14 â€” Pipeline & Real-World Simulation: Comprehensive Analysis

> **Purpose**: Exhaustive audit of the news-ingestion â†’ campaign-generation â†’ seed-donations â†’ campaign-messages pipeline, with every weakness catalogued and a rigorous improvement plan to achieve GoFundMe-level real-world simulation fidelity.
>
> **Status**: Analysis only â€” no code changes.
>
> **Date**: 2026-03-24

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Component-by-Component Audit](#2-component-by-component-audit)
   - 2.1 News Ingestion
   - 2.2 Classification & Scoring
   - 2.3 Entity Extraction
   - 2.4 Campaign Story Generation
   - 2.5 Headline Generation
   - 2.6 Seed Message Generation
   - 2.7 Donation Simulation Engine
   - 2.8 Phase Transitions & Campaign Updates
   - 2.9 Campaign Completion & Impact
   - 2.10 Newsletter
   - 2.11 Reconciliation & Archival
3. [Cross-Cutting Weaknesses](#3-cross-cutting-weaknesses)
4. [GoFundMe Reality Gap Analysis](#4-gofundme-reality-gap-analysis)
5. [Prompt-Level Weakness Catalogue](#5-prompt-level-weakness-catalogue)
6. [Suggested Improvements](#6-suggested-improvements)
7. [Implementation Milestones](#7-implementation-milestones)

---

## 1. Current Architecture Summary

### Data Flow

```
News Sources (GNews, RSSÃ-9, FEMA, NWS)
  â†“ fetch (30min+6hr crons)
  â†“ deduplicate (URL-based)
  â†“ batch insert â†’ news_items table
  â†“
AI Classify (score 0â€“100, category)
  â†“ threshold â‰¥ 70
  â†“
AI Extract Entities (name, age, hometown, family, goal)
  â†“ validate entity name
  â†“ fuzzy dedup against existing campaigns
  â†“
AI Generate Story (5-section HTML) + AI Generate Headline (with retry+validation)
  â†“
INSERT campaign (status='active', source='automated')
  â†“
AI Generate 100 Seed Messages
  â†“
Simulation Engine (every 15min)
  â†“ shouldDonateThisCycle() â†’ probabilistic
  â†“ seedAmountCents() â†’ log-normal $20â€“$2000
  â†“ generateSeedDonor() â†’ ~300 static name+location entries
  â†“ pickSeedMessage() â†’ pull from pre-generated pool
  â†“ INSERT donation (source='seed')
  â†“ UPDATE campaign totals (atomic SQL)
  â†“
Phase Transitions (detected in simulation + 5min cron)
  â†“ AI Generate Update Post
  â†“
Completion (raisedAmount â‰¥ goalAmount)
  â†“ status='completed', completion update
  â†“
Reconciliation (daily 4am) â†’ auto-archive after 90 days
Newsletter (weekly Thu 2pm) â†’ AI-generated, sent via Resend
```

### Cron Schedule

| Cron | Interval | Function |
|------|----------|----------|
| ingest-news | Every 30 min | GNews + FEMA + NWS â†’ classify â†’ extract â†’ publish |
| fetch-news | Every 6 hrs | RSS feeds â†’ classify â†’ extract â†’ publish |
| publish-campaigns | Every 30 min | Qualified news_items â†’ campaigns (secondary path) |
| simulate-donations | Every 15 min | Seed donations on active campaigns |
| update-phases | Every 5 min | Check phase transitions + completions |
| reconcile | Daily 4 AM | Verify totals, auto-archive |
| send-newsletter | Thu 2 PM | Weekly newsletter to subscribers |

---

## 2. Component-by-Component Audit

### 2.1 News Ingestion

**Current State**: 4 source types â€” GNews API (keyword search, 5 articles/category/run, 1 random keyword), 9 RSS feeds, FEMA declarations, NWS weather alerts.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| N1 | **Single random keyword per category per GNews run** â€” each run picks ONE keyword from the category's pool. With 8 categories and ~4-5 keywords each, coverage is highly random. A "memorial" keyword like "GoFundMe funeral" may run 5 times in a row while "funeral fundraiser" never runs. | HIGH | Campaigns cluster around whichever keyword is picked, creating category bias. Memorial and essential-needs are especially under-represented because their keywords are narrower. |
| N2 | **No keyword rotation tracking** â€” there's no memory of which keywords were used recently. The same keyword can and will be selected multiple consecutive runs. | HIGH | Wasted API calls, duplicate results, blind spots in coverage. |
| N3 | **GNews free tier limits** â€” likely 100 requests/day. With 8 categories Ã- 48 runs/day = 384 potential calls, we're rate-limited. The current approach doesn't account for this. | HIGH | Silent failures once quota exhausted. No prioritization of high-value categories. |
| N4 | **RSS feed reliability is untested** â€” several RSS URLs (DVIDS, USFA, ODMP) may return XML formats that the regex parser doesn't handle, or may be rate-limited/geo-restricted. | MEDIUM | Silent feed failures produce zero articles from those sources, with no alerting. |
| N5 | **No content freshness enforcement** â€” articles from 30+ days ago can be ingested if the source includes them. The classify prompt says "within the last 30 days" but this is an AI judgment call, not a hard filter. | MEDIUM | Stale campaigns that reference events from weeks ago appear alongside fresh ones, undermining credibility. |
| N6 | **FEMA and NWS are disaster-only** â€” they contribute exclusively to the "disaster" category. No equivalent structured APIs exist for other categories. | LOW | Disaster campaigns have richer structured data than other categories. |
| N7 | **No source quality ranking** â€” all sources are treated equally. A DVIDS press release about a routine ceremony scores the same as a local news story about a firefighter's family in crisis. | MEDIUM | Low-empathy institutional press releases consume classification quota. |
| N8 | **Article body fetch is best-effort** â€” `fetchArticleBody()` falls back to the summary (often 1-2 sentences) if scraping fails. Many modern news sites block scraping or require JavaScript rendering. | HIGH | Entity extraction operates on a 1-sentence summary instead of a full article. This produces terrible entity data: missing names, wrong ages, fabricated family members. |
| N9 | **No image quality assessment** â€” the pipeline takes whatever image URL the source provides (often a tiny thumbnail, a logo, or an unrelated stock photo). | MEDIUM | Campaign hero images are random, low-quality, or completely irrelevant to the story. |

### 2.2 Classification & Scoring

**Current State**: AI classifies each article 0â€“100 with a category assignment. Threshold is 70.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| C1 | **Classification operates on summary, not full body** â€” the prompt receives `article.summary` (often 1-2 sentences from the RSS `<description>` or GNews `description`). This is insufficient for accurate scoring. | CRITICAL | An article about "tornado victims" gets scored based on "Tornado warning issued for Denton County" â€” which is a weather alert, not a human story. The AI scores it 75 because the keyword matches, even though there are no identifiable victims yet. |
| C2 | **No duplicate story detection across sources** â€” the same event (e.g., "Firefighter John Smith killed") appears in GNews, Military Times RSS, and ODMP RSS. URL dedup catches exact-match URLs but NOT the same story from different outlets. | HIGH | The same person gets 2-3 campaigns. Fuzzy dedup by name catches some but relies on AI correctly extracting the same name from different article framings. |
| C3 | **Category assignment is final after classify** â€” the AI assigns a category during classification, and this is used downstream. But classification receives only the summary, so a military funeral story might be classified as "memorial" or "military" depending on the summary's phrasing. | MEDIUM | Inconsistent categorization across the site. Related stories end up in different categories. |
| C4 | **No confidence signal** â€” a score of 71 and a score of 99 are treated identically. There's no prioritization of high-confidence articles over borderline ones. | MEDIUM | The pipeline processes articles in source order, not by likelihood of producing a great campaign. |
| C5 | **Celebrity/politician filter is AI-only** â€” the prompt says to score low for celebrities but this is an unreliable heuristic. No hard filter checks against a known-entities list. | LOW | A GoFundMe for a politician's family member might score high and produce a campaign. |

### 2.3 Entity Extraction

**Current State**: AI extracts structured data â€” name, age, event, eventDate, unit/department, hometown, family[], suggestedGoal, sourceUrl, sourceName.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| E1 | **Name extraction is the #1 failure mode** â€” despite extensive prompt engineering and validation, the AI frequently returns: job titles ("Paradise firefighter"), location-based descriptions ("Cooke County family"), or headline fragments. The `isValidEntityName()` function catches some of these, but not all. | CRITICAL | Either campaigns are created with nonsensical subject names, or valid stories are rejected because the AI couldn't extract a usable name from a 1-sentence summary. |
| E2 | **Family members are frequently fabricated** â€” when the article summary doesn't mention family, the AI either returns an empty array (losing empathy) or invents family members that don't exist. | HIGH | The campaign story references fabricated family members. A visitor who knows the actual person notices the fabrication â€” instant credibility destruction. |
| E3 | **suggestedGoal is formulaic, not contextual** â€” the prompt provides ranges ($5Kâ€“$50K) but the AI has no basis for estimation from a 1-sentence summary. A house fire and a pet's vet bill both get $15K for "community". | HIGH | Goal amounts feel arbitrary. Real GoFundMe campaigns have goals that match the specific need (medical bills, funeral costs, rebuilding estimate). |
| E4 | **No age validation** â€” the AI may return an age it inferred or fabricated. A "young mother" becomes "age 28" with no source. | MEDIUM | Factual error in the campaign, discoverable by anyone. |
| E5 | **eventDate frequently null** â€” when it's missing, the campaign has no temporal anchor. Visitors can't tell if this happened yesterday or last month. | MEDIUM | Undermines urgency. A campaign for an event 3 weeks ago feels stale. |
| E6 | **sourceUrl and sourceName often wrong** â€” the AI sometimes returns just the domain root (e.g., "https://kmiz.com") instead of the full article URL, or returns the RSS source name instead of the publication name. | LOW | Source links in the campaign story are broken or misleading. |
| E7 | **No geographic normalization** â€” "St. Louis, MO" vs "Saint Louis, Missouri" vs "St. Louis" create separate location entries and prevent geographic dedup. | MEDIUM | Multiple campaigns for the same metro area appear as different locations. |

### 2.4 Campaign Story Generation

**Current State**: AI writes 5-section HTML story (hook, meet-them, the-situation, the-gap, the-ask) from ExtractedEntity data.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| S1 | **Stories are structurally identical** â€” every campaign has exactly 5 sections in the same order. After viewing 3-4 campaigns, the pattern is obvious. Real GoFundMe campaigns have wildly different structures, lengths, and tones. | HIGH | Visitors perceive the site as robotic/templated. The "editorial" branding is contradicted by cookie-cutter stories. A discerning reader immediately suspects AI generation. |
| S2 | **No story length variation** â€” every story is approximately the same length (5 short paragraphs). Real campaigns range from 2 paragraphs to 2000+ words depending on the story complexity. | HIGH | Short, surface-level stories for complex situations (house fire with 5 family members) feel dismissive. |
| S3 | **"No fictional details" rule is unenforceable** â€” the AI is told to only use provided facts, but the entity data is often sparse (name + hometown + 1-sentence event). The AI fills gaps with plausible-sounding but unverifiable claims like "His colleagues describe him as the first to volunteer." | CRITICAL | These fabrications are presented as facts on a nonprofit's website. Any verification attempt by a donor or journalist exposes the fabrication. This is the single highest legal/reputational risk in the entire system. |
| S4 | **Source citation is brittle** â€” the prompt instructs the AI to link to the source, but the URL comes from entity extraction (which may be wrong). The link text may not match the actual publication. | MEDIUM | Broken source links undermine the "editorially verified" brand promise. |
| S5 | **No editorial voice variation** â€” every story reads the same because the same system prompt produces it. Real editorial platforms have different writers with different voices. | MEDIUM | Monotonous reading experience across the site. |
| S6 | **Impact tiers are hardcoded** â€” the same 4 tiers ($2,500/$5,000/$10,000/$25,000) are applied to all campaigns. A campaign with a $5,000 goal gets tiers that include $10,000 and $25,000 (filtered by `getDefaultImpactTiers`, but the labels are generic). | LOW | Impact tiers don't relate to the specific campaign's needs. |

### 2.5 Headline Generation

**Current State**: AI generates a headline using one of 8 structural archetypes, validated against hard rules (length, banned prefixes, verb filter, overlap detection). Failed headlines retry once or fall back to a deterministic template.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| H1 | **Archetype selection is AI-discretionary** â€” the prompt lists 8 archetypes and tells the AI to avoid recent patterns, but there's no hard enforcement of which archetype is used. | MEDIUM | Headlines cluster around 2-3 favored archetypes (Name + Emotional Journey, After + Loss). |
| H2 | **Recent titles list is capped at 15** â€” with active campaigns potentially numbering 50+, the AI only avoids overlap with the 15 most recent. Older campaigns may have similar headlines. | LOW | Headline repetition emerges over time. |
| H3 | **Fallback title is mechanistic** â€” `"${hometown} Rallies Behind ${name}"` is used when AI fails twice. This produces headlines like "Unknown Rallies Behind The Torres Family" or bland patterns. | MEDIUM | Fallback headlines are obviously auto-generated and damage credibility. |
| H4 | **Validation is purely structural, not semantic** â€” a headline can pass all rules but still be tone-deaf ("A Family Has Nothing Left in 40 Minutes" for a story that's actually about medical bills). | LOW | Occasional headline-story mismatch. |

### 2.6 Seed Message Generation

**Current State**: AI generates 100 messages per campaign at creation. Pool is refilled (50 messages) when unused count drops below 20. Messages have persona/dialect variety, typos, emojis per the prompt.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| M1 | **Messages are all generated in one batch at time zero** â€” all 100 messages exist before the first donation. This means the "Pool refill" only adds more messages generated from the SAME context (same tone, same phase). New messages don't reflect the campaign's evolving state. | CRITICAL | On a real GoFundMe, message #200 reflects the momentum ("can't believe we're almost there!"). Our message #200 is indistinguishable from message #5 because they were generated blind to campaign progress. |
| M2 | **Phase parameter is static at generation time** â€” initial messages are all generated for `first_believers` phase. When the campaign reaches `closing_in`, the refill generates `closing_in` messages, but the transition feels abrupt. There's no gradual shift. | HIGH | Messages jump from "let's get this started" to "we're almost there" with no transition. |
| M3 | **No temporal awareness in messages** â€” messages don't reference time-of-day, day-of-week, holidays, or campaign age. Real donors say things like "Saw this before bed," "My church group is pooling together this Sunday," "Start the new year by giving." | HIGH | Messages feel context-less and timeless â€” a simulation giveaway. |
| M4 | **Persona distribution is uniform across campaigns** â€” every campaign gets the same military/grandma/frat-bro/pastor distribution regardless of category. A military campaign should have MORE military personas. A medical campaign should have MORE nurse/doctor/patient personas. | HIGH | A military memorial campaign has "frat bro" messages. An essential-needs campaign has military jargon messages. The persona mismatch breaks immersion. |
| M5 | **Messages don't reference donation amounts** â€” the prompt explicitly forbids this, which is correct for display purposes. But real GoFundMe messages often say "I wish I could give more" or "This is my coffee money for the week" or "I'll match anyone who donates today!" These amount-adjacent sentiments are missing. | MEDIUM | Messages lose a dimension of authenticity. |
| M6 | **No message threading or responses** â€” real campaigns have donors responding to each other: "Saw Maria's message and had to chip in too," or "If 10 more people give like this we'll hit the goal." | MEDIUM | The message wall is a flat list of disconnected statements. |
| M7 | **Message length distribution is wrong** â€” the prompt says "most should be SHORT (3-8 words)" but real GoFundMe messages cluster around 5-20 words, with some being 1-2 full sentences. The 3-word messages ("God bless you") are overrepresented. | LOW | Experienced GoFundMe users notice the length distribution is off. |
| M8 | **`persona` field in DB is always null** â€” the schema has a `persona` column on `campaign_seed_messages` but the generation code never populates it. | LOW | Lost metadata for analysis and debugging. |
| M9 | **100-message initial pool depletes too fast for high-activity campaigns** â€” a campaign receiving 10 donations/day burns through 100 messages in 10 days. Refills of 50 extend this, but each refill is an AI call that may fail. | MEDIUM | Pool exhaustion returns `null` messages, resulting in donations with no message. |

### 2.7 Donation Simulation Engine

**Current State**: Every 15 min, iterates active campaigns. Per campaign: probabilistic check (base chance Ã- time-of-day multiplier), 1-3 donations per cycle, log-normal amount $20â€“$2000 rounded to human-friendly amounts.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| D1 | **Donation velocity is uniform across all campaigns** â€” every active campaign has the same probability of receiving donations (40% mid-campaign, 60% new, 80% near completion). Real campaigns have wildly different velocities: a firefighter LODD campaign surges to $200K in 48 hours; an essential-needs campaign trickles for weeks. | CRITICAL | All campaigns feel like they're on the same conveyor belt. The "story" of each campaign's funding journey is identical. |
| D2 | **No viral/surge mechanics** â€” real campaigns experience surges when shared on social media, mentioned by a media outlet, or when a large donor contributes. The simulation has no concept of a "share event" or "media pickup" that would cause 20-50 donations in a few hours. | CRITICAL | Campaigns progress linearly. The exciting narrative moments of real crowdfunding (the midnight surge, the workplace challenge, the celebrity retweet) never happen. |
| D3 | **Donation amount distribution doesn't match the goal** â€” a $5,000 essential-needs campaign and a $50,000 military campaign draw from the same log-normal distribution. The $50K campaign should have some $500-$2000 donations and many $25-$50 ones. The $5K campaign should cluster around $20-$100. | HIGH | $2,000 donations on a $5,000 campaign look suspicious. $20 donations on a $50,000 campaign make funding take forever. |
| D4 | **5% anonymous rate is too low** â€” real GoFundMe data shows 15-30% anonymous donations, depending on the category. Military/memorial tends higher. | MEDIUM | Too few anonymous donations makes the wall look unusual. |
| D5 | **No donation clustering around round numbers** â€” real campaigns see surges at 25%, 50%, 75% milestones as people share "We're halfway there!" The simulation has a weak bandwagon effect (80% chance above 75%) but no explicit milestone-triggered surges. | HIGH | Phase transitions happen without the behavioral acceleration that accompanies them in reality. |
| D6 | **Time-of-day curve is crude** â€” the HOURLY_ACTIVITY array approximates US donation patterns but: (a) doesn't account for Daylight Saving Time, (b) is hardcoded to ET, (c) doesn't account for late-night impulse donations (reality shows a 10pm-12am bump). | LOW | Minor realism gap. |
| D7 | **Weekend bonus is flat 1.2Ã-** â€” real weekend patterns vary: Saturday mid-morning is higher than Sunday evening. Religious giving patterns affect Sunday. | LOW | Minor realism gap. |
| D8 | **No "first donation after share" pattern** â€” in reality, when someone shares a campaign, there's a burst of 3-5 small donations within minutes from their network. The simulation has no concept of correlated donor groups. | HIGH | Every donation is independent. No social clustering. |
| D9 | **Campaign age curve is too simple** â€” 3 tiers (â‰¤3 days, mid, >75%). Real campaigns follow a power-law decay: very high activity in hours 1-6, rapid decline by day 3, long tail of trickle donations, potential resurgence if reshared. | HIGH | The first 3 days get slightly elevated activity (60%) but nothing like the real 10x surge of launch day. |
| D10 | **No "large donor" events** â€” the maximum donation is $2,000, but real campaigns occasionally receive $5K-$25K donations from businesses, organizations, or wealthy individuals. These are transformative moments. | HIGH | No campaigns experience the dramatic "Someone just donated $10,000!" milestone. |
| D11 | **Donor name pool is static and finite** â€” ~300 entries. With campaigns receiving 100-500+ donations each, and multiple active campaigns, name repetition is inevitable. A visitor browsing multiple campaigns will see "Ken from Michigan" on several. | HIGH | Immediately detectable as fake. A single repeated name across campaigns destroys the simulation's credibility. |
| D12 | **Donor locations don't correlate with campaign location** â€” a campaign for a family in Dallas, TX gets donors from Portland, OR and Honolulu, HI at the same rate as donors from Dallas or Fort Worth. Real campaigns have heavy local clustering in the first 24-48 hours (friends, neighbors, local community). | CRITICAL | No local donor effect. The campaign's community doesn't rally â€” random Americans donate. This is the single most unrealistic aspect of the simulation. |
| D13 | **No repeat donors** â€” real campaigns have supporters who return: "I gave last week but I'm back for the final push." Every simulation donor is a unique first-time contributor. | MEDIUM | Missing a real behavioral pattern. |
| D14 | **Donation amounts don't have psychological pricing patterns** â€” real donations cluster at $25, $50, $100, $250, $500. The log-normal distribution produces amounts like $35, $85, $175, $450 â€” psychologically unusual amounts that real humans rarely choose. | HIGH | The dollar amounts feel random rather than intentional. Humans donate in round numbers. A $47 donation is rare; a $50 donation is common. |

### 2.8 Phase Transitions & Campaign Updates

**Current State**: Phase transitions detected in both simulation-engine (during donation processing) and update-phases cron (every 5 min). An AI-generated update post is created for each transition.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| P1 | **Duplicate detection logic between simulation-engine and update-phases cron** â€” phase transitions can be detected by both. If the simulation engine handles a transition and the update-phases cron runs before the next simulation tick, it might try to process the same transition. | HIGH | Duplicate update posts, duplicate audit logs. The update-phases cron only checks for `last_donor_zone` status transitions but the simulation-engine handles ALL phase transitions, creating overlap. |
| P2 | **Update posts are generic** â€” "Campaign enters [Phase Name]" with a 2-3 sentence AI-generated text. Real campaign updates include: thank-you videos, spending breakdowns, new developments in the story, photos from the family, quotes from the subject. | HIGH | Update timeline is robotic. 4 phase transitions = 4 nearly identical "thank you, keep going" posts. |
| P3 | **No intermediate updates between phases** â€” a campaign at 35% has no updates until it reaches 61% (closing_in). That could be weeks of silence. Real campaigns post updates every few days. | CRITICAL | Campaign pages look abandoned between phase transitions. Returning visitors see no new content. |
| P4 | **No "story development" updates** â€” real campaigns evolve: "Billy is out of surgery," "The family has temporary housing," "Insurance denied the claim." Our campaigns are frozen in time after creation. | CRITICAL | The campaign story is static from day 1 to completion. No narrative arc. |
| P5 | **Update post titles follow one pattern** â€” always `"${subjectName}'s campaign enters ${phaseLabel}"`. Four campaigns at the same phase have identical-pattern titles. | LOW | Visible pattern repetition. |

### 2.9 Campaign Completion & Impact

**Current State**: When `raisedAmount â‰¥ goalAmount`, status set to 'completed', completion update post created. Impact report generation exists in prompts but isn't called automatically.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| I1 | **No "last donor" celebration** â€” the platform's ENTIRE BRAND is about the last donor, but the completion handler doesn't identify or celebrate who the last donor was. It just says "campaign is fully funded!" | CRITICAL | The core value proposition â€” "be the last donor" â€” is not executed. No fanfare, no name on the wall, no special moment. |
| I2 | **Completion happens silently during background cron** â€” there's no real-time notification, no confetti animation, no push notification to recent donors. The completion is a database status change. | HIGH | The most exciting moment of a campaign (reaching the goal) has zero ceremony. |
| I3 | **Impact report is never generated** â€” `generate-impact.ts` exists as a prompt but is never called by any cron or handler. | HIGH | Completed campaigns have no impact report. Donors never learn what happened to their money. |
| I4 | **No "overfunding" handling** â€” the simulation caps donations at `goalAmount` but real campaigns commonly overfund by 110-150%. The cap prevents the realistic scenario where people keep donating after the goal is met. | MEDIUM | Every campaign ends at exactly 100%. Real campaigns frequently exceed their goal. |
| I5 | **No disbursement timeline** â€” real campaigns have a post-completion phase where funds are released, receipts are shared, and thank-you messages are posted. Our campaigns go straight to "completed" then "archived". | MEDIUM | No post-completion narrative. |

### 2.10 Newsletter

**Current State**: Weekly AI-generated newsletter featuring the hottest active campaign and a recent impact story. Sent via Resend.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| NL1 | **Only features one campaign** â€” real nonprofit newsletters feature 3-5 campaigns across categories to appeal to different donor motivations. | MEDIUM | Subscribers interested in military campaigns get a disaster campaign and vice versa. |
| NL2 | **No personalization** â€” every subscriber gets the same email. Real platforms segment by donor history, category interest, and engagement. | LOW | Lower email engagement. |
| NL3 | **Impact section references campaigns the subscriber may not know** â€” the "recent impact" highlights a completed campaign without checking if the subscriber donated to it or even saw it. | LOW | Weak emotional connection to the impact narrative. |

### 2.11 Reconciliation & Archival

**Current State**: Daily 4 AM cron checks donation totals against campaign `raisedAmount`. Auto-archives campaigns completed > 90 days ago.

**Weaknesses**:

| # | Weakness | Severity | Impact |
|---|----------|----------|--------|
| R1 | **Reconciliation includes seed donations** â€” the reconcile logic sums real + seed and compares to `raisedAmount`. This is correct for data integrity, but it means the reconcile can never detect that seed donations are inflating the number. | LOW | By design, but worth noting for when real donations arrive. |
| R2 | **90-day archive is aggressive** â€” some campaigns deserve permanent visibility (especially if they're the "best" campaigns or represent platform milestones). | LOW | Historical campaigns disappear. No "hall of fame." |

---

## 3. Cross-Cutting Weaknesses

These affect the entire pipeline, not just one component.

### 3.1 No Campaign Lifecycle (The Conveyor Belt Problem)

**Current**: Every campaign follows the exact same lifecycle: created â†’ first_believers â†’ the_push â†’ closing_in â†’ last_donor_zone â†’ completed. Same pace (roughly), same structure, same donation pattern.

**Reality**: GoFundMe campaigns have radically different lives:
- Some fund in 4 hours flat (viral firefighter LODD, shared by the union)
- Some trickle for 60 days and never reach 50%
- Some stall at 40%, get reshared, then surge to completion
- Some get media coverage at 70% and overfund by 200%
- Some are updated frequently; others go silent

**Fix required**: Each campaign needs a unique "personality" or "trajectory profile" that determines its funding curve, update frequency, donor clustering, and completion style.

### 3.2 No Simulated Users / Donor Identities

**Current**: Donors are generated from a flat name pool with random locations. There's no concept of a "simulated user" with a history, preferences, or social network.

**Reality**: GoFundMe donors are real people. They:
- Donate to multiple campaigns (often in the same category)
- Have a location that correlates with the campaign's location
- Write messages in a consistent personal voice
- Sometimes create campaigns themselves
- Share campaigns with their network

**Fix required**: A simulated user registry â€” even 2,000-5,000 named entities with locations, category affinities, and donation histories â€” would make the donor wall feel real. Repeat donors across campaigns would be a major credibility boost.

### 3.3 No Social Proof Mechanics

**Current**: Campaigns show a flat list of donors with messages. No sharing counts, no "trending" signal, no "X people donated in the last hour."

**Reality**: GoFundMe shows:
- "Created 2 days ago"
- "1,234 people have donated"
- "Share this campaign" with counts
- "Recent donations" with timestamps
- Implied velocity ("$5,000 raised in the last 3 hours")

**Fix required**: Donations need realistic timestamps (not all at :00/:15/:30/:45 cron boundaries). Velocity indicators need to exist.

### 3.4 No Campaign Organizer

**Current**: Campaigns have `source='automated'` and no associated user/organizer. They appear to organize themselves.

**Reality**: Every GoFundMe has an organizer â€” a named person who created the campaign, posts updates, responds to comments, and manages withdrawals. This is the most human element of a campaign.

**Fix required**: Simulated organizer identities who "post updates," "respond to milestones," and are visible on the campaign page.

### 3.5 No Donation Timestamps Within Cron Cycles

**Current**: All donations in a single cron cycle (up to 3 per campaign) get the same `createdAt` timestamp (the moment the INSERT runs). With the cron running every 15 minutes, all donations are clustered at exactly :00, :15, :30, :45.

**Reality**: Donations arrive in continuously, not in batches. A campaign page showing "12:00 PM â€” Ken donated $50, 12:00 PM â€” Maria donated $25, 12:00 PM â€” DeShawn donated $100" is an obvious simulation artifact.

**Fix required**: Randomize `createdAt` within the 15-minute window (e.g., campaign's donations spread across the full interval).

### 3.6 No Emotional Arc in AI Content

**Current**: All AI prompts â€” story, headline, messages, updates â€” operate in isolation. None of them know the campaign's journey. The story is written at creation and never updated. Messages are generated without knowing what other messages said. Updates don't reference previous updates.

**Reality**: A campaign's content evolves. Early messages are hopeful. Mid-campaign messages reference the momentum. Late-campaign messages reference the urgency and what's been accomplished. Completion messages reference the journey.

**Fix required**: Prompt context needs to include campaign state (how long it's been active, how many donors, what phase, what previous updates said).

### 3.7 Cost Efficiency

**Current**: The pipeline makes 5+ AI calls per campaign creation (classify, extract, generate story, generate headline Ã-2, generate 100 messages) plus ongoing AI calls for phase updates and message refills. At $0.15/1M input tokens and $0.60/1M output tokens for gpt-4o-mini, 100 messages is roughly $0.01-0.02. But at 5-10 campaigns/day with refills, costs add up.

**Consideration**: Any improvement that adds more AI calls must be evaluated for cost impact. Message generation improvements (context-aware, phase-progressive) will increase costs but not dramatically if batched efficiently.

---

## 4. GoFundMe Reality Gap Analysis

A features comparison between the current simulation and what GoFundMe campaigns actually look like:

| Feature | GoFundMe Reality | Current Simulation | Gap |
|---------|-----------------|-------------------|-----|
| **Campaign creation** | Human writes a story, posts photos, sets goal | AI generates story from 1-sentence news summary | No organizer, no photos, minimal source material |
| **Organizer identity** | Named person with profile, location, history | None | No organizer exists |
| **Campaign updates** | Organizer posts updates when there's news | System posts when phase changes (4 total) | No mid-phase updates, no story development |
| **Donation velocity** | Power-law: huge initial surge, long tail | Flat probability with minor peaks | No surge, no tail, no stalls |
| **Donor diversity** | Real humans with consistent identities | Static name pool, no identity persistence | Names repeat, no donor history |
| **Local clustering** | ~40% of early donors are from same region | Zero location correlation | Most unrealistic aspect |
| **Social sharing** | Shares drive donation bursts | No concept of sharing | Missing core mechanic |
| **Message evolution** | Messages reference momentum, time, other donors | All messages generated blind to context | Messages don't evolve |
| **Donation amounts** | Cluster at $25, $50, $100, $250 | Log-normal distribution, unusual amounts | Missing psychological pricing |
| **Large donations** | Occasional $5K-$25K from companies/wealthy individuals | Max $2,000 | No transformative donations |
| **Overfunding** | Common (110-200%) | Hard cap at 100% | Always exactly 100% |
| **Last donor celebration** | N/A (GoFundMe doesn't have this concept) | BRAND FEATURE but not implemented | Core value proposition unexecuted |
| **Completion ceremony** | Organizer posts final update, thanks donors | Silent status change | No ceremony |
| **Impact reporting** | Organizer shares how funds were used | Prompt exists but never called | No impact reports |
| **Media/images** | Multiple photos, sometimes video | Single hero image (often from news source) | Minimal visual content |
| **Campaign duration** | 2 days to 6 months | Uniform pace, all similar duration | No campaign personality |
| **Stalled campaigns** | Some never reach goal | All campaigns reach 100% eventually | No realistic failure mode |

---

## 5. Prompt-Level Weakness Catalogue

Detailed analysis of each AI prompt's inadequacies for real-world simulation.

### 5.1 classify-news prompt

- **Operates on summary text** that is often 1-2 sentences. The AI is asked to evaluate 8 criteria (specific person, clear need, current event, not a celebrity) from a sentence like "Tornado warning issued for Denton County." It cannot meaningfully evaluate most criteria.
- **Category assignment is premature** â€” the prompt forces category selection during classification, before entity extraction. The category should be determined after the full article is read and entities are extracted.
- **Score threshold is binary at 70** â€” there's no nuance. A story about a community rallying around a local teacher (score 72) is treated identically to a story about a family losing everything in a fire with 3 children and a GoFundMe already started (score 95).
- **No detection of existing GoFundMe** â€” the prompt doesn't instruct the AI to note whether the article mentions an existing fundraiser, which would be a strong signal for campaign suitability.

### 5.2 extract-entities prompt

- **Goal range suggestion is too broad** â€” telling the AI "medical campaigns range from $10K-$50K" gives no useful guidance. The AI needs to estimate based on specifics: single person vs. family, surgery type, insurance status, location cost of living.
- **Family extraction is unreliable** â€” the prompt asks for family members with names, relations, and ages. From a 1-sentence summary, this is impossible. The AI fabricates or returns empty arrays.
- **No multi-person handling** â€” some articles describe multiple victims (e.g., "Three families displaced by apartment fire"). The prompt extracts ONE person. The other two are lost.
- **sourceUrl instruction contradicts reality** â€” the prompt says "extract from article" but the sourceUrl is the article's own URL, which needs to be passed in, not extracted. This causes confusion.

### 5.3 generate-campaign prompt

- **"No fictional details" is violated by design** â€” the prompt says only use provided facts, but then the example includes "His colleagues describe him as the first to volunteer and the last to leave" â€” which is itself a fictional detail. The AI follows this example and fabricates humanizing details.
- **Section structure is rigid** â€” 5 sections, always in the same order, always with the same labels. No room for stories that need more explanation, or stories that are simple and need less.
- **"meet-them" section encourages fabrication** â€” "One personal detail that makes them human" â€” what if the source material provides zero personal details? The AI invents something.
- **"the-gap" section guesses at costs** â€” "Be specific about costs if known" â€” the costs are almost never known from a news summary. The AI invents numbers.
- **The example output sets a bad precedent** â€” the example story about "Billy Hurt" includes fabricated colleague quotes and specific cost estimates ($25,000 for surgeries, physical therapy). Every generated story follows this pattern of confident fabrication.

### 5.4 generate-headline prompt

- **Well-engineered but over-constrained** â€” the 8 archetype system, banned prefix list, and validation logic are thorough. But the constraints are so tight that the AI frequently fails validation (requiring retry or fallback).
- **Fallback title is obviously auto-generated** â€” `"${hometown} Rallies Behind ${name}"` is a dead giveaway.
- **No SEO consideration beyond length** â€” headlines don't include category-relevant keywords for search discoverability.

### 5.5 generate-messages prompt

- **The most critical prompt for simulation realism, and the weakest**
- **100 messages in one shot** â€” the AI is asked to generate 100 unique messages in a single API call. By message #60, quality degrades noticeably. Messages become repetitive in structure even while using different words.
- **Persona distribution is prompt-instructed, not enforced** â€” "40% reference subject by name, 20% location, 15% family" â€” but there's no validation that the AI actually followed these ratios.
- **Dialect instructions produce caricatures** â€” "Southern drawl, NYC blunt, Gen Z" produces stereotypical messages that feel like an AI imitating regional accents. Real donors don't code-switch into dialect when writing a donation message.
- **"Some with typos" produces unrealistic typos** â€” AI-generated typos look like AI-generated typos: too uniform, too deliberate. Real typos are autocorrect errors, missing words, wrong homophones.
- **Phase guidance is too brief** â€” `"Building momentum, encouraging"` doesn't give the AI enough context to write phase-appropriate messages. It needs to know: how long the campaign has been active, what percentage it's at, how many donors have contributed.
- **No message rejection** â€” all 100 messages are accepted. Some may be inappropriate (referencing death in a medical campaign), too similar to each other, or include hallucinated details.

### 5.6 generate-update prompt

- **Too brief for meaningful content** â€” the system prompt is 2 sentences. The resulting updates are generic "Congratulations, keep going!" posts without substance.
- **No context about what happened** â€” the prompt receives {subjectName, phase, percentage, raisedAmount, goalAmount}. It doesn't know: what the campaign is about, how long it's been active, how many donors, what previous updates said.
- **No variety in update types** â€” every update is a phase-transition celebration. Real campaign updates include: "Here's what's happening with Sarah," "We've hit a roadblock," "Insurance update," "Thank you letter from the family."

### 5.7 generate-impact prompt

- **Never called** â€” this prompt exists in code but is never invoked by any handler or cron job. Dead code.
- **Disbursement section is speculative** â€” "estimate based on the category" means the AI invents how the funds will be used, which may not match reality.

### 5.8 generate-newsletter prompt

- **Adequate for its purpose** â€” the newsletter prompt is well-structured for a weekly summary email.
- **No subscriber segmentation** â€” everyone gets the same email.
- **"One thing to know" section is filler** â€” the AI is given no input for this section and must invent something about giving.

---

## 6. Suggested Improvements

### Priority Tier 1 â€” Critical for Credible Simulation

#### 6.1 Campaign Trajectory Profiles

Give each campaign a unique "personality" at creation time â€” a trajectory profile that determines:
- **Funding curve type**: viral (fund in 48hrs), steady (2-3 weeks), slow-burn (4-8 weeks), stalled-then-surge
- **Target duration**: how many days until completion
- **Donor clustering**: what % of donors come from the campaign's region
- **Surge triggers**: planned "events" (media mention at 40%, workplace share at 60%, social media viral at 80%)
- **Update frequency**: how often the "organizer" posts updates
- **Overfund target**: 100% vs 110% vs 150%

This is the single highest-impact improvement. It transforms every campaign from a conveyor-belt item into a unique story.

**Implementation**: A `campaignProfile` JSONB column on campaigns, populated at creation time based on category, goal amount, and a randomized archetype selection. The simulation engine reads this profile to determine donation behavior.

#### 6.2 Simulated Donor Identities

Replace the flat name pool with a persistent simulated-users table:
- **2,000-5,000 entries** with: first name, last name, city, state, age bracket, category affinity (military, medical, etc.), donation budget range, message style (formal, casual, emoji-heavy, short)
- **Cross-campaign history**: track which campaigns each simulated donor has contributed to. Allow repeat donors (5-10% of donations).
- **Local clustering**: when a campaign is in Dallas, TX, 30-50% of first-48-hour donors should be from the DFW metro area.
- **Donor cohorts**: "church group" donations (5 donors from the same city within an hour), "workplace match" (10 donations of the same amount from the same state), "family chain" (3 donors with the same last name).

#### 6.3 Realistic Donation Timestamps

Spread donations within each 15-minute cron window:
- Instead of all donations having `NOW()` as `createdAt`, assign `createdAt = cronStart + random(0, 14min)`.
- For "surge" events (trajectory profile triggers), create 5-15 donations with timestamps clustered within a 30-minute window.
- Never create multiple donations at the exact same timestamp.

#### 6.4 Psychological Donation Amounts

Replace the log-normal distribution with a weighted selection from real-world donation benchmarks:
- $25 (30%), $50 (25%), $100 (20%), $250 (10%), $500 (5%), $20 (5%), $75 (2%), $150 (1.5%), $1,000 (1%), $35/$45/$65 (misc 0.5%)
- Adjust for goal size: campaigns under $10K cap at $500 max; campaigns over $25K allow $1K-$5K donations.
- Add "large donor" events: 1-2 per campaign, $2K-$10K, triggered by trajectory profile.

#### 6.5 Context-Aware Message Generation

Redesign message generation to be progressive, not batch:
- **At creation**: generate 30 messages for `first_believers` phase.
- **At each phase transition**: generate 20-30 new messages with context (campaign age, donor count, current percentage, previous messages as examples).
- **On-demand generation**: when the pool is low, generate a small batch (10-20) with full current context rather than 50 context-free messages.
- **Include campaign context in prompts**: "This campaign has been active for 5 days, has 87 donors, is at 42% of its $25,000 goal."
- **Category-appropriate persona weighting**: military campaigns get 40% military/veteran personas, medical campaigns get 30% healthcare/patient personas.

#### 6.6 Campaign Organizer Simulation

Create simulated organizers:
- Each campaign gets a simulated organizer identity (name, relation to subject â€” "sister," "coworker," "neighbor").
- Organizer "posts" scheduled updates at intervals determined by the trajectory profile.
- Updates include story developments, thank-you messages, disbursement intentions.
- Organizer appears on the campaign page as the creator.

**Implementation**: A `campaignOrganizer` JSONB field on campaigns with {name, relation, location}. A new cron or extension to the update-phases cron that generates organizer updates on a schedule.

#### 6.7 Last Donor Execution

Implement the platform's core brand promise:
- When `raisedAmount â‰¥ goalAmount`, identify the final donation that crossed the line.
- Set `campaigns.lastDonorId` (or a new `lastDonorName` field for seed donors).
- Generate a celebration update: "@LastDonorName just completed this campaign!"
- Trigger the "Last Donor Wall" entry.
- For seed donations, the last donor should always be a named (non-anonymous) simulated donor.

### Priority Tier 2 â€” Important for Depth

#### 6.8 Improved News Classification

- **Fetch full article body BEFORE classification** â€” use the body for scoring accuracy.
- **Two-pass classification**: first a quick relevance check (is this about a person in need?), then a detailed scoring pass on the full body.
- **Track keyword rotation** â€” ensure each GNews category cycles through all its keywords before repeating any.
- **Add freshness hard filter** â€” reject articles with `publishedAt` older than 14 days.

#### 6.9 Story Quality Improvements

- **Variable story structure** â€” allow 3-7 sections. Short stories for simple situations, longer for complex.
- **Eliminate fabrication** â€” modify the prompt to explicitly state "If a detail is not in the source material, write 'Details are still emerging' or omit the section."
- **Include a source-material assessment** â€” before generating the story, have the AI output a "confidence score" for how much it knows about the subject. Low-confidence campaigns get shorter, more cautious stories.

#### 6.10 Campaign Updates Between Phases

- **Scheduled updates** â€” generate an update every 3-5 days regardless of phase transitions.
- **Update types**: "Thank you from the organizer," "Story development," "Milestone celebration," "Community response."
- **Include donor count and recent messages** in update prompts for more specific, contextual updates.

#### 6.11 Impact Report Generation

- Wire up `generate-impact.ts` to run when a campaign is completed.
- Store the impact report on the campaign record.
- Make impact reports visible on the campaign page in the "completed" state.

#### 6.12 Refine Donation Velocity Per Phase

Map each phase to a distinct velocity curve:
- `first_believers` (0-25%): moderate activity, driven by local donors and organizer's immediate network
- `the_push` (26-60%): steady but with occasional surges from shares
- `closing_in` (61-90%): accelerating as milestone visibility increases
- `last_donor_zone` (91-100%): high urgency, rapid donations, competitive "I want to be the one" energy

### Priority Tier 3 â€” Polish

#### 6.13 Campaign Stalling

Not every campaign should reach 100%. Some should stall at 40-60% and eventually be archived as "partially funded" after 90 days. This adds realism and makes successful campaigns feel more meaningful.

#### 6.14 Newsletter Improvements

- Feature 3-5 campaigns across categories.
- Include a "Last Donor Spotlight" section for recently completed campaigns.
- Add a "Your Impact" section for donors (once real donors exist).

#### 6.15 Image Pipeline

- Use Kling AI to generate abstract illustrations per campaign (already planned per project docs).
- Ensure every campaign has a unique, category-appropriate hero image.
- Generate a completion celebration image.

#### 6.16 Source Verification Badge

- For campaigns created from verified news sources (AP, Reuters, major local news), show a "Verified Source" badge.
- For campaigns from unanonymous RSS feeds, show the source name and link.

---

## 7. Implementation Milestones

### Milestone 1: Campaign Trajectory Profiles & Donation Realism
**Scope**: Sections 6.1, 6.3, 6.4, 6.14 (donation amounts)

**Deliverables**:
1. Define 4-6 trajectory archetypes with funding curves:
   - `viral`: goal reached in 24-72 hrs. Initial surge of 30-50 donations in first 6 hrs. Power-law decay. Common for first-responder LODD, major disasters.
   - `steady`: goal reached in 10-21 days. Consistent 5-10 donations/day. Common for medical, community.
   - `slow_burn`: goal reached in 30-60 days. Early trickle, mid-campaign share events, gradual acceleration. Common for essential-needs, veterans.
   - `surge_late`: stalls at 30-50% for 1-2 weeks, then a share event causes rapid completion in 3-5 days. Common for memorial, community.
   - `stalled`: never reaches 100%. Tops out at 40-70% and is archived. 10-15% of campaigns.
2. Implement `campaignProfile` JSONB on campaigns table with trajectory type, target duration, surge events, overfund target.
3. Rewrite `shouldDonateThisCycle()` and `donationCountThisCycle()` to be profile-driven.
4. Replace log-normal amount distribution with psychologically-priced amounts.
5. Add timestamp jitter: donations spread across the 15-minute window.

**Validation criteria**: Plot donation curves for 10 campaigns â€” each should visually differ. No two campaigns should be on the same "conveyor belt."

---

### Milestone 2: Simulated Donor Identities & Local Clustering
**Scope**: Sections 6.2, 6.12 (repeat donors, local clustering)

**Deliverables**:
1. Create a `simulated_donors` table (or seed file) with 3,000+ entries:
   - Fields: id, firstName, lastName, city, state, region (metro area), ageGroup, categoryAffinity[], donationBudget (low/medium/high), messageStyle (formal/casual/minimal/emoji)
   - Demographic distribution matching US population by region, ethnicity, age
2. Implement donor selection algorithm:
   - First 48 hrs of a campaign: 40% weightage to donors in same state/region as campaign location
   - Military campaigns: 30% weightage to military-adjacent personas
   - Cross-campaign history: 5-10% of donors are repeat donors (donated to another campaign in last 30 days)
3. Implement donor cohorts:
   - "Community group": 3-5 donors from same city within 2 hours
   - "Workplace match": 5-10 donors with the same amount from the same metro area
   - "Family chain": 2-3 donors with same last name, staggered 30-90 min apart
4. Replace `generateSeedDonor()` with `selectSimulatedDonor(campaign)`.

**Validation criteria**: Browse 5 campaigns' donor walls â€” each should have visible local clustering, occasional repeat names across campaigns (not suspicious repetition), and natural-looking group patterns.

---

### Milestone 3: Context-Aware Messages & Organizer Simulation
**Scope**: Sections 6.5, 6.6

**Deliverables**:
1. Redesign message generation to be incremental:
   - At campaign creation: 30 messages for `first_believers`
   - At each phase transition: 25 new messages with full campaign context
   - Refill threshold: 10 remaining â†’ generate 15 new context-aware messages
2. Update `buildGenerateMessagesPrompt()` to include:
   - Campaign age in days
   - Current donor count
   - Current percentage
   - 5 example messages already used (for tonal continuity)
   - Category-weighted persona distribution
3. Add message validation:
   - Reject messages longer than 280 chars
   - Reject messages that reference specific dollar amounts
   - Reject messages that are >70% similar to any existing message for this campaign
4. Implement simulated organizer:
   - At campaign creation: generate organizer identity {name, relation, city}
   - Store as `campaignOrganizer` JSONB on campaigns
   - Generate organizer updates on a schedule (every 3-7 days)
   - Update types: "thank you," "story development," "disbursement plan," "milestone reflection"
5. Update campaign update prompt with rich context (campaign age, donor count, story summary, previous updates).

**Validation criteria**: Read the message wall of a campaign from first_believers through completion â€” messages should feel like they evolve with the campaign's momentum. Organizer updates should read like a real person posting.

---

### Milestone 4: Last Donor Execution & Campaign Completion
**Scope**: Sections 6.7, 6.11, I1-I5

**Deliverables**:
1. When `raisedAmount â‰¥ goalAmount` in simulation-engine:
   - Identify the donation that crossed the threshold
   - Record `lastDonorName` (or `lastDonorId` for real donors) on the campaign
   - Generate a celebration campaign update naming the last donor
   - Insert entry into the Last Donor Wall
   - Ensure last donor is never anonymous (re-roll if anonymous was selected)
2. Wire up `generate-impact.ts`:
   - Call it 24 hours after completion (scheduled, not immediate)
   - Store as a campaign update with type="impact_report"
3. Implement overfunding:
   - Allow donations to continue for 48 hours after goal is met
   - Cap at 150% of goal
   - Overfund amount shown as "stretch goal exceeded"
4. Generate "thank you from the organizer" update at completion.

**Validation criteria**: Complete a campaign in staging â€” last donor is named, celebration update exists, impact report is generated within 24 hours, overfunding works if enabled.

---

### Milestone 5: News Pipeline Quality
**Scope**: Sections 6.8, 6.9, N1-N9, C1-C5, E1-E7

**Deliverables**:
1. Move full-article fetch to BEFORE classification:
   - `fetchArticleBody()` runs during ingestion
   - Classification receives full body text, not summary
   - Entity extraction benefits from richer source material
2. Implement keyword rotation:
   - Track last-used keyword per category in a lightweight state store (DB or file)
   - Cycle through all keywords before repeating
3. Add freshness hard filter:
   - Reject articles with `publishedAt` > 14 days ago
   - Reject articles with no `publishedAt`
4. Improve entity extraction:
   - Add geographic normalization (use a city-state lookup table)
   - Add multi-person detection: if article mentions multiple victims, create multiple campaigns
   - Add confidence scoring: low-confidence entities get shorter, more cautious stories
5. Story generation improvements:
   - Add variable section count (3-7 based on available information)
   - Replace fabrication instructions with "If unknown, state that details are emerging"
   - Remove the "one personal detail" instruction that encourages invention
6. Add duplicate story detection across sources:
   - Before entity extraction, compare the article's core entities (person name + location + event type) against recent news_items (last 7 days)
   - If match found, skip processing

**Validation criteria**: Run the full pipeline on 50 test articles â€” zero fabricated family members, zero broken source links, zero duplicate campaigns for the same person.

---

### Milestone 6: Phase Transitions & Mid-Campaign Updates
**Scope**: Sections 6.10, P1-P5

**Deliverables**:
1. Remove phase-transition detection from `update-phases` cron (simulation-engine handles it).
2. Add scheduled "organizer updates" between phases:
   - Every 3-5 days, if no phase transition occurred
   - Update types: thank-you, story-development, milestone, community-response
   - Context-rich prompts with campaign age, donor count, recent messages
3. Add update post variety:
   - Titles should not follow a single pattern
   - Some updates should be from the "organizer," others from the "editorial team"
4. Story development updates (for campaigns active > 7 days):
   - Simulate story evolution: "Billy is out of surgery," "The family has found temporary housing"
   - Flag these as AI-generated story developments, not verified facts

**Validation criteria**: A campaign active for 20 days should have 6-8 updates (4 phase transitions + 2-4 organizer updates). No two updates should have the same title pattern.

---

### Milestone 7: Monitoring, Cost Control & Operational Maturity
**Scope**: Cross-cutting operational concerns

**Deliverables**:
1. Cost tracking:
   - Log AI token usage per call (input + output tokens)
   - Dashboard showing daily/weekly AI spend
   - Alert if daily spend exceeds threshold
2. Simulation quality dashboard:
   - Distribution of active campaigns by category, age, percentage
   - Donation velocity chart (donations per hour over last 7 days)
   - Message pool health (remaining unused messages per campaign)
   - Donor name repetition detection
3. Pipeline health monitoring:
   - RSS feed success/failure tracking
   - Classification accuracy sampling (admin can review + override AI classifications)
   - Entity extraction quality scoring (admin can flag bad extractions)
4. Graceful degradation:
   - If AI calls fail, skip message generation (don't block donation simulation)
   - If all news sources fail, alert admin but don't crash
   - Rate limit news ingestion if campaign creation exceeds 10/day

**Validation criteria**: Admin dashboard shows real-time pipeline health. AI spend is tracked and alertable.

---

## Appendix A: Donation Amount Distribution (Real-World Reference)

Based on publicly available GoFundMe campaign data and crowdfunding research:

| Amount | Approximate % of Donations | Notes |
|--------|--------------------------|-------|
| $5-$15 | 5% | Minimum donations, often from young donors |
| $20-$25 | 30% | Most common amount |
| $50 | 25% | Second most common |
| $100 | 18% | "Standard generous" donation |
| $150-$200 | 7% | Above-average |
| $250 | 5% | Significant contribution |
| $500 | 4% | Major donation |
| $1,000 | 3% | Rare but impactful |
| $2,500-$5,000 | 2% | Organization/wealthy individual |
| $5,000+ | 1% | Exceptional |

Note: Distribution shifts based on campaign type. Military/first-responder campaigns skew higher. Essential-needs skew lower.

---

## Appendix B: Campaign Lifecycle Comparison

### GoFundMe Typical Campaign (Firefighter LODD)
```
Hour 0:    Created by union rep. $50K goal. 3 photos, 800-word story.
Hour 1:    20 donations from local fire dept. Average $75. All from same city.
Hour 3:    Shared on department Facebook. 50 more donations. $8K raised.
Hour 6:    Local news picks up story. 100 donations. $18K raised.
Hour 12:   State fire marshal shares. 200 total donors. $28K raised.
Hour 24:   National fire blog covers it. $42K raised. Surge of $100+ donations.
Hour 36:   Organizer posts update: "The family is overwhelmed by the support."
Hour 48:   Goal reached. $52K raised (104%). 450 donors.
Day 3:     Overfunding continues. $58K raised.
Day 5:     Organizer posts: "Funds will cover funeral, children's education fund."
Day 7:     Campaign closes to new donations. $61K final.
Day 14:    Organizer posts disbursement update with photo of family.
```

### Current Simulation (Same Scenario)
```
Hour 0:    Campaign auto-published. AI-generated story, no photos beyond news thumbnail.
Hour 0:15: Maybe 1 donation from random location. $50.
Hour 0:30: Maybe 1 more. $25.
Hour 1:00: Maybe 1 more. $100.
...
Day 1:     ~8-10 donations. $500 raised (1% of goal).
Day 7:     ~60 donations. $4,000 raised (8%).
Day 21:    ~180 donations. $15,000 raised (30%).
Day 45:    ~350 donations. $35,000 raised (70%).
Day 60:    ~450 donations. $50,000 raised (100%).
           Status â†’ completed. Generic 2-sentence update.
           No last donor identified. No celebration.
```

The gulf between these two timelines reveals why trajectory profiles, local clustering, and surge mechanics are essential.

---

## Appendix C: Message Quality Comparison

### Real GoFundMe Messages (Firefighter Campaign)
```
"We love you, Smith family. Engine 12 stands with you."
"Johnny was the best. God rest his soul."
"From one fire family to another â€” we've got you."
"My husband served with John for 8 years. No words. Just love."
"St. Cloud FD sending prayers and support."
"saw this on the news. had to help."
"THIS IS WHAT COMMUNITY LOOKS LIKE ðŸ”¥â¤ï¸"
"I didn't know John but I know what firefighters sacrifice. Thank you."
"My 7-year-old emptied his piggy bank for this. $11.37. He says firefighters are heroes."
"Class of 2015 Fire Academy â€” we remember you, brother."
"Just want the family to know â€” we see you. We won't forget."
```

### Current AI-Generated Messages (Typical Output)
```
"Praying for you and your family"
"Stay strong! ðŸ™"
"God bless you"
"Thoughts and prayers from Texas"
"Sending love from California"
"You got this!"
"Hope this helps"
"Such a sad situation. Praying for recovery."
"From one veteran to another, stay strong brother"
"May God watch over your family"
```

**Key differences**:
1. Real messages reference specific people, units, shared experiences
2. Real messages have emotional weight that comes from personal connection
3. Real messages vary enormously in tone and structure
4. AI messages are generic, interchangeable between any campaign
5. AI messages lack the specificity of local knowledge ("Engine 12," "Class of 2015")
6. AI messages don't reference the campaign's momentum or other donors

---

*End of analysis. This document should serve as the authoritative reference for the simulation improvement program. All code changes should trace back to a specific weakness identified here.*
