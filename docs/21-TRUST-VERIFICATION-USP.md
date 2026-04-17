# 21 â€” Trust, Verification & Accountability USP

> **Purpose**: Define LastDonor.org's core Unique Selling Proposition â€” the most rigorous campaign verification, milestone-based fund release, proactive donor protection, and multi-channel human support system in the crowdfunding industry. This document serves as the exhaustive implementation specification.

> **Date**: March 27, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Industry Problem Analysis](#2-industry-problem-analysis)
3. [Competitive Landscape & Benchmarks](#3-competitive-landscape--benchmarks)
4. [USP Statement](#4-usp-statement)
5. [Pillar 1 â€” Campaign Verification System](#5-pillar-1--campaign-verification-system)
6. [Pillar 2 â€” Milestone-Based Fund Release](#6-pillar-2--milestone-based-fund-release)
7. [Pillar 3 â€” Campaign Lifecycle Transparency](#7-pillar-3--campaign-lifecycle-transparency)
8. [Pillar 4 â€” Donor Protection & Refund System](#8-pillar-4--donor-protection--refund-system)
9. [Pillar 5 â€” Admin Autonomy & Campaign Governance](#9-pillar-5--admin-autonomy--campaign-governance)
10. [Pillar 6 â€” Multi-Channel Human + AI Support](#10-pillar-6--multi-channel-human--ai-support)
11. [Database Schema Changes](#11-database-schema-changes)
12. [API Specifications](#12-api-specifications)
13. [Email Templates & Notification Matrix](#13-email-templates--notification-matrix)
14. [Admin UI Specifications](#14-admin-ui-specifications)
15. [Implementation Phases & Milestones](#15-implementation-phases--milestones)
16. [Security & Compliance](#16-security--compliance)
17. [Metrics & Success Criteria](#17-metrics--success-criteria)

---

## 1. Executive Summary

The single greatest weakness of existing crowdfunding platforms is **trust**. Trustpilot ratings reveal a damning pattern: the largest platforms â€” GoFundMe (3.2â˜…, 57% one-star reviews), JustGiving (2.9â˜…), GiveSendGo (2.7â˜…) â€” are also the worst-rated. Meanwhile, smaller platforms that prioritize transparency and human support â€” SpotFund (4.7â˜…), WhyDonate (4.8â˜…), Zeffy (4.5â˜…) â€” prove that trust-first architecture earns user loyalty. Fake campaigns, misappropriated funds, zero accountability, hidden fees, and opaque fund usage erode donor confidence across the market leaders.

LastDonor.org will differentiate with a **Trust-First Architecture** built on six pillars:

| # | Pillar | Core Principle |
|---|--------|---------------|
| 1 | **Campaign Verification** | Every campaign undergoes document-backed identity and story verification by human auditors before going live |
| 2 | **Milestone-Based Fund Release** | Funds are released in 3 phases tied to campaigner-defined milestones with evidence requirements |
| 3 | **Campaign Lifecycle Transparency** | Real-time status visibility (paused, cancelled, completed) with hover-tooltips, status badges, and donor email updates |
| 4 | **Donor Protection & Refunds** | Cancelled campaigns trigger automatic full refunds with personalized re-engagement emails |
| 5 | **Admin Autonomy** | Admin has full campaign governance â€” delete, pause, suspend, activate, request info â€” with automated communication |
| 6 | **Multi-Channel Human + AI Support** | WhatsApp, email, site chat, phone, and social media support with guaranteed response SLAs |

---

## 2. Industry Problem Analysis

### 2.1 The Trust Crisis in Crowdfunding â€” By the Numbers

Trustpilot data reveals the industry's trust problem in stark terms:

| Platform | Trustpilot Rating | Reviews | 1-Star % | Key Complaint |
|----------|------------------|---------|----------|---------------|
| GoFundMe | 3.2â˜… | 24,000+ | 57% | Fund withdrawal delays, hidden tip defaults, account suspensions |
| JustGiving | 2.9â˜… | 7,000+ | ~60% | 17% tip slider that won't go to zero, owned by Blackbaud ($3B+ company, Â£31M profit) |
| GiveSendGo | 2.7â˜… | 615+ | ~65% | Content moderation failures, confusing "send" terminology, no fraud prevention |
| Beggingmoney | 2.3â˜… | 83 | ~70% | Outright scam reports |

**Contrast â€” platforms that get trust RIGHT:**

| Platform | Trustpilot Rating | Reviews | 5-Star % | Why They Win |
|----------|------------------|---------|----------|-------------|
| **WhyDonate** | **4.8â˜…** | 315+ | 88% | Named agents (Akshit, Vaibhav, Rushikesh, Sonali), WhatsApp support, 100% negative review response rate |
| **SpotFund** | **4.7â˜…** | 1,650+ | 88% | 0% platform fee, next-day payouts, proactive human support, no AI gatekeeping |
| **Zeffy** | **4.5â˜…** | 3,000+ | ~85% | 100% free (no fees at all, even CC), optional donor tips fund the platform |
| **Givebutter** | **4.3â˜…** | G2 #1 rated | ~80% | Free CRM + fundraising tools, 24/7 live chat support |
| **GoGetFunding** | **4.3â˜…** | 429 | ~75% | Simple setup, reliable payouts |

### 2.2 The 5 Universal Pain Points (from Trustpilot, Reddit, SiteJabber)

| # | Pain Point | Verbatim Evidence | Platforms Affected |
|---|-----------|-------------------|-------------------|
| 1 | **Hidden/deceptive fees** | *"GoFundMe defaulted me into a recurring 'tip' I never agreed to"* â€” Reddit r/personalfinance | GoFundMe, JustGiving |
| 2 | **Fund withdrawal nightmares** | *"My campaign raised $5,000 but GoFundMe held my funds for 3 weeks wanting more documents"* â€” Trustpilot | GoFundMe, GiveSendGo |
| 3 | **Zero customer support** | *"GiveSendGo has literally no phone number or chat. You submit a form and pray"* â€” SiteJabber | GiveSendGo, GoFundMe |
| 4 | **Scam proliferation** | *"I donated $200 to a campaign for a family that turned out to not exist. GoFundMe took weeks to investigate"* â€” Trustpilot | GoFundMe, GiveSendGo |
| 5 | **Lack of transparency** | *"Where does my money actually go? No updates, no proof, just 'trust us'"* â€” Reddit r/charity | Industry-wide |

### 2.3 Campaigner Pain Points (Often Overlooked)

| # | Pain Point | Evidence | Impact |
|---|-----------|----------|--------|
| 1 | **Account suspensions without explanation** | *"GoFundMe closed my campaign at $3,000 with ZERO explanation. No email, no phone, nothing."* | Campaigners lose faith, switch platforms |
| 2 | **Verification gatekeeping** | Some platforms reject campaigns without clear criteria | Legitimate campaigns blocked |
| 3 | **No real-time donation reports** | Campaigners can't see who donated or generate tax-ready reports | Manual tracking required |
| 4 | **Recurring fees charged to donors without consent** | GoFundMe's default "tip" auto-recurs monthly | Donors blame campaigners |
| 5 | **Geographic restrictions** | Many platforms US/UK-only or require local bank accounts | Global campaigns impossible |

### 2.4 What Donors Actually Want (Research Findings)

Based on analysis of donor trust research (Nonprofit Source, Charity Navigator donor surveys, BBB Wise Giving Alliance) and Trustpilot review sentiment:

1. **Transparency** â€” 73% of donors say "knowing exactly how funds are used" is their #1 concern
2. **Accountability** â€” 68% want regular updates with evidence of fund usage
3. **Verification** â€” 61% would donate more if campaigns were independently verified
4. **Refund assurance** â€” 82% say guaranteed refund on fraudulent campaigns would increase confidence
5. **Human contact** â€” 56% want the ability to reach a real person, not just a chatbot (SpotFund and WhyDonate prove this works â€” *"It was so refreshing to communicate with a real person who was responsive and genuinely helpful"* â€” SpotFund Trustpilot)
6. **Ongoing updates** â€” 77% want to see progress updates after donating
7. **No hidden fees** â€” *"I love how 100% of your donation goes directly to the cause"* â€” SpotFund Trustpilot (most-praised feature of high-rated platforms)
8. **Fast payouts** â€” *"Funds available 2 business days after closing fundraiser"* â€” SpotFund Trustpilot; WhyDonate offers instant payouts

---

## 3. Competitive Landscape & Benchmarks

### 3.1 Platform-by-Platform Analysis

#### GoFundMe (Market Leader by Volume â€” ~$30B raised, BUT 3.2â˜… Trustpilot)

> **Critical context**: GoFundMe is the *largest* platform by volume, but NOT the most reputable. With a 3.2â˜… Trustpilot rating and 57% one-star reviews, it represents what NOT to do with trust and support. The platforms to learn from are SpotFund (4.7â˜…) and WhyDonate (4.8â˜…).
| Feature | Implementation | Gap |
|---------|---------------|-----|
| Verification | GoFundMe Guarantee â€” reactive (post-fraud detection), reviews after reports | No proactive verification before campaign launch |
| Fund Release | Immediate transfer to campaigner bank account | Zero milestone accountability |
| Refunds | Case-by-case review; 7-14 day processing | No automatic refund on cancellation |
| Status Transparency | Active / Ended â€” two states only | No paused, under-review, or suspended states |
| Support | Email-only + help center articles; no phone or chat | No human-first support |
| Updates | Optional â€” campaigners choose whether to post updates | No update enforcement |
| **GoFundMe Guarantee** | Refunds donors if fraud proven; covers up to $1,000 per donation | Reactive, not preventive; limited coverage |

#### GiveSendGo (Faith-based alternative)
| Feature | Implementation | Gap |
|---------|---------------|-----|
| Verification | Self-attestation only; no document verification | Essentially no verification |
| Fund Release | Immediate; uses Stripe Connect for direct payouts | Zero milestone accountability |
| Refunds | "If a campaign is found to be fraudulent... funds may be returned" â€” no guarantee | Vague refund policy |
| Support | Email contact form only | No live support channels |
| Transparency | Active / Completed | Minimal status granularity |

#### JustGiving (UK market leader)
| Feature | Implementation | Gap |
|---------|---------------|-----|
| Verification | Charity verification for nonprofits; individual campaigns not verified | Individual campaign fraud still possible |
| Fund Release | Direct to registered charities | No milestone tracking for individual campaigns |
| Support | Email + limited phone (UK business hours) | Better than most, but still limited |
| Updates | Available but not required | Optional updates |

#### GlobalGiving (Vetted nonprofits only)
| Feature | Implementation | Gap |
|---------|---------------|-----|
| Verification | **Strongest**: Organizations must pass a due diligence process, submit financials, provide references | Only works for registered nonprofits, not individual campaigns |
| Fund Release | Milestone-based for organizations; progress reports required | Individual emergency campaigns not supported |
| Support | Dedicated account manager for vetted orgs | Not available to individual donors |
| Transparency | Detailed project reports required quarterly | Best-in-class for nonprofits, not applicable to individuals |

#### Ketto (India â€” largest Asian platform)
| Feature | Implementation | Gap |
|---------|---------------|-----|
| Verification | Aadhaar-based identity verification (India-specific) | Limited to Indian campaigns |
| Fund Release | Direct to bank with basic KYC | No milestone tracking |
| Support | Phone + WhatsApp + email | Best multi-channel support in the industry |
| Refunds | 7-day refund window; active support via phone | Time-limited refund window |

#### Milaap (India â€” social impact)
| Feature | Implementation | Gap |
|---------|---------------|-----|
| Verification | Hospital verification for medical campaigns; ID verification for all | Strongest individual verification among Asian platforms |
| Fund Release | Bank verification required; funds released after basic verification | No milestone-based release |
| Support | Dedicated fundraising expert assigned per campaign | Best human-touch model |
| Updates | Mandatory updates for verified campaigns | Updates required but not tied to fund release |

#### SpotFund (Highest-Rated US Platform â€” 4.7â˜…, 1,650+ reviews)

> **Model platform**: SpotFund proves that 0% platform fees + proactive human support + fast payouts = exceptional trust scores. This is the primary US-market benchmark for LastDonor.

| Feature | Implementation | What We Learn |
|---------|---------------|---------------|
| **Fees** | 0% platform fee; only CC processing (2.9% + $0.30); optional donor tip funds the platform | Transparency about fees is the #1 trust driver. Donors repeatedly praise "100% goes to the cause" |
| **Payouts** | Next-business-day payouts; campaigners can request payout while campaign is still active | Fast payouts eliminate the #2 pain point (fund withdrawal delays). *"Deposit in the bank within just one business day!"* |
| **Support** | Human-first email + SMS support; named agents (Maria Tillerson); proactive outreach to new campaigners | *"As soon as I created the funding page, someone from customer service emailed me and guided me through the process"* â€” SpotFund IS the model for proactive support |
| **AI Policy** | No AI gatekeeping; human agents handle all issues | *"Customer service is one of the best and I don't have to deal with AI"* â€” real human interaction is what donors and campaigners value most |
| **Verification** | Basic identity verification; campaigns can be paused for review | Weakness: no document-backed story verification. LastDonor can surpass with T1/T2 system |
| **Refunds** | Case-by-case handling | Weakness: no automatic refund guarantee. LastDonor's automatic refund on cancellation is a clear differentiator |
| **Transparency** | Campaign page shows real-time donation tracking, optional donor tips clearly labeled | *"I love how you can watch the total go up and how they state about all the fees being credit card processing"* |
| **Trustpilot engagement** | Replies to 48% of negative reviews within 1 week | Good but not best-in-class (WhyDonate: 100%) |
| **User praise themes** | Easy setup, transparent fees, fast payouts, human support, compared favorably to GoFundMe | *"I'm impressed. I like this platform more than GoFundMe"* is a recurring theme |

SpotFund weaknesses that LastDonor addresses:
- No milestone-based fund release
- No story document verification (only basic ID)
- No automatic refund guarantee
- Some users report scam campaigns not caught quickly enough: *"They need to focus more on spotfraud"*
- Limited support channels (email + SMS only, no WhatsApp/chat/phone)

#### WhyDonate (Highest-Rated Global Platform â€” 4.8â˜…, 315 reviews, 100% Negative Review Response)

> **Model platform**: WhyDonate demonstrates that named human agents, multi-channel support (especially WhatsApp), and 100% review engagement creates the highest trust in the industry. Founded in 2012 (Amsterdam), serving 80,000+ organizations in 19 languages.

| Feature | Implementation | What We Learn |
|---------|---------------|---------------|
| **Fees** | 0% platform fee; payment processing only (1.9% + â‚¬0.25 for cards; â‚¬0.35 for iDEAL/Bancontact); voluntary donor tip | Lowest processing fees among major platforms. Transparent comparison table on their fees page |
| **Support** | Multi-channel: WhatsApp, live chat, email, scheduled phone appointments; 7 days/week 9-5 CET | *"Very responsive. My request was sent via WhatsApp after working hours. Nevertheless I received a confirmation the next morning"* |
| **Named agents** | Real names in reviews: Akshit, Vaibhav, Rushikesh, Sonali, Anirban â€” customers reference them by name | *"I am so grateful for Vaibhav!"*, *"Akshit provided outstanding support"* â€” this personal touch is WHY they achieve 4.8â˜… |
| **Negative review response** | **100% response rate** to negative reviews typically within 48 hours | Industry-best practice. Even negative reviewers update their reviews upward after responses |
| **Global reach** | 19 languages, 29 currencies, operates across EU/global | *"For everyone, everywhere in the world, in their own language"* |
| **Payouts** | Instant payouts, automatic weekly or monthly payout options | Flexible payout schedules eliminate friction |
| **Custom branding** | White-label fundraising pages, custom donation forms, embeddable widgets | Organizational clients can maintain their own brand identity |
| **Integrations** | Zapier, donation button plugins, QR code generation, Stripe for payments | Modern tech stack |
| **Trustpilot engagement** | 100% negative review response rate; replies within 48 hours | Sets the standard for public review engagement |

WhyDonate weaknesses that LastDonor addresses:
- No milestone-based fund release
- No document-backed verification (relies on Stripe identity verification)
- No automatic refund guarantee on cancellation
- No campaign status transparency beyond active/completed
- Smaller review base (315 vs SpotFund's 1,650+)

### 3.1.1 Emerging Competitors Worth Watching

| Platform | Rating | Reviews | Model | Key Innovation |
|----------|--------|---------|-------|---------------|
| **Zeffy** | 4.5â˜… | 3,000+ | 100% free for nonprofits (zero fees â€” no CC fees, no platform fee, nothing) | Funded entirely by optional donor tips. Proves 100% free model is viable for nonprofits. Includes CRM, ticketing, auctions, raffles |
| **Givebutter** | 4.3â˜… | G2 #1 | Free core + Givebutter Plus ($29/mo) | #1 rated on G2 for fundraising, donor management, and nonprofit CRM. 24/7 live chat. Automated workflows. Broadest free feature set |
| **GoGetFunding** | 4.3â˜… | 429 | 4% platform fee + 2.9% processing | Simple, reliable, global. Higher fees but good reputation |
| **4fund.com** | 4.1â˜… | 361 | European-focused | Strong in Central/Eastern Europe. Simple UX |
| **Crowdfunder UK** | 4.3â˜… | limited | UK-focused | Community-driven, local impact campaigns |

### 3.2 Best-in-Class Features We Will Adopt

| Feature | Best-in-Class Source | Our Enhancement |
|---------|---------------------|-----------------|
| **0% platform fee transparency** | SpotFund + WhyDonate + Zeffy | Match 0% platform fee; clearly explain CC processing fees; never hide fees or default donor tips |
| **Next-day payouts** | SpotFund (next business day) | Match next-business-day payouts for approved milestones |
| **Proactive human support outreach** | SpotFund (emails new campaigners proactively) | Auto-assign support agent on campaign creation; proactive check-in at key milestones |
| **Named support agents** | WhyDonate (Akshit, Vaibhav, etc. referenced by name in reviews) | Support agents use real names; build personal relationships with campaigners |
| **Multi-channel support including WhatsApp** | WhyDonate (WhatsApp + chat + email + phone) + Ketto | WhatsApp + email + site chat + phone + social media â€” all with human agents |
| **100% negative review response** | WhyDonate (100% response rate, < 48h) | Commit to responding to every Trustpilot review within 24 hours |
| **Document-based verification** | GlobalGiving + Milaap | Apply to ALL campaigns, not just nonprofits/medical |
| **Milestone fund release** | GlobalGiving (orgs only) | Extend to individual campaigns with 3-phase system |
| **Dedicated human support** | Milaap (fundraising expert) + SpotFund (proactive agents) | Assign verification auditor + support agent per campaign |
| **Automatic refund guarantee** | GoFundMe Guarantee (reactive, limited to $1,000) | Proactive â€” automatic refund on ALL cancellations, ANY amount, no questions asked |
| **Mandatory progress updates** | Milaap | Tie updates to milestone evidence for fund release |
| **Campaign status transparency** | **None** (industry gap â€” even SpotFund/WhyDonate lack this) | 8+ campaign states with hover-tooltips, donor email updates |
| **After-hours support** | WhyDonate (WhatsApp after hours, confirmed next morning) | WhatsApp available 24/7 with AI triage + human follow-up within 4 hours |

### 3.3 Our Unique Differentiators (What NO Competitor Does â€” Including SpotFund & WhyDonate)

| # | Differentiator | Description | Even SpotFund & WhyDonate Don't Do This |
|---|---------------|-------------|----------------------------------------|
| 1 | **Pre-launch document verification for ALL campaigns** | No platform verifies individual campaigns before launch with supporting evidence; we require identity documents + story proof | SpotFund: basic ID only. WhyDonate: Stripe identity only. Neither verifies the campaign *story* |
| 2 | **3-phase milestone-based fund release** | No platform ties fund disbursement to campaigner evidence milestones for individual campaigns | Both release funds without milestone accountability |
| 3 | **Automatic full refund on cancellation** | No platform guarantees automatic refund to all donors when a campaign is cancelled â€” no cap, no questions | GoFundMe has a $1,000 cap. SpotFund/WhyDonate handle case-by-case |
| 4 | **Granular campaign states with public transparency** | No platform shows paused/under-review/suspended states to the public with explanatory tooltips | All competitors: "active" or "ended" only |
| 5 | **Proactive donor email lifecycle** | No platform emails donors at every status change with evidence and alternative campaigns | SpotFund proactively supports campaigners, but not donors |
| 6 | **Admin info-request with enforced response deadline** | No platform has a formal information request flow with automated escalation and campaign suspension | All competitors handle verification ad-hoc |
| 7 | **Milestone evidence tied to fund release** | Campaigners must PROVE fund usage at each phase to receive next disbursement | Industry-first accountability mechanism |

---

## 4. USP Statement

### Tagline
> **"Every Campaign Verified. Every Dollar Accountable. Every Donor Protected."**

### Elevator Pitch (30 seconds)
> LastDonor.org is the only crowdfunding platform where every campaign is document-verified by human auditors before it goes live, funds are released in three milestone-based phases tied to real evidence, and donors receive automatic full refunds if a campaign is cancelled â€” with real-time transparency into every campaign's status and multi-channel human support available 24/7.

### Trust Guarantee Statement (for the site)
> **The LastDonor Trust Guarantee**: We verify every campaign with real documents. We release funds only when campaigners prove progress. If we cancel a campaign, you get a full refund â€” no questions asked. Your generosity will never fund an unverified cause.

---

## 5. Pillar 1 â€” Campaign Verification System

### 5.1 Verification Tiers

We introduce a **3-tier verification system** replacing the current simple `unverified | pending | verified` enum:

| Tier | Name | Requirements | Badge | Trust Level |
|------|------|-------------|-------|-------------|
| **T0** | Unverified | Campaign just submitted; no review started | âšª Gray "Pending Review" | Not visible to public |
| **T1** | Identity Verified | Campaigner identity confirmed via government ID + selfie match | ðŸ”µ Blue "ID Verified" | Can be published but funds held |
| **T2** | Story Verified | Supporting documents from reputable authorities confirm the campaign story | ðŸŸ¢ Green "Fully Verified" | Funds released per milestones |
| **TX** | Verification Failed | Documents rejected or identity mismatch | ðŸ”´ Red "Verification Failed" | Campaign rejected; cannot be published |

### 5.2 Required Documents â€” By Campaign Category

| Category | Identity Documents (T1) | Story Documents (T2) |
|----------|------------------------|---------------------|
| **Medical** | Government-issued photo ID (passport, driver's license, national ID), selfie holding ID with date | Hospital admission letter, medical diagnosis report, cost estimate from hospital, doctor's verification letter |
| **Disaster** | Government-issued photo ID, selfie | FEMA/disaster agency declaration, property damage assessment, insurance claim (if applicable), photos of damage with geolocation metadata |
| **Education** | Government-issued photo ID, selfie | School enrollment letter, tuition fee invoice, academic transcript, scholarship rejection (if applicable) |
| **Community** | Government-issued photo ID, selfie, organization registration (if applicable) | Community leader endorsement, project plan with cost breakdown, local authority permission (if construction/renovation) |
| **Essential Needs** | Government-issued photo ID, selfie | Utility shutoff notice, eviction notice, bank statement showing hardship, social worker referral letter |
| **Memorial** | Government-issued photo ID, selfie | Death certificate, funeral home invoice, obituary |
| **Charity** | Government-issued photo ID, selfie, 501(c)(3) letter or equivalent | Annual report, financial audit, program description |
| **All Others** | Government-issued photo ID, selfie | Relevant supporting documentation as determined by auditor on a case-by-case basis |

### 5.3 Verification Workflow (Step-by-Step)

```
Step 1: CAMPAIGN SUBMISSION
â”œâ”€â”€ Campaigner fills out Share Your Story form
â”œâ”€â”€ Uploads: hero image, story, goal amount, category, impact tiers
â”œâ”€â”€ Defines 3 milestones with evidence requirements (see Pillar 2)
â”œâ”€â”€ Status: draft | Verification: submitted_for_review
â”œâ”€â”€ System: Creates in-app notification for admin + email alert
â””â”€â”€ CTA shown to campaigner: "Upload Verification Documents"

Step 2: DOCUMENT UPLOAD
â”œâ”€â”€ Campaigner navigates to "My Campaigns > [Campaign] > Verification"
â”œâ”€â”€ Uploads required documents per category (see table above)
â”œâ”€â”€ Each document: file (PDF/JPG/PNG, max 10MB), type, description
â”œâ”€â”€ System: Stores in secure encrypted storage (S3 + server-side encryption)
â”œâ”€â”€ Status: draft | Verification: documents_uploaded
â””â”€â”€ Admin notification: "Campaign '[title]' has documents ready for review"

Step 3: AUDITOR REVIEW (Admin Panel)
â”œâ”€â”€ Admin navigates to Admin > Campaigns > Verification Queue
â”œâ”€â”€ Views submitted documents alongside campaign details
â”œâ”€â”€ Auditor checklist (per document):
â”‚   â˜ Document is legible and not altered
â”‚   â˜ Document is from a reputable source/authority
â”‚   â˜ Names match across all documents and campaign
â”‚   â˜ Dates are recent and relevant
â”‚   â˜ Information corroborates campaign story
â”œâ”€â”€ Auditor actions:
â”‚   âœ… APPROVE T1 (Identity Verified) â€” if ID + selfie match
â”‚   âœ… APPROVE T2 (Fully Verified) â€” if all story documents check out
â”‚   âŒ REJECT â€” with mandatory reason selection + free-text explanation
â”‚   â¸ï¸ REQUEST MORE INFO â€” specify what additional documents/info needed
â””â”€â”€ All actions logged in audit trail with timestamp, actor, notes

Step 4a: APPROVAL PATH
â”œâ”€â”€ T1 Approved:
â”‚   â”œâ”€â”€ Verification: identity_verified
â”‚   â”œâ”€â”€ Campaign can now be published (admin activates)
â”‚   â”œâ”€â”€ Blue "ID Verified" badge shown on campaign page
â”‚   â”œâ”€â”€ Funds held until T2 achieved (cannot be withdrawn)
â”‚   â””â”€â”€ Email to campaigner: "Your identity is verified! Complete story verification to unlock fund release."
â”œâ”€â”€ T2 Approved:
â”‚   â”œâ”€â”€ Verification: fully_verified
â”‚   â”œâ”€â”€ Green "Fully Verified" badge shown on campaign page
â”‚   â”œâ”€â”€ Milestone-based fund release activated
â”‚   â””â”€â”€ Email to campaigner: "Your campaign is fully verified! Funds will be released per your milestones."

Step 4b: REJECTION PATH
â”œâ”€â”€ Verification: rejected
â”œâ”€â”€ Status remains: draft (cannot be published)
â”œâ”€â”€ Email to campaigner with:
â”‚   â”œâ”€â”€ Specific rejection reason(s)
â”‚   â”œâ”€â”€ Which documents failed and why
â”‚   â”œâ”€â”€ Option to re-submit with corrected documents
â”‚   â””â”€â”€ Support contact information
â”œâ”€â”€ Campaigner can re-upload and re-submit (up to 3 attempts)
â””â”€â”€ After 3 rejections â†’ campaign permanently rejected, escalated to admin review

Step 4c: REQUEST MORE INFO PATH
â”œâ”€â”€ Verification: info_requested
â”œâ”€â”€ Admin specifies: what's needed, deadline (default: 7 days)
â”œâ”€â”€ In-app notification + email to campaigner:
â”‚   â”œâ”€â”€ "Your campaign requires additional information"
â”‚   â”œâ”€â”€ Specific items requested
â”‚   â”œâ”€â”€ Deadline with countdown
â”‚   â””â”€â”€ Upload link
â”œâ”€â”€ Campaigner provides requested info
â”œâ”€â”€ System: Verification returns to documents_uploaded, auditor re-reviews
â”œâ”€â”€ If deadline passes without response:
â”‚   â”œâ”€â”€ Day 7: Reminder email + notification ("2 days remaining")
â”‚   â”œâ”€â”€ Day 9: Final warning ("Response overdue â€” campaign may be suspended")
â”‚   â”œâ”€â”€ Day 14: Auto-suspend campaign, notify admin
â”‚   â””â”€â”€ Admin decides: extend deadline, reject, or close
```

### 5.4 Verification Status Enum (Expanded)

**Current**: `unverified | pending | verified`

**New**: `submitted_for_review | documents_uploaded | identity_verified | fully_verified | info_requested | rejected | suspended`

| Status | Description | Campaigner Visibility | Public Visibility |
|--------|-------------|----------------------|-------------------|
| `submitted_for_review` | Campaign submitted, awaiting document upload | "Upload your verification documents" | Not visible (draft) |
| `documents_uploaded` | Documents received, in auditor queue | "Under review â€” we'll update you within 48 hours" | Not visible (draft) |
| `identity_verified` | T1 passed â€” ID confirmed | "Identity verified âœ“ â€” Complete story verification" | ðŸ”µ "ID Verified" badge |
| `fully_verified` | T2 passed â€” story + identity confirmed | "Fully Verified âœ“" | ðŸŸ¢ "Fully Verified" badge |
| `info_requested` | Auditor needs more info/documents | "Action Required: Provide additional information by [date]" | Not visible or shows â¸ï¸ |
| `rejected` | Documents did not pass review | "Verification unsuccessful â€” [reason]. You may resubmit." | Not visible (draft) |
| `suspended` | Deadline passed without response or investigation underway | "Campaign suspended â€” contact support" | ðŸŸ  "Under Review" |

### 5.5 Document Storage & Security

| Aspect | Specification |
|--------|--------------|
| **Storage** | AWS S3 bucket `lastdonor-verification-docs` with server-side encryption (SSE-S3) |
| **Access** | Pre-signed URLs with 15-minute expiry; admin-only access |
| **Retention** | Documents retained for 7 years post-campaign completion (compliance) |
| **Deletion** | Campaigner can request document deletion post-campaign archive (GDPR right to erasure) |
| **Encryption at rest** | AES-256 |
| **Encryption in transit** | TLS 1.3 |
| **PII handling** | Government IDs blurred in admin UI preview; full view requires explicit admin action (logged in audit trail) |
| **File types** | PDF, JPG, JPEG, PNG, WEBP (max 10MB per file, max 20 files per campaign) |

---

## 6. Pillar 2 â€” Milestone-Based Fund Release

### 6.1 Overview

Instead of releasing all funds to the campaigner immediately (like every competitor), LastDonor.org requires campaigners to define **3 milestones** at campaign creation. Funds are released in phases only when the campaigner provides evidence that each milestone has been achieved.

### 6.2 3-Phase Fund Release Structure

| Phase | % of Funds | Trigger | Evidence Required | Release Timeline |
|-------|-----------|---------|-------------------|-----------------|
| **Phase 1: Initial Release** | 30% of raised amount | Campaign reaches 40% of goal + T2 verification complete | Proof that initial steps are underway (e.g., hospital admission, purchase order, construction permit) | Within 5 business days of evidence approval |
| **Phase 2: Progress Release** | 40% of raised amount | Phase 1 evidence approved + campaign at 70%+ of goal | Progress evidence (e.g., medical bills paid, construction photos, receipts, intermediate outcomes) | Within 5 business days of evidence approval |
| **Phase 3: Completion Release** | 30% of raised amount | Phase 2 evidence approved + campaign completed/goal met | Final outcome evidence (e.g., discharge papers, project completion photos, final receipts, beneficiary confirmation) | Within 5 business days of evidence approval |

### 6.3 Milestone Definition by Campaigner

At campaign creation, the campaigner fills out for each milestone:

```
Milestone 1: Initial Steps
â”œâ”€â”€ Title: (e.g., "Hospital Admission & Initial Treatment")
â”œâ”€â”€ Description: (e.g., "Admit patient and begin chemotherapy cycle 1")
â”œâ”€â”€ Evidence type: [document | photo | receipt | official_letter | other]
â”œâ”€â”€ Estimated completion: (date)
â””â”€â”€ Fund percentage: 30% (system default, can be adjusted 20-40%)

Milestone 2: Progress
â”œâ”€â”€ Title: (e.g., "Complete First 3 Chemo Cycles")
â”œâ”€â”€ Description: (e.g., "Patient completes cycles 1-3 with medical reports")
â”œâ”€â”€ Evidence type: [document | photo | receipt | official_letter | other]
â”œâ”€â”€ Estimated completion: (date)
â””â”€â”€ Fund percentage: 40% (system default, can be adjusted 30-50%)

Milestone 3: Completion
â”œâ”€â”€ Title: (e.g., "Treatment Complete & Recovery")
â”œâ”€â”€ Description: (e.g., "Patient completes all treatment cycles, discharge")
â”œâ”€â”€ Evidence type: [document | photo | receipt | official_letter | other]
â”œâ”€â”€ Estimated completion: (date)
â””â”€â”€ Fund percentage: 30% (system default, can be adjusted 20-40%)

Constraint: Phase 1% + Phase 2% + Phase 3% MUST = 100%
```

### 6.4 Milestone Evidence Submission & Review

```
Step 1: MILESTONE REACHED
â”œâ”€â”€ Campaigner navigates to "My Campaigns > [Campaign] > Milestones"
â”œâ”€â”€ Selects milestone (1, 2, or 3)
â”œâ”€â”€ Uploads evidence files (same file constraints as verification docs)
â”œâ”€â”€ Adds description of what was achieved
â”œâ”€â”€ Submits for review
â””â”€â”€ System: Status â†’ milestone_evidence_submitted

Step 2: ADMIN REVIEW
â”œâ”€â”€ Admin sees milestone evidence in Admin > Campaigns > Fund Release Queue
â”œâ”€â”€ Reviews evidence against milestone description
â”œâ”€â”€ Checks:
â”‚   â˜ Evidence matches milestone description
â”‚   â˜ Documents are authentic and not altered
â”‚   â˜ Dates and details are consistent
â”‚   â˜ Photos have metadata showing recent capture (if applicable)
â”œâ”€â”€ Actions:
â”‚   âœ… APPROVE â†’ Triggers fund release for this phase
â”‚   âŒ REJECT â†’ Requirement to resubmit with specifics on what's wrong
â”‚   â¸ï¸ REQUEST MORE â†’ Specific additional evidence needed
â””â”€â”€ All actions audit-logged

Step 3: FUND RELEASE (on approval)
â”œâ”€â”€ System calculates: (phase_percentage Ã- total_raised_minus_fees)
â”œâ”€â”€ Creates withdrawal record: status = 'approved'
â”œâ”€â”€ Initiates Stripe Connect transfer to campaigner's verified bank account
â”œâ”€â”€ Updates milestone status: released
â”œâ”€â”€ Notifies campaigner: "Phase [N] funds of $[amount] have been released"
â”œâ”€â”€ Creates campaign update (visible to public): "Milestone [N]: [title] â€” Evidence Verified âœ“"
â””â”€â”€ Notifies donors who opted in: "Campaign update: Milestone achieved!"

Step 4: FAILED EVIDENCE
â”œâ”€â”€ If evidence rejected:
â”‚   â”œâ”€â”€ Campaigner notified with specific rejection reason
â”‚   â”œâ”€â”€ Can resubmit (up to 3 attempts per milestone)
â”‚   â”œâ”€â”€ After 3 failures â†’ milestone escalated to admin investigation
â”‚   â””â”€â”€ Funds for this phase remain held
â”œâ”€â”€ If no evidence submitted within 30 days of estimated date:
â”‚   â”œâ”€â”€ Day 30: Reminder notification + email
â”‚   â”œâ”€â”€ Day 45: Warning: "Funds may be returned to donors if evidence not provided"
â”‚   â”œâ”€â”€ Day 60: Campaign paused, admin review triggered
â”‚   â””â”€â”€ Day 90: Campaign cancelled, automatic refund to all donors
```

### 6.5 Fund Hold Mechanism

| State | Fund Status | Withdrawable? |
|-------|------------|---------------|
| Campaign active, no milestone approved | Funds held in LastDonor escrow (Stripe) | No |
| Phase 1 approved | 30% released, 70% held | 30% yes |
| Phase 2 approved | 70% cumulative released, 30% held | 70% yes |
| Phase 3 approved | 100% released | Yes â€” fully disbursed |
| Campaign cancelled | 0% â€” all refunded to donors | No (refunded) |
| Campaign paused | Funds frozen at current release state | No new releases |

### 6.6 Example: Medical Campaign Milestones

> **Campaign**: "Help Sarah Fight Leukemia"  
> **Goal**: $50,000  
> **Category**: Medical

| Phase | Milestone | Evidence Required | % | Amount |
|-------|-----------|-------------------|---|--------|
| 1 | Hospital admission and initial diagnosis confirmation | Hospital admission letter, diagnosis report, cost estimate | 30% | $15,000 |
| 2 | Completion of chemotherapy cycles 1-3 | Medical progress reports, treatment receipts, hospital invoices | 40% | $20,000 |
| 3 | Treatment completed, patient discharged | Discharge papers, final medical bill, recovery photos with patient consent | 30% | $15,000 |

---

## 7. Pillar 3 â€” Campaign Lifecycle Transparency

### 7.1 Expanded Campaign Status System

**Current statuses**: `draft | active | last_donor_zone | completed | archived`

**New statuses** (in addition to existing):

| Status | Description | Public Visibility | Badge |
|--------|-------------|-------------------|-------|
| `active` | Campaign live, accepting donations | Full public page | ðŸŸ¢ "Active" |
| `paused` | Temporarily halted (admin decision) | Public with explanation tooltip | â¸ï¸ "Paused" (amber) |
| `under_review` | Admin investigating concerns | Public with generic message | ðŸ” "Under Review" (amber) |
| `suspended` | Serious concerns, investigation in progress | Public with warning | ðŸŸ  "Suspended" |
| `cancelled` | Permanently cancelled (fraud, non-compliance) | Public with reason | ðŸ”´ "Cancelled" |
| `completed` | Goal met + all milestones cleared | Public celebration state | âœ… "Completed" |
| `last_donor_zone` | 91-100% of goal | Public, urgent CTA | ðŸŽ¯ "Last Donor Zone" |
| `archived` | Historical record | Accessible via direct link | ðŸ“ "Archived" |

### 7.2 Campaign Status Display â€” Public Campaign Page

#### Status Badge Placement
- **Location**: Immediately below campaign title, left-aligned
- **Format**: Colored badge with icon + status text
- **Hover tooltip**: Expanded explanation (see below)

#### Hover Tooltip Content by Status

| Status | Tooltip Hover Text |
|--------|-------------------|
| â¸ï¸ Paused | "This campaign has been temporarily paused. Reason: [admin-provided reason]. Expected resolution: [date if provided]." |
| ðŸ” Under Review | "This campaign is currently under review by our verification team. Donations are paused until review is complete." |
| ðŸŸ  Suspended | "This campaign has been suspended pending investigation. Funds are held securely. If you've donated, you will be notified of the outcome." |
| ðŸ”´ Cancelled | "This campaign has been cancelled. Reason: [specific reason]. All donors have been fully refunded." |
| âœ… Completed | "This campaign has been successfully completed! All milestones were achieved and verified." |

#### Status History Timeline (on campaign page)
A collapsible "Campaign Timeline" section showing:
```
ðŸ“… Mar 15, 2026 â€” Campaign Created
ðŸ“… Mar 16, 2026 â€” Identity Verified âœ“
ðŸ“… Mar 18, 2026 â€” Fully Verified âœ“ â€” Campaign Published
ðŸ“… Mar 25, 2026 â€” Milestone 1 Achieved: "Hospital Admission" âœ“
ðŸ“… Apr 10, 2026 â€” Milestone 2 Achieved: "First Treatment Cycle" âœ“
ðŸ“… May 02, 2026 â€” Campaign Completed âœ…
```

### 7.3 Donor Email Lifecycle Notifications

Donors who have **opted in to email updates** (via donation form checkbox: "Keep me updated on this campaign") receive emails at every significant status change.

| Trigger | Email Subject | Email Content |
|---------|--------------|---------------|
| Campaign paused | "Update on [Campaign Title] â€” Campaign Paused" | Explanation of pause reason, assurance funds are secure, ETA for resolution |
| Campaign resumed | "Good News! [Campaign Title] Has Resumed" | Pause resolved, donations now active, progress update |
| Campaign under review | "Update on [Campaign Title] â€” Under Review" | Neutral language, investigation underway, funds secure |
| Campaign suspended | "Important: [Campaign Title] Suspended" | Investigation in progress, funds held, will be notified of outcome |
| Campaign cancelled | **See Section 8 (Donor Protection)** | Full refund + alternative campaigns |
| Milestone achieved | "[Campaign Title] â€” Milestone Reached! ðŸŽ‰" | Evidence summary, photos (if available), how funds were used |
| Campaign completed | "[Campaign Title] â€” Campaign Successfully Completed!" | Final outcome, thank you, impact summary, evidence |
| Campaign update posted | "New Update from [Campaign Title]" | Update content preview + link to full update |

### 7.4 Opt-In Mechanism

**At donation time** (already partially implemented in donation flow):
```
â˜‘ Keep me updated about this campaign (email)
â˜ Subscribe to LastDonor newsletter
```

**Post-donation** (in user dashboard for registered users):
- Toggle per-campaign: "Receive updates for [Campaign Title]"

**Implementation**: Store in new `donorCampaignSubscriptions` table (see Schema section).

---

## 8. Pillar 4 â€” Donor Protection & Refund System

### 8.1 Refund Policy â€” The LastDonor Guarantee

> **Policy**: If LastDonor.org cancels a campaign for any reason, ALL donors receive a full refund â€” automatically, without request, within 5 business days. No exceptions.

### 8.2 Cancellation Reasons & Refund Triggers

| Cancellation Reason | Refund? | Donor Communication |
|---------------------|---------|---------------------|
| **Identity fraud** | âœ… Full refund | "Campaign cancelled: Identity verification failed" |
| **Fake/fabricated story** | âœ… Full refund | "Campaign cancelled: Story could not be verified" |
| **Document forgery** | âœ… Full refund | "Campaign cancelled: Submitted documents were not authentic" |
| **Campaigner non-responsive** (90+ days no evidence) | âœ… Full refund | "Campaign cancelled: Campaigner did not provide required evidence" |
| **Duplicate campaign** | âœ… Full refund | "Campaign cancelled: Duplicate of existing campaign [link]" |
| **Legal/compliance issue** | âœ… Full refund | "Campaign cancelled: Compliance review" |
| **Campaigner requested cancellation** | âœ… Full refund | "Campaign cancelled by organizer: [campaigner-provided reason]" |
| **Terms of service violation** | âœ… Full refund | "Campaign cancelled: Violation of platform terms" |

### 8.3 Automatic Refund Process

```
TRIGGER: Admin sets campaign status to 'cancelled'

Step 1: INITIATE MASS REFUND
â”œâ”€â”€ System queries all donations WHERE campaignId = X AND refunded = false AND source = 'real'
â”œâ”€â”€ For each donation:
â”‚   â”œâ”€â”€ Call Stripe API: stripe.refunds.create({ payment_intent: stripePaymentId })
â”‚   â”œâ”€â”€ Update donation: refunded = true
â”‚   â”œâ”€â”€ Log: auditLogs entry (donation.refunded, actor: 'system/admin', reason)
â”‚   â””â”€â”€ Track: refundBatch record (batchId, donationId, status, stripeRefundId)
â”œâ”€â”€ Process in batches of 50 (Stripe rate limiting: 100 requests/sec)
â”œâ”€â”€ Total refund amount calculated and logged
â””â”€â”€ Campaign raisedAmount reset to 0, donorCount reset to 0

Step 2: DONOR NOTIFICATION EMAIL
â”œâ”€â”€ Subject: "Important: Your Donation to [Campaign Title] Has Been Refunded"
â”œâ”€â”€ Body:
â”‚   â”œâ”€â”€ Personal greeting: "Dear [Donor Name],"
â”‚   â”œâ”€â”€ What happened: "[Campaign Title] has been cancelled because [reason]."
â”‚   â”œâ”€â”€ Refund confirmation: "Your donation of $[amount] has been fully refunded to your original payment method. Please allow 5-10 business days for the refund to appear."
â”‚   â”œâ”€â”€ Apology & assurance: "We take full responsibility for this situation. Your trust matters deeply to us, and we want you to know that your generosity will never go to an unverified cause. Every campaign on LastDonor.org is document-verified before launch."
â”‚   â”œâ”€â”€ Re-engagement CTA: "You can still make a difference! Here are verified campaigns in [same category] that need your support:"
â”‚   â”‚   â”œâ”€â”€ Campaign 1: [Title] â€” $X raised of $Y â€” [Fully Verified âœ“] â€” [Donate Now button]
â”‚   â”‚   â”œâ”€â”€ Campaign 2: [Title] â€” $X raised of $Y â€” [Fully Verified âœ“] â€” [Donate Now button]
â”‚   â”‚   â””â”€â”€ Campaign 3: [Title] â€” $X raised of $Y â€” [Fully Verified âœ“] â€” [Donate Now button]
â”‚   â”œâ”€â”€ Footer: "If you have any questions, reach out to us anytime:" + support channels
â”‚   â””â”€â”€ Unsubscribe link
â””â”€â”€ Sent to ALL donors (including guests who donated without account)

Step 3: CAMPAIGN PAGE UPDATE
â”œâ”€â”€ Status badge: ðŸ”´ "Cancelled"
â”œâ”€â”€ Banner at top: "This campaign has been cancelled. All donors have been fully refunded."
â”œâ”€â”€ Hover tooltip with specific reason
â”œâ”€â”€ Donation button: REMOVED (replaced with "View Similar Campaigns")
â””â”€â”€ Campaign timeline: Shows cancellation event with date
```

### 8.4 Admin Bulk Refund UI

**Location**: Admin > Campaigns > [Campaign] > Actions > Cancel Campaign

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  CANCEL CAMPAIGN: "Help Sarah Fight Leukemia"       â”‚
â”‚                                                      â”‚
â”‚  âš ï¸  This will:                                     â”‚
â”‚  â€¢ Cancel the campaign permanently                   â”‚
â”‚  â€¢ Refund ALL [47] donors totaling [$12,450.00]     â”‚
â”‚  â€¢ Send refund notification emails to all donors     â”‚
â”‚  â€¢ Log this action in the audit trail               â”‚
â”‚                                                      â”‚
â”‚  Cancellation Reason: [dropdown]                     â”‚
â”‚  â”œâ”€â”€ Identity fraud                                  â”‚
â”‚  â”œâ”€â”€ Fabricated story                               â”‚
â”‚  â”œâ”€â”€ Document forgery                               â”‚
â”‚  â”œâ”€â”€ Campaigner non-responsive                       â”‚
â”‚  â”œâ”€â”€ Duplicate campaign                             â”‚
â”‚  â”œâ”€â”€ Legal/compliance issue                          â”‚
â”‚  â”œâ”€â”€ Campaigner requested cancellation              â”‚
â”‚  â””â”€â”€ Terms of service violation                      â”‚
â”‚                                                      â”‚
â”‚  Additional Notes: [text area]                       â”‚
â”‚  (internal â€” not shown to donors)                    â”‚
â”‚                                                      â”‚
â”‚  Email Preview: [View Email Template]                â”‚
â”‚                                                      â”‚
â”‚  â˜‘ I understand this action is irreversible          â”‚
â”‚                                                      â”‚
â”‚  [Cancel â€” Go Back]  [Confirm Cancellation & Refund] â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 8.5 Admin Bulk Email Template System

For situations requiring custom communication beyond automated templates:

**Admin > Communications > Bulk Email**

```
Step 1: SELECT RECIPIENTS
â”œâ”€â”€ Filter by:
â”‚   â”œâ”€â”€ Campaign: [dropdown â€” select specific campaign]
â”‚   â”œâ”€â”€ Donation status: [all | active | refunded]
â”‚   â”œâ”€â”€ Donor type: [registered | guest | all]
â”‚   â””â”€â”€ Date range: [from â€” to]
â”œâ”€â”€ Results: Table with checkboxes
â”‚   â˜‘ Select All (47 donors)
â”‚   â˜‘ John Smith â€” john@example.com â€” $100.00 â€” Mar 15
â”‚   â˜‘ Jane Doe â€” jane@example.com â€” $250.00 â€” Mar 16
â”‚   â˜ Anonymous â€” anon@example.com â€” $50.00 â€” Mar 17
â”‚   ...
â””â”€â”€ Selected: 45 of 47

Step 2: CREATE EMAIL
â”œâ”€â”€ Template: [dropdown â€” pre-built templates]
â”‚   â”œâ”€â”€ Campaign Cancelled â€” Full Refund
â”‚   â”œâ”€â”€ Campaign Paused â€” Status Update
â”‚   â”œâ”€â”€ Campaign Resumed â€” Good News
â”‚   â”œâ”€â”€ Milestone Achieved â€” Progress Update
â”‚   â”œâ”€â”€ Campaign Completed â€” Thank You
â”‚   â””â”€â”€ Custom Template
â”œâ”€â”€ Variables available (auto-populated per recipient):
â”‚   â”œâ”€â”€ {{donor_name}} â€” Donor's name
â”‚   â”œâ”€â”€ {{donation_amount}} â€” Their specific donation amount
â”‚   â”œâ”€â”€ {{campaign_title}} â€” Campaign title
â”‚   â”œâ”€â”€ {{campaign_category}} â€” Campaign category
â”‚   â”œâ”€â”€ {{cancellation_reason}} â€” Admin-specified reason
â”‚   â”œâ”€â”€ {{refund_amount}} â€” Refund amount
â”‚   â”œâ”€â”€ {{similar_campaigns}} â€” Auto-generated similar campaign cards
â”‚   â””â”€â”€ {{support_channels}} â€” Support contact information
â”œâ”€â”€ Subject: [editable, pre-filled from template]
â”œâ”€â”€ Body: [rich text editor with variable insertion buttons]
â”œâ”€â”€ Preview: [renders with sample donor data]
â””â”€â”€ TEST: [Send test to admin email]

Step 3: REVIEW & SEND
â”œâ”€â”€ Preview: Final email with real data for first recipient
â”œâ”€â”€ Recipients: 45 donors
â”œâ”€â”€ Estimated send time: ~2 minutes (rate-limited)
â”œâ”€â”€ [Cancel] [Schedule for Later] [Send Now]
â””â”€â”€ Progress bar: "Sending... 23/45 complete"

Step 4: AUDIT
â”œâ”€â”€ Bulk email logged in audit trail
â”œâ”€â”€ Individual send status tracked: sent | failed | bounced
â”œâ”€â”€ Retry available for failed sends
â””â”€â”€ Full history in Admin > Communications > Sent
```

### 8.6 Re-Engagement CTA Logic

When generating "similar campaigns" for refund emails:

```
Query Logic:
1. Same category as cancelled campaign â†’ up to 3 campaigns
2. If < 3 same category, fill with same location â†’ up to 3 total
3. If still < 3, fill with highest-activity verified campaigns
4. Filter: ONLY fully_verified campaigns, status = active
5. Sort by: fewest remaining to goal (most impactful donation)
6. Exclude: simulation campaigns (simulationFlag = false)
```

---

## 9. Pillar 5 â€” Admin Autonomy & Campaign Governance

### 9.1 Admin Action Matrix

| Action | Current State | Effect | Notification | Reversible? |
|--------|--------------|--------|-------------|-------------|
| **Publish** | draft â†’ active | Campaign goes live | Campaigner: "Your campaign is live!" | Yes (can unpublish) |
| **Pause** | active â†’ paused | Donations disabled, public badge shows â¸ï¸ | Campaigner + opted-in donors | Yes |
| **Resume** | paused â†’ active | Donations re-enabled | Campaigner + opted-in donors | Yes |
| **Suspend** | any â†’ suspended | Donations disabled, investigation state | Campaigner: "Campaign suspended â€” respond within X days" | Yes (can reinstate) |
| **Cancel** | any â†’ cancelled | Permanent, triggers mass refund | All donors + campaigner | **No** |
| **Complete** | active/LDZ â†’ completed | Campaign finished successfully | All donors + campaigner | No (can archive) |
| **Archive** | completed â†’ archived | Moves to historical | Campaigner | Yes (can reinstate to draft) |
| **Delete** | draft only (no donations) | Hard delete from database | Campaigner: "Campaign removed" | **No** |
| **Request Info** | any | Sends info request to campaigner | Campaigner: in-app + email with deadline | N/A |
| **Extend Deadline** | info_requested | Gives campaigner more time | Campaigner: "Deadline extended to [date]" | N/A |
| **Approve Milestone** | active | Releases funds for phase | Campaigner + opted-in donors | No |
| **Reject Milestone** | active | Sends rejection with reason | Campaigner | Yes (can resubmit) |

### 9.2 Information Request System

When admin needs more information from a campaigner:

```
Admin > Campaign > [Campaign] > Request Information

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  REQUEST INFORMATION                                 â”‚
â”‚                                                      â”‚
â”‚  Campaign: "Help Sarah Fight Leukemia"               â”‚
â”‚  Campaigner: John Smith (john@example.com)           â”‚
â”‚                                                      â”‚
â”‚  Request Type: [dropdown]                            â”‚
â”‚  â”œâ”€â”€ Additional identity documents                   â”‚
â”‚  â”œâ”€â”€ Updated medical reports                         â”‚
â”‚  â”œâ”€â”€ Clarification on fund usage                     â”‚
â”‚  â”œâ”€â”€ Proof of relationship to beneficiary            â”‚
â”‚  â”œâ”€â”€ Updated cost estimates                          â”‚
â”‚  â”œâ”€â”€ Progress evidence                               â”‚
â”‚  â””â”€â”€ Other (specify below)                           â”‚
â”‚                                                      â”‚
â”‚  Details: [text area]                                â”‚
â”‚  "Please provide the most recent hospital invoice    â”‚
â”‚   dated within the last 30 days showing the current  â”‚
â”‚   treatment costs."                                  â”‚
â”‚                                                      â”‚
â”‚  Response Deadline: [7 days â–¼]                       â”‚
â”‚  â”œâ”€â”€ 3 days (urgent)                                â”‚
â”‚  â”œâ”€â”€ 7 days (standard)                              â”‚
â”‚  â”œâ”€â”€ 14 days (extended)                             â”‚
â”‚  â””â”€â”€ 30 days (complex)                              â”‚
â”‚                                                      â”‚
â”‚  â˜‘ Pause campaign until response received            â”‚
â”‚  â˜ Allow campaign to remain active                   â”‚
â”‚                                                      â”‚
â”‚  [Cancel]  [Send Request]                            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Campaigner receives**:
1. **In-app notification** (bell icon, unread): "Action Required: Provide additional information for [Campaign Title]"
2. **Email**: Subject "Action Required: Your Campaign Needs Additional Information" with details, deadline, and upload link

**Automated escalation**:
- Deadline - 2 days: Reminder notification + email
- Deadline reached: Warning notification: "Deadline passed â€” please respond immediately"
- Deadline + 7 days: Campaign auto-suspended, admin notified for decision
- Deadline + 14 days: If still no response, admin prompted to cancel or extend

**Campaigner response**:
- Uploads requested documents/info through campaign dashboard
- System: verification status â†’ `documents_uploaded`, admin notified for re-review
- Timestamp and response logged in audit trail

### 9.3 Admin Dashboard â€” Campaign Governance View

A new **"Governance"** tab in admin campaign detail:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  CAMPAIGN GOVERNANCE â€” "Help Sarah Fight Leukemia"          â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€ Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€ Verification â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Current: Active  ðŸŸ¢         â”‚ â”‚ Level: Fully Verified ðŸŸ¢ â”‚â”‚
â”‚  â”‚ Since: Mar 18, 2026         â”‚ â”‚ Reviewed by: Admin J.    â”‚â”‚
â”‚  â”‚ Published: Mar 18, 2026     â”‚ â”‚ Reviewed: Mar 18, 2026   â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€ Fund Release â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Phase 1: âœ… Released â€” $4,500 (30%) â€” Mar 25, 2026      â”‚â”‚
â”‚  â”‚ Phase 2: â³ Pending â€” $6,000 (40%) â€” Evidence awaited   â”‚â”‚
â”‚  â”‚ Phase 3: ðŸ”’ Locked â€” $4,500 (30%) â€” Requires Phase 2   â”‚â”‚
â”‚  â”‚ Total Released: $4,500 / $15,000 (30%)                  â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€ Info Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Mar 20 â€” "Provide hospital admission letter" â†’ âœ… Done  â”‚â”‚
â”‚  â”‚ Apr 05 â€” "Updated treatment invoice" â†’ â³ Due Apr 12    â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ [Pause] [Suspend] [Cancel] [Request Info] [Approve M2]  â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€ Audit Trail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚ Mar 27, 14:32 â€” Admin J. approved Phase 1 evidence      â”‚â”‚
â”‚  â”‚ Mar 25, 09:15 â€” Campaigner uploaded Phase 1 evidence    â”‚â”‚
â”‚  â”‚ Mar 18, 16:00 â€” Admin J. published campaign             â”‚â”‚
â”‚  â”‚ Mar 18, 15:45 â€” Admin J. verified T2 (fully verified)   â”‚â”‚
â”‚  â”‚ Mar 16, 10:20 â€” Admin J. verified T1 (identity)         â”‚â”‚
â”‚  â”‚ Mar 15, 08:00 â€” Campaign created by John Smith          â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 10. Pillar 6 â€” Multi-Channel Human + AI Support

### 10.1 Industry Benchmark â€” Support Channels

| Platform | Rating | Email | Phone | Live Chat | WhatsApp | Social Media | Response SLA | Proactive Outreach | Review Response |
|----------|--------|-------|-------|-----------|----------|-------------|--------------|-------------------|-----------------|
| **WhyDonate** | **4.8â˜…** | âœ… | âœ… (scheduled) | âœ… | âœ… | âœ… | < 1 hour (chat) | Partial | **100% neg reviews** |
| **SpotFund** | **4.7â˜…** | âœ… | âŒ | âŒ | âŒ | âŒ | < 15 min (email) | âœ… **Proactive emails** | 48% neg reviews |
| Ketto | 4.0â˜… | âœ… | âœ… | âœ… | âœ… | Social | 4-8 hours | Partial | Unknown |
| Milaap | 3.8â˜… | âœ… | âœ… | âœ… | âœ… | Social | 2-4 hours | âœ… Dedicated expert | Unknown |
| GoFundMe | 3.2â˜… | âœ… | âŒ | âŒ | âŒ | Twitter (limited) | 24-48 hours | âŒ | Rare |
| JustGiving | 2.9â˜… | âœ… | âœ… (UK hours) | âŒ | âŒ | Twitter, Facebook | 24 hours | âŒ | Rare |
| GiveSendGo | 2.7â˜… | âœ… | âŒ | âŒ | âŒ | âŒ | 48-72 hours | âŒ | âŒ |
| **LastDonor** | **Target: 4.8+â˜…** | âœ… | âœ… | âœ… | âœ… | âœ… (all platforms) | **< 2 hours** | **âœ… Full lifecycle** | **100% target** |

**Key lessons from high-rated platforms:**

1. **SpotFund's proactive model**: *"As soon as I created the funding page, someone from customer service emailed me and guided me through the process"* â€” This single practice is mentioned in ~30% of their 5-star reviews. LastDonor MUST replicate this.

2. **WhyDonate's named agent model**: Reviewers reference agents by name (Akshit, Vaibhav, Rushikesh, Sonali, Anirban) â€” creating personal accountability. *"I would like to express my sincere appreciation for Mr. Vaibhav's exceptional support"* â€” This transforms support from a cost center to a trust engine.

3. **WhyDonate's 100% review response**: Every negative Trustpilot review gets a reply within 48 hours. Even negative reviewers update their scores. This is non-negotiable for LastDonor.

4. **WhyDonate's WhatsApp after-hours**: *"My request was sent via WhatsApp after working hours. Nevertheless I received a confirmation the next morning"* â€” LastDonor should offer WhatsApp with 24/7 AI triage + guaranteed human follow-up within 4 hours.

### 10.2 Support Channel Architecture

#### Channel 1: Site Live Chat (Primary â€” AI + Human Escalation)

| Aspect | Specification |
|--------|--------------|
| **Technology** | Intercom or Crisp (recommended: Crisp â€” open-source friendly + affordable) |
| **Availability** | 24/7 AI chatbot; human agents 8amâ€“10pm ET Monâ€“Sat |
| **AI Layer** | Custom-trained GPT on LastDonor FAQ, campaign policies, verification process, refund policies |
| **Escalation** | AI handles Tier 1 (FAQ, status checks, general info); escalates to human for Tier 2+ (disputes, verification questions, account issues) |
| **Widget placement** | Bottom-right corner on all pages; auto-opens on error pages and post-donation |
| **Features** | Typing indicators, read receipts, file sharing, screenshot capture, conversation history |
| **Integration** | Creates interaction log in CRM (existing `interactionLogs` table) |
| **SLA** | AI: immediate; Human: < 5 minutes during business hours |

#### Channel 2: WhatsApp Business API

| Aspect | Specification |
|--------|--------------|
| **Technology** | WhatsApp Business API via Twilio or 360dialog |
| **Number** | Dedicated business number displayed on site, emails, and campaign pages |
| **Availability** | 24/7 AI auto-responses; human agents 8amâ€“10pm ET Monâ€“Sat |
| **Features** | |
| â€” Inbound | Donors/campaigners can message directly; query routing to appropriate team |
| â€” Outbound templates | Campaign status updates, verification reminders, milestone notifications |
| â€” Rich messages | Campaign cards with images, buttons ("View Campaign", "Contact Support") |
| â€” Authentication | Verify user identity via linked email/phone before sharing account details |
| **Integration** | Messages logged in `interactionLogs`, linked to user account if identifiable |
| **SLA** | < 30 minutes during business hours; < 4 hours off-hours |

#### Channel 3: Email Support

| Aspect | Specification |
|--------|--------------|
| **Address** | `support@lastdonor.org` (general), `verify@lastdonor.org` (verification), `refunds@lastdonor.org` (refunds) |
| **Technology** | Shared inbox via Help Scout or Front (team collaboration, templates, assignments) |
| **Availability** | 24/7 (asynchronous) with human response within SLA |
| **Features** | Auto-acknowledgment ("We received your message, reference #[X]"), template responses, escalation tagging |
| **Integration** | Creates interaction log in CRM |
| **SLA** | < 2 hours during business hours; < 8 hours off-hours |
| **Automation** | AI categorization of incoming emails â†’ auto-route to verification, refunds, or general team |

#### Channel 4: Phone Support

| Aspect | Specification |
|--------|--------------|
| **Technology** | Twilio Voice or Vonage; VoIP-based numbers |
| **Number** | Toll-free US number + local numbers for key markets; displayed on site footer and all emails |
| **Availability** | 9amâ€“6pm ET Monâ€“Fri (Phase 1); expand to 8amâ€“10pm Monâ€“Sat (Phase 2) |
| **IVR Menu** | |
| â€” Press 1 | "I'm a donor with a question about my donation" |
| â€” Press 2 | "I'm a campaigner and need help with my campaign" |
| â€” Press 3 | "I want to report a concern about a campaign" |
| â€” Press 4 | "Other inquiries" |
| **Voicemail** | Off-hours: "Leave a message, we'll call back within 4 business hours" |
| **Call recording** | With consent â€” stored for quality assurance and dispute resolution |
| **Integration** | Creates interaction log in CRM with call duration, outcome, notes |
| **SLA** | < 3 minutes hold time during business hours |

#### Channel 5: Social Media Support

| Platform | Handle | Response Type |
|----------|--------|--------------|
| X (Twitter) | @LastDonorOrg | Public replies + DM for sensitive issues |
| Facebook | LastDonor.org | Messenger integration + page responses |
| Instagram | @lastdonor.org | DM support + comment monitoring |
| LinkedIn | LastDonor.org | Professional inquiries, partnership requests |

| Aspect | Specification |
|--------|--------------|
| **Technology** | Hootsuite or Sprout Social for unified inbox |
| **Availability** | Monitored 9amâ€“8pm ET Monâ€“Sat |
| **SLA** | Public mentions: < 1 hour; DMs: < 4 hours |
| **Escalation** | Complaints or fraud reports immediately escalated to internal team |
| **Integration** | Social interactions logged in CRM |

### 10.3 Support Tier Structure

| Tier | Handler | Scope | Escalation |
|------|---------|-------|-----------|
| **Tier 0** | AI Chatbot (site chat, WhatsApp, email auto-categorization) | FAQ, campaign status, donation receipt, password reset, general info | Escalate to Tier 1 if unresolved or sensitive |
| **Tier 1** | Support Agent | Account issues, donation questions, basic campaign help, update campaigner | Escalate to Tier 2 if verification/refund/dispute |
| **Tier 2** | Senior Agent / Verification Specialist | Verification document review, refund processing, campaign disputes, info requests | Escalate to Tier 3 if legal/compliance |
| **Tier 3** | Admin / Management | Legal issues, compliance, fraud investigation, policy decisions, bulk refunds | Final escalation |

### 10.4 Support Visibility on Site

**Header** (all pages):
```
ðŸ“ž Need help? Call us: 1-800-XXX-XXXX | ðŸ’¬ Chat with us | ðŸ“§ support@lastdonor.org
```

**Footer** (all pages):
```
â”Œâ”€â”€â”€ Get Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ðŸ“ž Phone: 1-800-XXX-XXXX (Mon-Fri 9am-6pm ET)    â”‚
â”‚ ðŸ’¬ Live Chat: Available 24/7                        â”‚
â”‚ ðŸ“§ Email: support@lastdonor.org                     â”‚
â”‚ ðŸ“± WhatsApp: +1-XXX-XXX-XXXX                       â”‚
â”‚ ðŸ¦ Twitter: @LastDonorOrg                           â”‚
â”‚ ðŸ“˜ Facebook: LastDonor.org                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Campaign page** (sidebar):
```
â”Œâ”€â”€â”€ Questions about this campaign? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Our team verifies every campaign.               â”‚
â”‚ If you have concerns, contact us:               â”‚
â”‚ [ðŸ’¬ Chat Now] [ðŸ“§ Email Us] [ðŸ“ž Call Us]        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Post-donation confirmation**:
```
Thank you for your donation!
Questions? We're here for you:
[ðŸ’¬ Chat] [ðŸ“§ Email] [ðŸ“ž Call] [ðŸ“± WhatsApp]
```

### 10.5 Proactive Support Touchpoints

Instead of waiting for users to reach out, implement proactive support. This is directly inspired by SpotFund's highest-praised practice â€” *"As soon as I created the funding page, someone from customer service emailed me and guided me through the process"* â€” and WhyDonate's personal agent model.

| Trigger | Action | Channel | Inspired By |
|---------|--------|---------|-------------|
| New campaigner creates account | Welcome message with verification guide + assigned support agent by name | Email + in-app | SpotFund (proactive welcome email) |
| Document upload stalled 48+ hours | "Need help uploading documents? I'm [Agent Name], here to help" | Email + chat prompt | SpotFund (proactive outreach) |
| Milestone evidence overdue 7+ days | "We noticed your milestone is overdue â€” can we help?" | Email + WhatsApp | WhyDonate (WhatsApp follow-up) |
| Donor's campaign cancelled | Proactive outreach: "Your refund is on the way" + alternative campaigns | Email | LastDonor original |
| First-time donor | "Thank you! Here's what happens next" educational email | Email | Industry best practice |
| Campaign reaches 50% | "Great progress! Here's how milestone fund release works" | Email to campaigner | SpotFund (campaign progress encouragement) |
| Support ticket unresolved 24+ hours | Auto-escalation to senior agent + apology message to user | Internal + email | WhyDonate (< 48h resolution) |
| Negative Trustpilot review posted | Respond within 24 hours with empathy + resolution pathway | Trustpilot | WhyDonate (100% response rate) |
| Campaign first donation received | "Congratulations! You received your first donation from [name]" | Email + in-app | SpotFund (celebration touchpoint) |
| Payout processed | "Your funds of $[amount] have been deposited â€” here's your receipt" | Email + SMS | SpotFund (payout confirmation) |

---

## 11. Database Schema Changes

### 11.1 New Enums

```sql
-- Expanded verification status
ALTER TYPE verification_status ADD VALUE 'submitted_for_review';
ALTER TYPE verification_status ADD VALUE 'documents_uploaded';
ALTER TYPE verification_status ADD VALUE 'identity_verified';
ALTER TYPE verification_status ADD VALUE 'fully_verified';
ALTER TYPE verification_status ADD VALUE 'info_requested';
ALTER TYPE verification_status ADD VALUE 'rejected';
ALTER TYPE verification_status ADD VALUE 'suspended';
-- Remove old values: 'unverified' â†’ 'submitted_for_review', 'pending' â†’ 'documents_uploaded', 'verified' â†’ 'fully_verified'

-- Expanded campaign status
ALTER TYPE campaign_status ADD VALUE 'paused';
ALTER TYPE campaign_status ADD VALUE 'under_review';
ALTER TYPE campaign_status ADD VALUE 'suspended';
ALTER TYPE campaign_status ADD VALUE 'cancelled';

-- Milestone status
CREATE TYPE milestone_status AS ENUM (
  'pending',
  'evidence_submitted',
  'approved',
  'rejected',
  'overdue'
);

-- Fund release status
CREATE TYPE fund_release_status AS ENUM (
  'held',
  'approved',
  'processing',
  'released',
  'refunded'
);

-- Info request status
CREATE TYPE info_request_status AS ENUM (
  'pending',
  'responded',
  'expired',
  'closed'
);

-- Support channel type
CREATE TYPE support_channel AS ENUM (
  'site_chat',
  'whatsapp',
  'email',
  'phone',
  'social_media'
);

-- New notification types
ALTER TYPE notification_type ADD VALUE 'campaign_paused';
ALTER TYPE notification_type ADD VALUE 'campaign_resumed';
ALTER TYPE notification_type ADD VALUE 'campaign_suspended';
ALTER TYPE notification_type ADD VALUE 'campaign_cancelled';
ALTER TYPE notification_type ADD VALUE 'info_request';
ALTER TYPE notification_type ADD VALUE 'info_request_reminder';
ALTER TYPE notification_type ADD VALUE 'milestone_approved';
ALTER TYPE notification_type ADD VALUE 'milestone_rejected';
ALTER TYPE notification_type ADD VALUE 'fund_released';
ALTER TYPE notification_type ADD VALUE 'verification_approved';
ALTER TYPE notification_type ADD VALUE 'verification_rejected';
ALTER TYPE notification_type ADD VALUE 'bulk_refund_processed';
```

### 11.2 New Tables

```sql
-- Verification documents uploaded by campaigner
CREATE TABLE verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  document_type TEXT NOT NULL,           -- 'government_id', 'selfie', 'hospital_letter', 'receipt', etc.
  file_url TEXT NOT NULL,                -- S3 pre-signed URL path
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,            -- bytes
  mime_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewer_id UUID REFERENCES users(id),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_verification_docs_campaign ON verification_documents(campaign_id);
CREATE INDEX idx_verification_docs_status ON verification_documents(status);

-- Campaign milestones (3 per campaign)
CREATE TABLE campaign_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 3),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_type TEXT NOT NULL,           -- 'document', 'photo', 'receipt', 'official_letter', 'other'
  fund_percentage INTEGER NOT NULL CHECK (fund_percentage BETWEEN 10 AND 60),
  estimated_completion TIMESTAMPTZ,
  status milestone_status NOT NULL DEFAULT 'pending',
  fund_amount INTEGER,                  -- calculated: campaign.raisedAmount * fund_percentage / 100
  released_amount INTEGER DEFAULT 0,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, phase)
);
CREATE INDEX idx_milestones_campaign ON campaign_milestones(campaign_id);
CREATE INDEX idx_milestones_status ON campaign_milestones(status);

-- Milestone evidence submissions
CREATE TABLE milestone_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES campaign_milestones(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  submitted_by UUID NOT NULL REFERENCES users(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewer_id UUID REFERENCES users(id),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_milestone_evidence_milestone ON milestone_evidence(milestone_id);
CREATE INDEX idx_milestone_evidence_campaign ON milestone_evidence(campaign_id);

-- Fund release records
CREATE TABLE fund_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  milestone_id UUID NOT NULL REFERENCES campaign_milestones(id),
  amount INTEGER NOT NULL,
  status fund_release_status NOT NULL DEFAULT 'held',
  stripe_transfer_id TEXT,
  stripe_connect_account TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fund_releases_campaign ON fund_releases(campaign_id);
CREATE INDEX idx_fund_releases_status ON fund_releases(status);

-- Admin information requests
CREATE TABLE info_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  requested_by UUID NOT NULL REFERENCES users(id),   -- admin
  target_user UUID NOT NULL REFERENCES users(id),     -- campaigner
  request_type TEXT NOT NULL,
  details TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status info_request_status NOT NULL DEFAULT 'pending',
  pause_campaign BOOLEAN NOT NULL DEFAULT false,
  response_text TEXT,
  response_files JSONB DEFAULT '[]'::jsonb,           -- array of file URLs
  responded_at TIMESTAMPTZ,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  escalated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_info_requests_campaign ON info_requests(campaign_id);
CREATE INDEX idx_info_requests_status ON info_requests(status);
CREATE INDEX idx_info_requests_deadline ON info_requests(deadline);

-- Donor campaign subscriptions (for email lifecycle updates)
CREATE TABLE donor_campaign_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_email TEXT NOT NULL,
  user_id UUID REFERENCES users(id),                  -- nullable (guests)
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  subscribed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(donor_email, campaign_id)
);
CREATE INDEX idx_donor_subs_campaign ON donor_campaign_subscriptions(campaign_id);
CREATE INDEX idx_donor_subs_email ON donor_campaign_subscriptions(donor_email);

-- Refund batches (for mass refund tracking)
CREATE TABLE refund_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  initiated_by UUID NOT NULL REFERENCES users(id),    -- admin
  reason TEXT NOT NULL,
  total_donations INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  refunded_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',           -- 'processing', 'completed', 'partial_failure'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refund_batches_campaign ON refund_batches(campaign_id);
CREATE INDEX idx_refund_batches_status ON refund_batches(status);

-- Individual refund records within a batch
CREATE TABLE refund_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES refund_batches(id),
  donation_id UUID NOT NULL REFERENCES donations(id),
  amount INTEGER NOT NULL,
  stripe_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',              -- 'pending', 'completed', 'failed'
  error_message TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refund_records_batch ON refund_records(batch_id);
CREATE INDEX idx_refund_records_donation ON refund_records(donation_id);

-- Bulk email sends
CREATE TABLE bulk_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID NOT NULL REFERENCES users(id),         -- admin
  template_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',                -- 'draft', 'sending', 'completed', 'failed'
  campaign_id UUID REFERENCES campaigns(id),           -- optional: if related to specific campaign
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bulk_emails_status ON bulk_emails(status);

-- Support conversations (unified across channels)
CREATE TABLE support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),                  -- nullable (anonymous)
  user_email TEXT,
  user_name TEXT,
  channel support_channel NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',                 -- 'open', 'assigned', 'pending_user', 'resolved', 'closed'
  priority TEXT NOT NULL DEFAULT 'normal',             -- 'low', 'normal', 'high', 'urgent'
  assigned_to UUID REFERENCES users(id),               -- support agent
  tier INTEGER NOT NULL DEFAULT 1,
  campaign_id UUID REFERENCES campaigns(id),           -- optional: if related to campaign
  external_conversation_id TEXT,                       -- Crisp/Intercom/WhatsApp conversation ID
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_support_conversations_status ON support_conversations(status);
CREATE INDEX idx_support_conversations_user ON support_conversations(user_id);
CREATE INDEX idx_support_conversations_channel ON support_conversations(channel);
```

### 11.3 Modifications to Existing Tables

```sql
-- campaigns table additions
ALTER TABLE campaigns ADD COLUMN cancellation_reason TEXT;
ALTER TABLE campaigns ADD COLUMN cancellation_notes TEXT;         -- internal admin notes
ALTER TABLE campaigns ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN paused_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN paused_reason TEXT;
ALTER TABLE campaigns ADD COLUMN suspended_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN suspended_reason TEXT;
ALTER TABLE campaigns ADD COLUMN verification_reviewer_id UUID REFERENCES users(id);
ALTER TABLE campaigns ADD COLUMN verification_reviewed_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN verification_notes TEXT;
ALTER TABLE campaigns ADD COLUMN milestone_fund_release BOOLEAN NOT NULL DEFAULT false;  -- flags 3-phase system enabled
ALTER TABLE campaigns ADD COLUMN total_released_amount INTEGER NOT NULL DEFAULT 0;

-- donations table additions (for campaign update subscriptions)
ALTER TABLE donations ADD COLUMN subscribed_to_updates BOOLEAN NOT NULL DEFAULT false;  
```

---

## 12. API Specifications

### 12.1 New API Endpoints

#### Verification APIs

```
POST   /api/v1/user-campaigns/[id]/verification/documents
  â€” Upload verification document (campaigner)
  â€” Body: multipart/form-data { file, documentType, description }
  â€” Returns: { documentId, status }

GET    /api/v1/user-campaigns/[id]/verification/status
  â€” Get verification status + documents list (campaigner)
  â€” Returns: { verificationStatus, documents[], reviewerNotes }

POST   /api/v1/user-campaigns/[id]/verification/submit
  â€” Submit verification for review (campaigner)
  â€” Transitions: submitted_for_review â†’ documents_uploaded
  â€” Notifies admin

PATCH  /api/v1/admin/campaigns/[id]/verification
  â€” Admin approve/reject verification
  â€” Body: { action: 'approve_t1' | 'approve_t2' | 'reject' | 'request_info', notes, deadline? }
  â€” Triggers notifications and status transitions

GET    /api/v1/admin/verification-queue
  â€” List campaigns pending verification review
  â€” Returns: paginated campaigns with verification details + documents
  â€” Filters: status, category, date range
```

#### Milestone APIs

```
POST   /api/v1/user-campaigns/[id]/milestones
  â€” Define campaign milestones (campaigner, during campaign creation)
  â€” Body: { milestones: [{ phase, title, description, evidenceType, fundPercentage, estimatedCompletion }] }
  â€” Constraint: exactly 3 milestones, percentages sum to 100

GET    /api/v1/user-campaigns/[id]/milestones
  â€” Get milestone status (campaigner)
  â€” Returns: milestones with evidence submissions, review status

POST   /api/v1/user-campaigns/[id]/milestones/[phase]/evidence
  â€” Upload milestone evidence (campaigner)
  â€” Body: multipart/form-data { files[], description }
  â€” Returns: { evidenceId, status, attemptNumber }

PATCH  /api/v1/admin/campaigns/[id]/milestones/[phase]
  â€” Admin approve/reject milestone evidence
  â€” Body: { action: 'approve' | 'reject', notes }
  â€” On approve: triggers fund release workflow

GET    /api/v1/admin/fund-release-queue
  â€” List milestones awaiting evidence review
  â€” Returns: paginated milestones with evidence, campaign details
```

#### Campaign Governance APIs

```
PATCH  /api/v1/admin/campaigns/[id]/pause
  â€” Pause campaign
  â€” Body: { reason, notifyDonors: boolean }
  â€” Disables donations, updates status badge, notifies subscribers

PATCH  /api/v1/admin/campaigns/[id]/resume
  â€” Resume paused campaign
  â€” Body: { notes }
  â€” Re-enables donations, notifies subscribers

PATCH  /api/v1/admin/campaigns/[id]/suspend
  â€” Suspend campaign for investigation
  â€” Body: { reason, internalNotes }
  â€” Disables donations, shows suspended badge

POST   /api/v1/admin/campaigns/[id]/cancel
  â€” Cancel campaign + trigger mass refund
  â€” Body: { reason, notifyDonors: true, refundAll: true }
  â€” Returns: { refundBatchId, donationsToRefund, totalAmount }

POST   /api/v1/admin/campaigns/[id]/request-info
  â€” Send information request to campaigner
  â€” Body: { requestType, details, deadline, pauseCampaign }
  â€” Creates notification + email to campaigner

GET    /api/v1/user-campaigns/[id]/info-requests
  â€” List info requests for campaigner's campaign
  â€” Returns: info requests with status, deadline

POST   /api/v1/user-campaigns/[id]/info-requests/[requestId]/respond
  â€” Campaigner responds to info request
  â€” Body: multipart/form-data { responseText, files[] }
```

#### Donor Subscription APIs

```
POST   /api/v1/campaigns/[slug]/subscribe
  â€” Subscribe to campaign updates (donor)
  â€” Body: { email } (or auto from session)
  â€” Creates donor_campaign_subscription record

DELETE /api/v1/campaigns/[slug]/subscribe
  â€” Unsubscribe from campaign updates
  â€” Body: { email, token } (token-based for guest unsubscribe)
```

#### Bulk Email APIs

```
GET    /api/v1/admin/bulk-email/templates
  â€” List available email templates
  â€” Returns: template definitions with variable placeholders

POST   /api/v1/admin/bulk-email/preview
  â€” Preview email with sample data
  â€” Body: { templateName, campaignId?, customSubject?, customBody? }
  â€” Returns: rendered HTML preview

POST   /api/v1/admin/bulk-email/send
  â€” Send bulk email to selected recipients
  â€” Body: { templateName, campaignId, recipientFilter, customSubject?, customBody? }
  â€” Returns: { bulkEmailId, recipientCount, estimatedSendTime }

GET    /api/v1/admin/bulk-email/[id]/status
  â€” Check send progress
  â€” Returns: { sent, failed, pending, status }
```

#### Refund Batch APIs

```
POST   /api/v1/admin/refunds/batch
  â€” Initiate batch refund (used by campaign cancellation)
  â€” Body: { campaignId, reason, donationIds?: string[] }
  â€” Returns: { batchId, totalDonations, totalAmount }

GET    /api/v1/admin/refunds/batch/[id]
  â€” Check refund batch progress
  â€” Returns: { status, processed, failed, individual records }
```

### 12.2 Modified Existing Endpoints

```
POST /api/v1/user-campaigns
  â€” MODIFIED: Now requires milestones array in body
  â€” New field: milestones[] (3 items, see milestone definition)
  â€” Campaign status: draft, verificationStatus: submitted_for_review

PATCH /api/v1/admin/campaigns/[id]  
  â€” MODIFIED: New status transitions added
  â€” New: draft|active|last_donor_zone â†’ paused
  â€” New: paused â†’ active (resume)
  â€” New: any â†’ suspended
  â€” New: any â†’ cancelled (triggers refund batch)
  â€” New: suspended â†’ active (reinstate)

POST /api/v1/donations/create-intent
  â€” MODIFIED: Accept subscribed_to_updates boolean
  â€” Creates donor_campaign_subscription if opted in

POST /api/v1/donations/webhook  
  â€” MODIFIED: On successful payment, if subscribed_to_updates, create subscription record
```

---

## 13. Email Templates & Notification Matrix

### 13.1 New Email Templates Required

| Template Name | Trigger | Recipients | Key Content |
|--------------|---------|-----------|-------------|
| `verificationDocumentsRequested` | Campaign submitted | Campaigner | "Upload your documents to verify your campaign" |
| `verificationIdentityApproved` | T1 approved | Campaigner | "Identity verified â€” complete story verification" |
| `verificationFullyApproved` | T2 approved | Campaigner | "Fully verified â€” your campaign can go live" |
| `verificationRejected` | Verification rejected | Campaigner | Rejection reason + how to resubmit |
| `verificationInfoRequested` | Admin needs more info | Campaigner | What's needed + deadline + upload link |
| `milestoneEvidenceApproved` | Milestone approved | Campaigner | "Phase [N] approved â€” $[amount] being released" |
| `milestoneEvidenceRejected` | Milestone rejected | Campaigner | Rejection reason + how to resubmit |
| `milestoneOverdueReminder` | Evidence overdue | Campaigner | "Your milestone evidence is overdue â€” please submit" |
| `fundReleased` | Funds transferred | Campaigner | "$[amount] transferred to your bank account" |
| `campaignPausedDonor` | Campaign paused | Subscribed donors | Pause reason + assurance funds are safe |
| `campaignResumedDonor` | Campaign resumed | Subscribed donors | Good news + campaign active again |
| `campaignSuspendedDonor` | Campaign suspended | Subscribed donors | Investigation underway + funds safe |
| `campaignCancelledRefund` | Campaign cancelled | ALL donors | Full refund + reason + alternative campaigns + CTA |
| `milestoneAchievedDonor` | Milestone verified | Subscribed donors | What was accomplished + evidence summary |
| `campaignCompletedDonor` | Campaign completed | Subscribed donors | Final outcome + impact summary + thank you |
| `infoRequestReminder` | Deadline approaching | Campaigner | "X days remaining to provide requested information" |
| `infoRequestExpired` | Deadline passed | Campaigner | "Your deadline has passed â€” campaign may be suspended" |
| `bulkRefundCompleted` | Batch refund done | Admin | Summary: X donors refunded, $Y total, Z failed |
| `welcomeCampaigner` | New campaign created | Campaigner | Welcome + verification guide + support channels |
| `welcomeDonor` | First donation | Donor | Thank you + what happens next + support channels |

### 13.2 `campaignCancelledRefund` Email â€” Detailed Specification

This is the most critical email template. Full specification:

```html
Subject: "Important: Your Donation to [Campaign Title] Has Been Refunded"

From: LastDonor.org <support@lastdonor.org>
Reply-To: support@lastdonor.org

Body Structure:
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  [LastDonor.org Logo]                                â”‚
â”‚                                                       â”‚
â”‚  Dear {{donor_name}},                                â”‚
â”‚                                                       â”‚
â”‚  We're writing to inform you that the campaign       â”‚
â”‚  "{{campaign_title}}" has been cancelled.            â”‚
â”‚                                                       â”‚
â”‚  WHAT HAPPENED                                        â”‚
â”‚  {{cancellation_reason_detail}}                       â”‚
â”‚  [e.g., "After thorough review, our verification     â”‚
â”‚  team found that the campaigner could not provide     â”‚
â”‚  authentic supporting documents for their story."]    â”‚
â”‚                                                       â”‚
â”‚  YOUR REFUND                                          â”‚
â”‚  Your donation of ${{donation_amount}} has been       â”‚
â”‚  fully refunded to your original payment method.      â”‚
â”‚  Please allow 5-10 business days for the refund       â”‚
â”‚  to appear on your statement.                         â”‚
â”‚                                                       â”‚
â”‚  Refund Reference: {{refund_reference}}               â”‚
â”‚                                                       â”‚
â”‚  OUR COMMITMENT TO YOU                                â”‚
â”‚  We take full responsibility for this situation.      â”‚
â”‚  At LastDonor.org, your trust is our highest          â”‚
â”‚  priority. We want you to know that your generous     â”‚
â”‚  support will never go to an unverified cause.        â”‚
â”‚  Every campaign on our platform undergoes rigorous    â”‚
â”‚  document verification before launch.                 â”‚
â”‚                                                       â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€            â”‚
â”‚                                                       â”‚
â”‚  YOU CAN STILL MAKE A DIFFERENCE                      â”‚
â”‚  Here are verified campaigns in {{category}} that     â”‚
â”‚  need your support:                                   â”‚
â”‚                                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
â”‚  â”‚ [Campaign Hero Image]                  â”‚           â”‚
â”‚  â”‚ {{similar_campaign_1_title}}           â”‚           â”‚
â”‚  â”‚ ${{raised}} raised of ${{goal}}       â”‚           â”‚
â”‚  â”‚ âœ… Fully Verified                      â”‚           â”‚
â”‚  â”‚ [DONATE NOW â€” orange button]           â”‚           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â”‚
â”‚                                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
â”‚  â”‚ [Campaign Hero Image]                  â”‚           â”‚
â”‚  â”‚ {{similar_campaign_2_title}}           â”‚           â”‚
â”‚  â”‚ ${{raised}} raised of ${{goal}}       â”‚           â”‚
â”‚  â”‚ âœ… Fully Verified                      â”‚           â”‚
â”‚  â”‚ [DONATE NOW â€” orange button]           â”‚           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â”‚
â”‚                                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
â”‚  â”‚ [Campaign Hero Image]                  â”‚           â”‚
â”‚  â”‚ {{similar_campaign_3_title}}           â”‚           â”‚
â”‚  â”‚ ${{raised}} raised of ${{goal}}       â”‚           â”‚
â”‚  â”‚ âœ… Fully Verified                      â”‚           â”‚
â”‚  â”‚ [DONATE NOW â€” orange button]           â”‚           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â”‚
â”‚                                                       â”‚
â”‚  [VIEW ALL VERIFIED CAMPAIGNS â€” teal button]          â”‚
â”‚                                                       â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€            â”‚
â”‚                                                       â”‚
â”‚  NEED HELP?                                           â”‚
â”‚  ðŸ“ž Call us: 1-800-XXX-XXXX                          â”‚
â”‚  ðŸ’¬ Live Chat: lastdonor.org/chat                    â”‚
â”‚  ðŸ“§ Email: support@lastdonor.org                     â”‚
â”‚  ðŸ“± WhatsApp: +1-XXX-XXX-XXXX                       â”‚
â”‚                                                       â”‚
â”‚  With gratitude,                                      â”‚
â”‚  The LastDonor.org Team                               â”‚
â”‚                                                       â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€            â”‚
â”‚  [Unsubscribe] | [Email Preferences] | [Privacy]     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 13.3 Notification Type Additions

Add to existing `notificationTypeEnum`:

```
'campaign_paused'
'campaign_resumed'
'campaign_suspended'
'campaign_cancelled'
'info_request'
'info_request_reminder'
'info_request_expired'
'milestone_approved'
'milestone_rejected'
'milestone_overdue'
'fund_released'
'verification_approved'
'verification_rejected'
'verification_info_requested'
'bulk_refund_initiated'
'bulk_refund_completed'
```

---

## 14. Admin UI Specifications

### 14.1 New Admin Pages/Tabs

| Page | Route | Purpose |
|------|-------|---------|
| Verification Queue | `/admin/verification` | List campaigns awaiting verification review |
| Fund Release Queue | `/admin/fund-releases` | List milestones with evidence awaiting approval |
| Campaign Governance | `/admin/campaigns/[id]/governance` | Full governance view (status, verification, milestones, info requests, audit trail) |
| Bulk Email | `/admin/communications` | Create and send bulk emails |
| Refund Batches | `/admin/refunds` | Track mass refund progress |
| Support Dashboard | `/admin/support` | Unified support conversations across channels |
| Info Requests | `/admin/info-requests` | Track open information requests and deadlines |

### 14.2 Verification Queue

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  VERIFICATION QUEUE                                    [Filter â–¼]  â”‚
â”‚                                                                      â”‚
â”‚  â”Œâ”€â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Awaiting Review: 12 â”‚ In Progress: 3 â”‚ Avg Review Time: 18h â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                                      â”‚
â”‚  # â”‚ Campaign        â”‚ Category â”‚ Submitted â”‚ Docs â”‚ Status        â”‚
â”‚  â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚
â”‚  1 â”‚ Help Sarah...  â”‚ Medical  â”‚ 2h ago    â”‚ 4/4  â”‚ ðŸŸ¡ Ready      â”‚
â”‚  2 â”‚ Rebuild Home   â”‚ Disaster â”‚ 5h ago    â”‚ 3/5  â”‚ âšª Incomplete  â”‚
â”‚  3 â”‚ School Fees    â”‚ Educationâ”‚ 1d ago    â”‚ 3/3  â”‚ ðŸŸ¡ Ready      â”‚
â”‚  4 â”‚ Community Well â”‚ Communityâ”‚ 2d ago    â”‚ 5/5  â”‚ ðŸ”µ T1 Done    â”‚
â”‚                                                                      â”‚
â”‚  [Click row â†’ Opens verification review panel]                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 14.3 Fund Release Queue

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  FUND RELEASE QUEUE                                    [Filter â–¼]  â”‚
â”‚                                                                      â”‚
â”‚  # â”‚ Campaign       â”‚ Phase â”‚ Amount   â”‚ Evidence â”‚ Submitted â”‚ Act â”‚
â”‚  â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”‚
â”‚  1 â”‚ Help Sarah    â”‚ 2/3   â”‚ $6,000   â”‚ 3 files  â”‚ 1d ago    â”‚ [â–¶] â”‚
â”‚  2 â”‚ Rebuild Home  â”‚ 1/3   â”‚ $4,500   â”‚ 2 files  â”‚ 3d ago    â”‚ [â–¶] â”‚
â”‚  3 â”‚ School Fees   â”‚ 3/3   â”‚ $2,000   â”‚ 4 files  â”‚ 5d ago    â”‚ [â–¶] â”‚
â”‚                                                                      â”‚
â”‚  [â–¶] = Review Evidence â†’ Approve / Reject / Request More            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 15. Implementation Phases & Milestones

### Phase 1: Foundation (Weeks 1-4)

| Week | Deliverable | Details |
|------|------------|---------|
| **W1** | Schema migration | New enums, tables (verification_documents, campaign_milestones, milestone_evidence, fund_releases, info_requests, donor_campaign_subscriptions) |
| **W1** | Campaign status expansion | Add paused, under_review, suspended, cancelled to campaign_status enum |
| **W1** | Verification status expansion | Replace old 3-value enum with 7-value enum |
| **W2** | Verification document upload API | POST /api/v1/user-campaigns/[id]/verification/documents |
| **W2** | Verification submission API | POST /api/v1/user-campaigns/[id]/verification/submit |
| **W2** | Admin verification review API | PATCH /api/v1/admin/campaigns/[id]/verification |
| **W2** | Verification queue API | GET /api/v1/admin/verification-queue |
| **W3** | Milestone definition API | POST /api/v1/user-campaigns/[id]/milestones |
| **W3** | Milestone evidence submission API | POST /api/v1/user-campaigns/[id]/milestones/[phase]/evidence |
| **W3** | Admin milestone review API | PATCH /api/v1/admin/campaigns/[id]/milestones/[phase] |
| **W3** | Fund release queue API | GET /api/v1/admin/fund-release-queue |
| **W4** | Admin verification queue UI | /admin/verification page |
| **W4** | Admin fund release queue UI | /admin/fund-releases page |
| **W4** | Campaign creation flow update | Add milestone definition step to Share Your Story form |
| **W4** | Campaigner verification dashboard | /dashboard/campaigns/[id]/verification page |

### Phase 2: Governance & Transparency (Weeks 5-8)

| Week | Deliverable | Details |
|------|------------|---------|
| **W5** | Campaign governance APIs | Pause, resume, suspend, cancel, request-info endpoints |
| **W5** | Info request system | Create/respond/remind/escalate flow |
| **W5** | Automated escalation cron | Check overdue info requests, milestone evidence deadlines |
| **W6** | Donor subscription system | Opt-in at donation, subscription management, unsubscribe |
| **W6** | Campaign status badges | Public-facing badges with hover tooltips for all new statuses |
| **W6** | Campaign timeline component | Status history timeline on campaign page |
| **W7** | Donor lifecycle emails | All 20 new email templates (Section 13) |
| **W7** | Mass refund engine | Batch refund processing with Stripe API |
| **W7** | Campaign cancelled refund email | With similar campaign recommendations |
| **W8** | Admin governance panel | Campaign governance tab with full status/verification/milestone/audit view |
| **W8** | Admin info requests dashboard | /admin/info-requests page |
| **W8** | Integration testing | All new APIs and workflows |

### Phase 3: Donor Protection & Bulk Operations (Weeks 9-11)

| Week | Deliverable | Details |
|------|------------|---------|
| **W9** | Bulk email system | Template management, recipient selection, variable interpolation, send/track |
| **W9** | Admin bulk email UI | /admin/communications page |
| **W9** | Refund batch tracking | /admin/refunds page with progress monitoring |
| **W10** | Re-engagement CTA engine | Similar campaign recommendation algorithm |
| **W10** | Automated refund emails | Campaign cancellation â†’ automatic refund + email with alternatives |
| **W10** | Trust badge integration | Verification badges, milestone progress, fund release indicators on campaign cards and pages |
| **W11** | End-to-end testing | Full flow: create â†’ verify â†’ fund â†’ milestone â†’ complete |
| **W11** | Security audit | Document storage, PII handling, access controls |

### Phase 4: Multi-Channel Support (Weeks 12-15)

| Week | Deliverable | Details |
|------|------------|---------|
| **W12** | Live chat integration | Crisp/Intercom setup, widget placement, AI chatbot training |
| **W12** | Support conversations DB | support_conversations table, CRUD APIs |
| **W13** | WhatsApp Business API | Twilio integration, message templates, inbound routing |
| **W13** | Email support inbox | Help Scout/Front setup, auto-categorization |
| **W14** | Phone support system | Twilio Voice IVR, call routing, voicemail |
| **W14** | Social media monitoring | Hootsuite/Sprout Social unified inbox |
| **W15** | Proactive support automation | Trigger-based outreach (document stalls, milestone overdue, etc.) |
| **W15** | Admin support dashboard | /admin/support page with unified conversation view |

### Phase 5: Polish & Launch (Weeks 16-18)

| Week | Deliverable | Details |
|------|------------|---------|
| **W16** | Trust page | Public /trust page explaining verification process, milestones, guarantee |
| **W16** | FAQ update | Updated FAQ with trust guarantee, verification process, refund policy |
| **W17** | Performance optimization | Ensure refund batches, email sends, and verification queries are performant |
| **W17** | Load testing | Simulate mass refund of 1000+ donations |
| **W18** | Documentation | Internal SOP for verification reviewers, support agents |
| **W18** | Launch | Feature flag rollout â†’ public launch |

---

## 16. Security & Compliance

### 16.1 Document Security

| Requirement | Implementation |
|-------------|---------------|
| **Encryption at rest** | AWS S3 with AES-256 SSE |
| **Encryption in transit** | TLS 1.3 for all API calls and S3 transfers |
| **Access control** | Pre-signed URLs with 15-minute expiry; admin role required |
| **Audit trail** | Every document view, download, and review logged in auditLogs |
| **PII minimization** | Government IDs auto-blurred in preview; full view requires explicit action |
| **Retention** | Documents stored for 7 years post-campaign (regulatory compliance) |
| **GDPR compliance** | Right to erasure: campaigner can request document deletion after campaign archive |
| **SOC 2 readiness** | All access logged, encrypted, access-controlled |

### 16.2 Financial Controls

| Requirement | Implementation |
|-------------|---------------|
| **Escrow** | Funds held in Stripe until milestone approval (not transferred to campaigner) |
| **Dual approval** | Fund releases > $10,000 require two admin approvals |
| **Refund verification** | All refunds cross-referenced with Stripe payment records |
| **Reconciliation** | Daily cron verifies fund_releases match Stripe transfers |
| **Rate limiting** | Refund batch: max 50 per minute (Stripe API limits) |
| **Idempotency** | Stripe refund IDs stored; duplicate refund attempts blocked |

### 16.3 Communication Security

| Requirement | Implementation |
|-------------|---------------|
| **Email authentication** | DKIM, SPF, DMARC configured for lastdonor.org |
| **Unsubscribe** | One-click unsubscribe per CAN-SPAM |
| **Token-based unsubscribe** | Guest donors unsubscribe via signed token in email link |
| **No PII in emails** | Emails never include full government IDs, bank details, or passwords |
| **WhatsApp identity** | Verify user identity before sharing account details via WhatsApp |

---

## 17. Metrics & Success Criteria

### 17.1 Key Performance Indicators (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Verification completion rate** | > 85% of submitted campaigns complete verification within 7 days | verification_documents + campaigns tables |
| **Average verification review time** | < 48 hours from documents_uploaded to T2 approved | Timestamp diff in campaigns table |
| **Milestone evidence submission rate** | > 90% of Phase 1 milestones submitted within 30 days of estimated date | campaign_milestones table |
| **Fund release accuracy** | 100% of releases match approved milestone amounts | fund_releases + campaign_milestones reconciliation |
| **Refund processing time** | < 5 business days from cancellation to all refunds processed | refund_batches completed_at - started_at |
| **Donor retention after refund** | > 25% of refunded donors donate to recommended campaign within 30 days | Track clicks on refund email CTAs â†’ new donations |
| **Support response time â€” chat** | < 5 minutes (human) during business hours | support_conversations created_at â†’ first response |
| **Support response time â€” email** | < 2 hours during business hours | Help Scout/Front metrics |
| **Support response time â€” WhatsApp** | < 30 minutes during business hours | WhatsApp Business API metrics |
| **Support satisfaction score** | > 4.5/5 CSAT | Post-conversation survey |
| **Fraud detection rate** | 100% of fraudulent campaigns caught before fund release | Verification rejections / total verified |
| **Donor trust score** (survey) | > 8/10 "I trust that my donation is used as promised" | Quarterly donor survey |
| **Campaign transparency engagement** | > 40% of donors view at least one milestone update | Analytics on milestone update page views |
| **Trustpilot review response rate** | 100% of negative reviews responded to within 24 hours (matching WhyDonate's 100% standard) | Trustpilot dashboard |
| **Trustpilot rating target** | > 4.7â˜… within first year (matching SpotFund) | Trustpilot |
| **Named agent recognition** | > 20% of positive reviews mention support agent by name (matching WhyDonate pattern) | Trustpilot review analysis |

### 17.2 Operational Metrics

| Metric | Target |
|--------|--------|
| Verification queue length | < 20 campaigns at any time |
| Fund release queue length | < 10 milestones at any time |
| Open info requests | < 15 at any time |
| Overdue info requests | 0 (all escalated within 24 hours) |
| Unresolved support tickets > 24h | < 5 at any time |
| Bulk email send completion | > 99% delivery rate |
| Refund batch failure rate | < 1% of individual refunds fail |

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **T1** | Tier 1 â€” Identity Verified (government ID + selfie confirmed) |
| **T2** | Tier 2 â€” Fully Verified (identity + story documents confirmed) |
| **Milestone** | A predefined checkpoint at which the campaigner must provide evidence of fund usage |
| **Phase** | One of three fund release phases tied to milestones |
| **Escrow** | Funds held by LastDonor (via Stripe) until milestone approval |
| **Info Request** | Admin-initiated request for additional information/documents from campaigner |
| **Refund Batch** | A group of refunds processed simultaneously when a campaign is cancelled |
| **Donor Subscription** | Opt-in email updates for a specific campaign |
| **Verification Queue** | Admin view of campaigns awaiting document review |
| **Fund Release Queue** | Admin view of milestones awaiting evidence review |
| **CSAT** | Customer Satisfaction Score |

---

## Appendix B: Trust Page Content Outline

A public-facing `/trust` page explaining the LastDonor Trust Guarantee:

1. **Hero**: "Every Campaign Verified. Every Dollar Accountable. Every Donor Protected."
2. **How Verification Works**: Visual 4-step process (Submit â†’ Documents â†’ Review â†’ Verified badge)
3. **Milestone-Based Fund Release**: Visual 3-phase diagram with evidence examples
4. **Our Guarantee**: "If we cancel a campaign, you get a full refund â€” no questions asked."
5. **Campaign Transparency**: Example of status badges, timeline, update visibility
6. **Real Support, Real People**: Support channel showcase with response time guarantees
7. **FAQ**: Common trust questions
8. **Comparison**: "How we compare" table vs. GoFundMe, GiveSendGo, SpotFund, WhyDonate (factual, non-disparaging â€” highlight our verification + milestones as unique advantages even over SpotFund/WhyDonate)

---

*This document is the single source of truth for the Trust, Verification & Accountability USP implementation. All development work should reference this specification.*
