# LastDonor.org — Content Strategy

**Version**: 0.1 (Pre-Development)
**Date**: March 19, 2026
**Status**: Draft

---

## 1. Content Pillars

Everything published on LastDonor falls under one of three pillars:

| Pillar | Purpose | Format |
|--------|---------|--------|
| **Campaign Stories** | Drive donations. The core product. | Campaign pages with hero image, story, progress bar |
| **Impact Reports** | Build trust. Prove money was used. | Blog posts, infographics, financial breakdowns |
| **Context / News** | Educate. Explain why campaigns exist. | Blog posts, short explainers, data visualizations |

No content exists for its own sake. Every piece either **drives a donation**, **proves we're trustworthy**, or **explains why the cause matters**.

---

## 2. Campaign Story Template

Every campaign follows this structure. No exceptions.

### Section 1: The Hook (above the fold)
- Hero image (face visible)
- Headline: person's name + the need (e.g., "Sgt. Pennington gave everything. His family shouldn't have to.")
- Progress bar + goal
- Donate CTA

### Section 2: Meet Them (paragraph 1)
- First name, age, hometown
- One personal detail that makes them human (not military rank, not job title)
- Example: "Ben Pennington was 26, from Glendale, Kentucky. He married his high school sweetheart the summer after enlisting."

### Section 3: The Situation (paragraph 2-3)
- What happened to them — injury, deployment, loss, disaster
- Written in plain English, no jargon
- Sourced: link to the news report, DoD announcement, or official source
- Example: "On March 9, the Department of War confirmed Ben was killed supporting Operation Epic Fury."

### Section 4: The Gap (paragraph 4)
- What they or their family need that they don't have
- Be specific: dollar amounts, specific needs
- Example: "Ben's wife Ashley is now raising their two children alone. The military death benefit covers basics, but not the mortgage Ben co-signed, or the medical bills from his daughter's asthma treatment."

### Section 5: The Ask (donation section)
- Tied directly to the person: "Help Ashley and her kids"
- Impact tiers: "$25 covers a week of groceries for Ashley's family"
- Progress bar + recent donors + share buttons

### Section 6: Updates (ongoing)
- Posted by editorial team as campaign progresses
- Milestones: 25%, 50%, 75%, Last Donor Zone
- Impact update after completion: "Here's where the money went"

### Story Rules
1. Every claim must have a source (DoD announcement, news article, family confirmation)
2. All names used with explicit permission from family or from public DoD announcements
3. Representative/composite stories are clearly labeled as such
4. No exploitation — strength and dignity, not helplessness
5. Every story reviewed by at least one editor before publishing

---

## 3. Story Sourcing Pipeline

### Tier 1: Official & Structured Sources (Verified, Fast)

#### Military / Veterans
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| DVIDS (dvidshub.net) | Casualty reports, human interest stories, photos | RSS | Daily |
| Defense.gov | DoD announcements, deployment news, KIA notifications | RSS | Daily |
| Stars and Stripes | On-the-ground stories, service member profiles | RSS | Daily |
| Military Times | Branch-specific stories, family stories | RSS | Daily |

#### First Responders
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| ODMP (odmp.org) | Law enforcement line-of-duty deaths (LODD), officer names, agencies, families | RSS + scrape | Daily |
| USFA Firefighter Fatalities (apps.usfa.fema.gov) | Firefighter fatalities — name, department, city, date, cause | RSS feed + CSV API | Daily |
| Firehouse.com (LODDs section) | Firefighter line-of-duty deaths, injuries, department news | RSS | Daily |
| FireRescue1.com | Fire/EMS line-of-duty deaths, first responder injuries | RSS | Daily |
| PoliceOne / Police1.com | Law enforcement injuries, LODDs, officer-involved incidents | RSS | Daily |
| National Fallen Firefighters Foundation (firehero.org) | Fallen firefighter memorials, survivor stories | Manual | Weekly |

#### Disaster Relief
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| FEMA Disaster Declarations (fema.gov/disaster/declarations) | Federally declared disasters — type, location, date, affected counties | JSON API | Daily |
| National Weather Service (weather.gov/alerts) | Severe weather alerts — tornadoes, hurricanes, floods, wildfires | RSS / API | Every 30 min |
| ReliefWeb (reliefweb.int) | Humanitarian disaster reports, US-specific | RSS | Daily |
| NIFC (nifc.gov) | Active wildfire incidents, locations, acreage | RSS + GeoJSON | Daily |
| GNews API | "house fire", "apartment fire", "tornado damage", "flood victims", "wildfire evacuation" | REST API | Every 30 min |

#### Medical & Health
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| GNews API | "can't afford surgery", "medical bills", "cancer diagnosis fundraiser", "uninsured accident", "hospital bills" | REST API | Every 30 min |
| Local TV station RSS feeds | Human-interest medical stories, community rallies around sick individuals | RSS (50+ stations) | Daily |
| CaringBridge (caringbridge.org) | Public health journey updates (for story leads only — verify independently) | Manual | Weekly |

