# LastDonor.org - Product Requirements Document (PRD)

**Version**: 0.1 (Pre-Development)
**Date**: March 19, 2026
**Status**: Draft

---

## 1. Problem Statement

Millions of US service members, disaster victims, medical emergency patients, first responders, and people in crisis need financial support. Existing platforms (GoFundMe, GiveSendGo) are generic - anyone can post anything, there's no editorial curation, no institutional trust, and no follow-through on impact reporting.

Donors don't trust random campaigns. They want:
- Verified stories about real people
- Proof their money reached someone
- A reason to come back

There is no platform that combines **editorially curated, story-driven fundraising** with **gamified completion mechanics** and **radical financial transparency**.

## 2. Solution

**LastDonor.org** - a nonprofit fundraising platform where every campaign is:
- Tied to a **real, verified person or cause**
- Driven by a **relatable human story**, not jargon
- Tracked with a **visible progress bar** toward a specific goal
- Closed by a **"Last Donor"** - the person whose donation hits the target

**Tagline**: *"You're the reason it's done."*

## 3. Target Audience

- **Primary**: US citizens, ages 25-65, who care about military families, veterans, first responders, disaster relief, medical emergencies, and community causes
- **Secondary**: Military families, veteran communities, first responder families, civic-minded Americans
- **Psychographic**: People who donate when they trust the recipient and see where their money goes. Skeptical of generic charity. Responsive to personal stories.

## 4. Core Features - MVP

### 4.1 Campaign System
- Each campaign has: title, hero image, story (3-5 paragraphs), funding goal, progress bar, donation tiers with impact labels
- Campaign phases: First Believers (0-25%), The Push (25-60%), Closing In (60-90%), Last Donor Zone (90-100%)
- Donor badges per phase: First Believer, Momentum Builder, Closer, Last Donor
- Campaign updates timeline (posted by editorial team)
- Recent donor feed with optional messages
- Share buttons (Facebook, X, copy link, email)
- Campaign status: Active, Last Donor Zone, Completed, Archived

### 4.2 Donation System
- Stripe integration for payment processing
- Preset amounts ($25, $50, $100) with impact descriptions
- Custom amount option
- Recurring monthly donation option
- Guest checkout (no account required to donate)
- Tax receipt emailed automatically
- Donor dashboard (for registered users): history, impact updates, badges

### 4.3 Homepage
- Hero section: featured campaign with full-width photo, headline, tagline, CTA
- Trust bar: "501(c)(3) · 100% transparent · X donors and counting"
- Active campaigns grid (3-5 cards with photos, progress bars, donate buttons)
- Impact counter: total raised, people supported, campaigns completed
- "Where Your Money Goes" breakdown (visual)
- Latest stories / blog preview
- Newsletter signup
- Sticky mobile donate bar on campaign pages

### 4.4 Story/Blog System
- Blog with categories: Campaign Stories, Impact Reports, News
- Author bios
- Rich media support (images, embedded video, infographics)
- Newsletter integration

### 4.5 User Accounts (Optional for Donors)
- Register with email
- Donor profile: badges earned, campaigns supported, total given
- Last Donor Wall: hall of fame for donors who closed campaigns
- Notification preferences

### 4.6 Admin / Editorial Backend
- Campaign creation and management
- Story/blog editor (rich text)
- Donor and donation management
- Campaign update posting
- Analytics dashboard: donations, traffic, conversion rates
- News feed monitor (RSS from DVIDS, Stars and Stripes, Military Times, GNews API for disaster/medical/community events)

### 4.7 Dark Mode
- Full dark mode toggle
- Persisted in user preference / local storage

## 5. Features - Post-MVP

- Discussion forum (Discourse integration)
- Donor leaderboards (monthly, all-time)
- Corporate matching program
- Ambassador program
- Campaign nomination by community
- Automated news-to-campaign pipeline (AI-assisted)
- Mobile app (React Native)
- Multilingual support
- SMS donation

## 6. Non-Functional Requirements

- Page load: < 2 seconds on 4G mobile
- Uptime: 99.9%
- Security: OWASP Top 10 compliance, PCI compliance via Stripe
- Accessibility: WCAG 2.1 AA
- Privacy: GDPR-aware, CCPA compliant, privacy-first analytics
- SEO: Server-side rendering, structured data, OpenGraph tags

## 7. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Campaigns launched | 15-20 |
| Campaigns fully funded | 10+ |
| Total donations | $100,000+ |
| Unique donors | 2,000+ |
| Returning donors | 30%+ |
| Email subscribers | 5,000+ |
| Average donation | $40-60 |
| Campaign completion rate | 70%+ |

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low initial trust (new brand) | Donors won't give | 501(c)(3) registration, transparency page, advisory board, testimonials from early supporters |
| Campaign fraud accusations | Reputation destruction | Editorial vetting, source verification, financial transparency reports |
| Low traffic at launch | No donations | Pre-launch email list, social media campaign, PR outreach to military/veteran communities |
| Payment processing issues | Lost revenue | Stripe (proven reliability), fallback processor |
| Content production bottleneck | Stale campaigns | RSS pipeline for story ideas, content calendar, template-based campaign creation |

## 9. Open Decisions

- [ ] Legal entity type: 501(c)(3) vs fiscal sponsorship vs LLC
- [ ] Fund disbursement model: direct to families, through partner orgs, or hybrid
- [ ] Logo design: finalize
- [ ] Domain registration: confirm lastdonor.org availability
- [ ] First 3 campaigns: identify and source stories
- [ ] Advisory board: recruit 3-5 credible names