#### Memorial / Funeral
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| GNews API | "can't afford funeral", "funeral fundraiser", "GoFundMe funeral", "burial costs" | REST API | Every 30 min |
| Local news RSS | Unexpected deaths, families struggling with funeral costs, young parent deaths | RSS | Daily |
| ODMP + USFA feeds | First responder LODDs (cross-category — these also generate memorial campaigns) | RSS | Daily |

#### Community & Crisis (DV, Crime Victims, Accidents, Housing)
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| GNews API | "hit by drunk driver", "shooting victim family", "house fire family", "domestic violence survivor", "eviction" | REST API | Every 30 min |
| FBI UCR / NIBRS (crime-data-explorer.fr.cloud.gov) | Crime victim statistics by region (for context pieces, not individual campaigns) | API | Monthly |
| NCADV (ncadv.org) | DV survivor stories, shelter referrals, statistical context | Manual | Weekly |
| Local news RSS | Accident victims, crime victims, families displaced, eviction crises | RSS | Daily |

#### Essential Needs
| Source | What to Look For | Method | Frequency |
|--------|-----------------|--------|-----------|
| GNews API | "can't pay rent", "utility shutoff", "family needs help", "food insecurity", "job loss" | REST API | Every 30 min |
| 211.org / United Way | Crisis referral data by region (identifies areas of high need) | Manual | Weekly |
| Local news RSS | Job loss stories, plant closures, families in crisis | RSS | Daily |

### Tier 2: Community Submissions
- "Share Your Story" page on the site — open to all categories
- Military family organizations and veteran groups
- First responder unions, FOP lodges, IAFF locals
- Hospital social workers and patient advocates
- DV shelter referrals (with survivor consent)
- Community organizations and churches
- Social media outreach across all cause communities
- All submissions verified before publishing

### Tier 3: News-Triggered Campaigns
- General news (AP, Reuters, GNews API) triggers awareness
- Editorial team / AI researches the specific people affected
- Campaign built around the individual, not the headline
- Cross-category: a single news event can generate multiple campaign types (e.g., house fire → disaster campaign + funeral campaign if someone died)

### From News to Campaign: Process

```
1. News item flagged (RSS feed, API, or manual)
        │
2. AI classifies: Category + relevance score (0-100)
   Is this about a real person in need? Which category?
        │
3. AI or editor researches: Who is affected? What's the name?
   Can we find the family? Is there an official source?
        │
4. If names/details are public → Draft campaign story
   If not → Monitor for updates or build composite
        │
5. Story written using template (Section 2 above)
        │
5. Editor review: facts checked, tone checked, sources linked
        │
6. Campaign goes live with initial goal
        │
7. Social media + email blast
        │
8. Weekly updates posted until campaign closes
```

---

## 4. Blog Content Calendar (First 3 Months)

### Month 1: Launch
| Week | Post | Pillar | Purpose |
|------|------|--------|---------|
| 1 | "Why We Built LastDonor" — origin story | Context | Establish mission and credibility |
| 1 | "Where Your Money Goes" — transparency breakdown | Impact | Build trust before first donation |
| 2 | Campaign Story #1 (launch campaign) | Campaign | First campaign, first donations |
| 3 | Campaign Story #2 | Campaign | Second active campaign |
| 4 | "How We Verify Every Story" — editorial standards | Impact | Trust building |

### Month 2: Build
| Week | Post | Pillar | Purpose |
|------|------|--------|---------|
| 1 | Campaign Story #3 | Campaign | Expand active campaigns |
| 2 | First Impact Report — "Your Donations in Action" | Impact | Close the loop for early donors |
| 3 | Context piece about current deployment/operation | Context | SEO + education |
| 4 | Campaign Story #4 | Campaign | Pipeline |

### Month 3: Grow
| Week | Post | Pillar | Purpose |
|------|------|--------|---------|
| 1 | "Meet Our First Last Donor" — profile the person who closed Campaign #1 | Impact | Celebrate the mechanic, social proof |
| 2 | Campaign Story #5 | Campaign | Pipeline |
| 3 | Context piece about military families / first responders / disaster preparedness | Context | SEO + emotional resonance |
| 4 | Monthly Impact Report #2 | Impact | Ongoing trust |

---

## 5. Newsletter Strategy

### Format
- **Frequency**: Weekly (Thursdays — highest open rates for nonprofit)
- **Subject line formula**: First name of campaign subject + what happened
  - Example: "Ashley needs help. Ben isn't coming home."
  - Never: "LastDonor Weekly Newsletter #4"
- **Length**: 3 sections, ~300 words total

### Newsletter Template
```
1. FEATURED CAMPAIGN (50% of email)
   - Photo
   - 3-sentence story
   - Progress bar (static image)
   - [DONATE TO THIS CAMPAIGN] button

2. IMPACT UPDATE (30% of email)
   - "Last week, 47 donors raised $3,200 for Maria's family."
   - Or: "Campaign X just entered the Last Donor Zone."

3. ONE THING TO KNOW (20% of email)
   - Short context/education item
   - Or: "Read Ashley's full story on our blog"
```

### Growth Tactics
- Homepage signup: "One story a week. See your impact." + email field
- Post-donation signup: "Want to see where your $50 goes? Get updates."
- Blog footer: signup on every article
- Campaign share pages: "Know someone who'd care? Forward this."

### Metrics to Track
| Metric | Target |
|--------|--------|
| Open rate | 35%+ (nonprofit average is ~25%) |
| Click rate | 5%+ |
| Unsubscribe rate | < 0.5% per send |
| Donation conversion from email | Track via UTM parameters |

---

## 6. Social Media Strategy

### Platforms (Priority Order)
1. **Facebook** — Largest US demographic for charitable giving (35-65 age group). Share campaigns, stories, impact reports.
2. **Instagram** — Visual storytelling. Campaign photos, infographics, progress milestones.
3. **X (Twitter)** — News engagement, rapid response to military/disaster/medical news, connect with veteran/military/first responder community.
4. **TikTok** — Phase 2. Short-form video storytelling for younger donors (18-35).
5. **YouTube** — Phase 2. Long-form: Town Halls, impact documentaries, veteran interviews.

### Content Per Platform

| Platform | Post Frequency | Content Type |
|----------|---------------|-------------|
| Facebook | 4-5x / week | Campaign stories, progress updates, impact reports, share prompts |
| Instagram | 3-4x / week | Campaign photos, infographic cards, milestone celebrations |
| X | Daily | Quote from stories, news reactions, campaign links, community engagement, disaster alerts |

### Social Post Templates

**New Campaign Launch:**
> [Photo]
> Ben Pennington was 26, from Glendale, Kentucky.
> He gave his life for this country.
> His family shouldn't bear the cost alone.
> Help Ashley and her kids → lastdonor.org/ben
> #LastDonor

**Milestone Hit:**
> [Progress bar image]
> 🔥 72% funded — only $8,400 to go.
> Who's going to be the Last Donor?
> → lastdonor.org/ben

**Campaign Completed:**
> [Photo of family or thank-you message]
> DONE. $30,000 raised. 347 donors. 1 Last Donor.
> Sarah T. from Texas closed it.
> You're the reason it's done.
> Read the impact → lastdonor.org/ben/complete

---

## 7. SEO Strategy

### Target Keywords
| Keyword Cluster | Pages |
|----------------|-------|
| "donate to military families" | Homepage, campaign pages |
| "help military families in need" | Campaign pages, blog |
| "disaster relief donation" | Campaign pages, blog |
| "medical fundraiser" | Campaign pages, blog |
| "first responder charity" | Campaign pages, blog |
| "funeral fundraiser" | Campaign pages, blog |
| "help family after house fire" | Campaign pages, blog |
| "military donation charity" | About page, homepage |
| "lastdonor" (branded) | All pages |
| "[Person name] fundraiser" | Individual campaign pages |
| "where to donate for [event]" | Blog posts tied to news events |

### Technical SEO
- All campaign pages server-side rendered with full meta tags
- Unique title + description per campaign
- OpenGraph image generated per campaign (for social sharing)
- Structured data: Organization, DonateAction, Article schemas
- Sitemap auto-generated
- Canonical URLs on all pages
- Fast load times (< 2s) — Google ranking factor

### Content SEO
- Blog posts targeting long-tail keywords around military support, medical emergencies, disaster relief, first responders, funeral costs, donation transparency, and specific operations
- Each campaign page naturally ranks for "[person name]" + "fundraiser"
- Impact reports rank for "charity transparency" and "where donations go" keywords

---

## 8. Content Production — Who Does What

### MVP Team (Minimum Viable)
| Role | Responsibility | Person |
|------|---------------|--------|
| **Editor** | Write campaign stories, blog posts, newsletter, review submissions | 1 person (founder or hire) |
| **Developer** | Build and maintain the site, CMS, integrations | 1 person (founder or hire) |

### Content Workflow
```
Story idea (from RSS feed, submission, or current events)
    │
    ▼
Editor drafts campaign story using template
    │
    ▼
Fact-check: verify against official sources
    │
    ▼
Select imagery from DVIDS or approved sources
    │
    ▼
Publish campaign page
    │
    ▼
Push to newsletter + social media
    │
    ▼
Monitor donations, post updates weekly
    │
    ▼
Campaign completes → publish impact report
```

### AI-Assisted Content (Where Appropriate)
- AI can draft initial campaign stories from news sources — **always human-reviewed and edited**
- AI can suggest headlines, social captions — **always human-approved**
- AI never publishes autonomously
- AI-generated content is never labeled as "written by" a human author
