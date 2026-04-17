# 25 â€” Core Messaging Architecture

> **Purpose**: Define the exact language, tone, and psychological framework that governs every word LastDonor puts in front of donors, campaigners, and the public. Every phrase in this document was shaped by research across 24,000+ Trustpilot reviews, dozens of Reddit threads, competitor analysis, and donor behavior studies. This is not aspiration. This is the operating standard.

> **Date**: March 31, 2026

> **Scope**: All user-facing copy: website UI, campaign pages, checkout flow, emails, support conversations, social media, marketing, error states, and notifications. Nothing goes to a user that contradicts this document.

---

## Table of Contents

1. [The Three Governing Principles](#1-the-three-governing-principles)
2. [Language Psychology: Words That Build and Words That Break](#2-language-psychology-words-that-build-and-words-that-break)
3. [Ambient Trust: Show, Never Claim](#3-ambient-trust-show-never-claim)
4. [Donor Messaging Architecture](#4-donor-messaging-architecture)
5. [Campaigner Messaging Architecture](#5-campaigner-messaging-architecture)
6. [Fee and Pricing Language](#6-fee-and-pricing-language)
7. [Verification Messaging: The Supportive Frame](#7-verification-messaging-the-supportive-frame)
8. [Fund Release and Milestone Language](#8-fund-release-and-milestone-language)
9. [Customer Service Voice](#9-customer-service-voice)
10. [Sharing and Amplification Copy](#10-sharing-and-amplification-copy)
11. [Error, Rejection, and Difficult Moment Language](#11-error-rejection-and-difficult-moment-language)
12. [Marketing and Public Positioning](#12-marketing-and-public-positioning)
13. [Tone Calibration by Campaign Context](#13-tone-calibration-by-campaign-context)
14. [Copy Anti-Patterns: What We Never Say](#14-copy-anti-patterns-what-we-never-say)
15. [Appendix: Research Anchors](#15-appendix-research-anchors)

---

## 1. The Three Governing Principles

Every word on the platform passes through these three filters. If a sentence fails any one, it gets rewritten.

### Principle 1: Empower, Never Frighten

Neither donors nor campaigners should ever feel warned, pressured, or suspicious after reading our copy. We do not sell safety from danger. We offer clarity so people can act with confidence.

- **Wrong instinct**: "Your donations are protected from fraud."
  - This activates the concept of fraud in the reader's mind. It implies danger exists on the platform.
- **Right instinct**: "See exactly where your donation goes."
  - This gives the donor agency. They are the one seeing. No threat is implied.

**Research anchor**: GoFundMe's Giving Guarantee page opens with refund language and fraud investigation language. Trustpilot reviews from high-rated platforms (SpotFund 4.7, WhyDonate 4.9) rarely mention fraud at all. Trust is felt, not announced.

### Principle 2: Support, Never Scrutinize

Campaigners are people asking for help. Many are in the hardest moments of their lives. Every interaction should feel like someone is walking alongside them, not standing in their way. Verification should feel like a hand on their shoulder, not a flashlight in their face.

- **Wrong instinct**: "We need to verify your identity before your campaign can go live."
  - This sounds like a checkpoint. The campaigner is a suspect until cleared.
- **Right instinct**: "Let's confirm your details so donors can see your story is real."
  - The purpose is shared (help donors trust you). The action is collaborative (let's). The campaigner is the protagonist, not the subject of review.

**Research anchor**: GoFundMe's 1-star reviews reveal that account suspensions "without explanation" and verification delays of "weeks" are among the top reasons campaigners abandon the platform. The frustration is not that verification exists. It is that verification feels adversarial.

### Principle 3: Be Specific, Never Vague

Vague claims invite skepticism. Specific details create trust. "We're transparent" means nothing. A line-by-line breakdown before checkout means everything.

- **Wrong instinct**: "We believe in full transparency."
  - This is a claim. Claims require proof. The reader has to take your word for it.
- **Right instinct**: Showing the donor a pre-checkout breakdown:
  ```
  Your donation: $50.00
  Processing (Stripe): $1.75
  Platform support (optional): $0.00
  Total charged: $51.75
  Amount to [Organizer Name]: $50.00
  ```
  - This IS transparency. No claim necessary. The action speaks.

**Research anchor**: "I think that an explanation of what the tip amount funds and a suggested amount is a better option" (John Esposito, Trustpilot). Even frustrated donors don't hate fees. They hate confusion. Specificity resolves confusion before it forms.

---

## 2. Language Psychology: Words That Build and Words That Break

### 2.1 Words We Choose

These words appear naturally throughout LastDonor's copy. They are calibrated to create confidence, agency, and warmth.

| Word | Why It Works | Example |
|------|-------------|---------|
| **You / Your** | Places the reader at the center. Makes them the actor, not the audience. | "Your donation reaches real people." |
| **See** | Implies openness without claiming transparency. Gives the reader visual control. | "See where every dollar goes." |
| **Know** | Creates certainty without making promises. Internal confidence. | "Know your support made a difference." |
| **Real** | Authenticates without accusing alternatives of being fake. Affirms rather than contrasts. | "Real people. Real stories." |
| **Every** | Thoroughness without absolutism. Feels complete without sounding defensive. | "Every campaign has a name, a story, and a goal." |
| **Choose** | Agency. The donor or campaigner is in control. Nothing is imposed. | "You choose what to give. You choose how to help." |
| **Follow** | Ongoing relationship. Implies updates, progress, completion. Not one-and-done. | "Follow this campaign to see it through." |
| **Together** | Shared purpose. Neither side is alone. Donor + campaigner + platform as a team. | "Together, we got there." |
| **People** | Human. Not "users" (tech), not "beneficiaries" (bureaucratic), not "clients" (transactional). | "People helping people, with nothing in the way." |
| **Clear** | Openness without drama. Nothing is hidden because there is nothing to hide. | "Clear pricing. Clear progress. Clear impact." |
| **Here** | Presence. Immediacy. We exist, we are reachable, we are not a faceless system. | "We're here. Real people, real answers." |
| **Reach** | Progress toward a goal. Positive forward motion. | "Help this campaign reach its goal." |

### 2.2 Words and Phrases We Avoid

These words are never used in donor-facing or campaigner-facing copy. Some may appear in internal documents, SEO articles, or competitive research, but never in the platform experience.

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Scam / Fraud** | Activates fear. Makes the reader think about deception on the platform, even when you're denying it. | Don't reference it. Let verification badges and updates show integrity silently. |
| **Safe / Secure** (as primary message) | Implies danger. If a restaurant's sign says "OUR FOOD IS SAFE," you worry. | **Clear / Open / Visible**. Safety is felt through visibility, not asserted. |
| **Hidden fees** (even negated) | "No hidden fees" plants the idea that fees could be hidden. The reader now wonders. | Simply show the breakdown. Let obviousness do the work. |
| **Unlike [competitor]** | Competitive framing makes you the alternative, not the standard. It invites comparison and scrutiny. | Be the standard. Don't reference others. |
| **Guarantee** (in headlines) | Legal connotation. Implies something is likely to go wrong, which is why a guarantee is needed. | **Promise / Commitment** for human-scale language. |
| **Must / Required** | Demanding. Creates friction. The campaigner feels they are being told what to do. | **"We'll need" / "This helps donors see"** - collaborative, purposeful. |
| **Denied / Rejected** | Finality. Closes the door. Feels institutional. | **"Needs a closer look" / "Let's revisit this"** - keeps the door open. |
| **Free** (as a headline claim) | Overused across the industry. Triggers skepticism ("if it's free, you're the product"). | **"No platform fee. You decide what to give."** - specificity over claims. |
| **Verify** (as a command to campaigners) | Interrogation frame. "Verify your identity" sounds like a police procedure. | **"Confirm your details"** - sounds like agreeing, not proving. |
| **Problem** (in support contexts) | Implies something is broken. Sets a negative frame. | **"Question"** - implies curiosity, not crisis. "Have a question? We're here." |
| **Victim / Suffering / Helpless** | Strips dignity. People in hard situations are not defined by their hardship. | **Name + situation.** "Maria needs help with her daughter's treatment." Not "Maria is a victim." |
| **Trust us** | If you have to say it, it is already in question. | Never say it. Build trust through actions, structure, and design. |

### 2.3 Phrase-Level Replacements

| Instead of... | Write... | Why |
|--------------|---------|-----|
| "Your money is safe with us" | "See where every dollar goes" | Agency over assurance |
| "We verify every campaign" | "Every campaign has a face, a story, and a goal you can follow" | Humanity over process |
| "No hidden fees" | "You'll see the full breakdown before you donate" | Specificity over negation |
| "We protect donors" | "You'll always know where your donation went" | Knowledge over protection |
| "Report a scam" | "Something doesn't look right? Let us know." | Low friction over alarm |
| "Your campaign was rejected" | "Your campaign needs a bit more detail. Here's what would help." | Path forward over closed door |
| "Verification required" | "One more step so donors can see your story is real" | Purpose over procedure |
| "Milestone denied" | "We have a few questions about this update. Let's connect." | Conversation over verdict |
| "Having problems?" | "Have a question? We're here." | Curiosity over crisis |
| "Donate now" (generic) | "Fund [Name]'s recovery" or "Help close this campaign" | Person-specific over generic |
| "Guaranteed secure checkout" | "Powered by Stripe" + lock icon | Industry trust over self-assertion |
| "Start a fundraiser" | "Share your story" | Emotional invitation over transactional command |
| "We are the most trusted" | [never say this] | Trust is demonstrated, never declared |

---

## 3. Ambient Trust: Show, Never Claim

Ambient trust is trust that is felt through the environment, not asserted through words. A well-lit, clean store does not need a sign saying "THIS STORE IS CLEAN." The cleanliness communicates itself.

Applied to LastDonor: we never tell people to trust us. We build an experience where trust is the natural conclusion.

### 3.1 Trust Through Structure

| Element | What the User Sees | What It Communicates (Without Words) |
|---------|-------------------|-------------------------------------|
| Progress bar on every campaign | How close the campaign is to its goal | Accountability. The number is real and moving. |
| Verified badge on campaigner | A small check mark next to the campaigner's name | This person confirmed their identity. |
| Update timeline on campaign page | Chronological updates with dates | Things are happening. This is active and real. |
| Donor feed (recent donations) | "Sarah donated $25 - 2 hours ago" | Other people trust this. Social proof. |
| Pre-checkout breakdown | Line-by-line cost display | Nothing is hidden. What you see is what you pay. |
| Milestone progress (for fund release) | "Phase 1: Funds released. Phase 2: In progress." | Money goes where it's supposed to. There's accountability. |
| Real support agent name in chat | "You're speaking with Marcus" | This is a person, not a bot. |
| Response to negative reviews (Trustpilot, social) | A calm, specific, helpful response to every complaint | This organization cares enough to answer. |

### 3.2 Trust Through Absence

What is NOT present matters as much as what is.

| What's Absent | What It Communicates |
|--------------|---------------------|
| No pre-selected tip on checkout | Your choice is genuinely yours. |
| No pop-ups pressuring "add a tip for us" | We are not trying to extract money from you. |
| No "Are you sure?" when setting tip to $0 | We respect your decision without guilt. |
| No recurring donation auto-enrollment | We don't sign you up for things you didn't ask for. |
| No gamification of tip amounts ("Most donors tip 15%!") | We don't use social pressure to inflate our revenue. |
| No countdown timers or urgency language on checkout | We don't manufacture pressure. Real urgency comes from real situations, not blinking clocks. |

**Research anchor**: "I made a donation and this time they added a tip on without my permission... I do not think this is right. You should have the option of adding a tip, not be forced to remove one." (Susan Gallo, Trustpilot 2-star). The absence of manipulation is itself a trust signal.

---

## 4. Donor Messaging Architecture

### 4.1 First Visit: Homepage

The homepage has one job: make the donor believe that giving here means something.

**Hero Section**

Primary headline (one at a time, rotating with active campaigns):
> "Mike needs $4,200 for his daughter's surgery. He's 71% there."

Secondary line:
> "Every campaign on LastDonor has a real person, a clear goal, and a finish line."

CTA button:
> "See Mike's story" (not "Donate now" - the donor needs context before being asked for money)

**Trust bar** (below hero, single line):
> 501(c)(3) nonprofit Â· Every campaign verified Â· $0 platform fee

Notes on the trust bar:
- "501(c)(3) nonprofit" is a factual credential. It requires no proof because it's verifiable.
- "Every campaign verified" is specific and checkable. It does not say "the most trusted" (a claim). It says "every campaign verified" (a fact about process).
- "$0 platform fee" is specific. It avoids "free" because "free" is a claim that invites scrutiny. "$0 platform fee" is a number. Numbers are harder to argue with.

**Active Campaigns Section**

Each campaign card shows:
- Campaigner's real photo and first name
- One-sentence need: "Maria, 34, from El Paso. Her daughter needs a wheelchair-accessible van."
- Progress bar with percentage and dollar amount
- Number of donors

No card shows:
- Fear-based language ("URGENT" badges, countdown timers)
- Platform self-promotion
- Any reference to what other platforms do or don't do

### 4.2 Campaign Page

The campaign page converts interest into action. Every element answers a donor question before they have to ask.

**Before the story (above the fold)**:
- Campaign photo (face visible when possible)
- Campaigner name + verified badge (subtle, a small check icon)
- Progress bar with: $X,XXX raised of $Y,YYY goal Â· Z donors
- CTA: "Donate to [Name]'s campaign"
- Share buttons: positioned for action, not as an afterthought

**The story** (follows the 5-section template from Content Strategy):
- Hook, meet them, the situation, the gap, the ask
- Written in first-person where possible ("My name is Maria...")
- Or compassionate third-person by editorial team: "Maria has been carrying this alone."

**Sidebar / below story**:
- Recent donations with optional messages
- Campaign updates (chronological, with dates)
- Campaigner details: name, relationship to cause, verification status

**What is NOT on the campaign page**:
- "This campaign is/isn't verified" warning boxes (the badge presence or absence is enough)
- Competitive comparisons ("only on LastDonor")
- Fear-based urgency language ("Time is running out!")
- Auto-playing video

### 4.3 Checkout Flow

This is the most psychologically sensitive moment. The donor has decided to give. Every element must confirm their decision, not create doubt.

**Step 1: Choose amount**
- Preset amounts ($25, $50, $100) with impact labels:
  > "$25 covers a week of groceries for Maria's family"
  > "$50 covers one physical therapy session"
  > "$100 covers the insurance co-pay Maria can't afford"
- Custom amount field
- Optional message to the campaigner

**Step 2: Review before payment**
```
Your donation to Maria Gutierrez
--------------------------------------
Donation amount:              $50.00
Payment processing (Stripe):   $1.75
Support LastDonor (optional):   $0.00  [Change]
--------------------------------------
Total charged:                $51.75
Amount Maria receives:        $50.00
```

Key design decisions:
- "Support LastDonor (optional)" starts at $0.00. Not $5. Not 15%. Zero.
- The [Change] link is visible but not prominent. No slider. No pre-selected percentages.
- If the donor taps [Change], a simple text field appears: "Enter any amount you'd like to contribute to keeping LastDonor running." No suggested amounts. No social proof like "Most donors give $X." Just a blank field.
- "Amount Maria receives" is the anchor. The donor's eyes go here. This is what matters to them. It should be the largest, most prominent number.
- "Powered by Stripe" with Stripe logo and lock icon. Stripe's brand equity handles security communication so we don't have to.

**Step 3: Payment**
- Standard Stripe Elements (card, Apple Pay, Google Pay)
- Button text: "Complete your donation of $51.75"
- Below button: "You'll receive a receipt by email."
- No additional upsells, no "would you like to make this monthly?" pre-checked boxes

### 4.4 Post-Donation Experience

The moment after giving is when emotional connection is strongest. This is where loyalty begins.

**Confirmation screen**:
> "Thank you, [Donor Name]. Maria's campaign just got $50 closer."
> Progress bar showing the updated percentage
> "You'll receive a receipt at [email]. We'll send you updates as this campaign progresses."

**Confirmation email** (sent immediately):
- Subject: "You just helped Maria get closer to her goal"
- Body:
  > Hi [Donor First Name],
  >
  > Your donation of $50.00 to Maria Gutierrez's campaign has been processed.
  >
  > Donation: $50.00
  > Processing fee: $1.75
  > Platform support: $0.00
  > Total charged: $51.75
  >
  > Maria's campaign has now raised $3,250 of its $4,200 goal. You're part of the reason this is happening.
  >
  > We'll let you know when there's an update.
  >
  > â€” The LastDonor team

Notes:
- The email restates the breakdown. This is intentional. It reinforces that nothing was hidden.
- "You're part of the reason this is happening" connects the donor to the outcome. Not "thank you for your generosity" (generic) or "your money is safe" (fear-based).
- The sign-off is "The LastDonor team," not "The LastDonor Family" (forced intimacy) or just "LastDonor" (cold).

**Campaign update email** (when campaign posts an update):
- Subject: "Update on Maria's campaign: The van is on order"
- Short, specific. Tells the donor their money is in motion.

**Campaign completion email**:
- Subject: "Maria's campaign reached its goal. You were part of it."
- Body includes final breakdown, photo, and what happened next.
- Ends with: "See other campaigns that need your help" (gentle re-engagement, not aggressive)

### 4.5 Returning Donor Experience

**Dashboard** (for registered donors):
- "Your impact": Total donated, campaigns supported, campaigns completed
- "Campaigns you follow": Status updates, progress bars
- Badges earned (First Believer, Momentum Builder, Closer, Last Donor)
- "New campaigns that might matter to you" (based on categories they've donated to before)

**Language throughout the dashboard**:
- "You've supported 7 campaigns and helped close 3."
- Not: "You've donated $430" (reduces the act to a transaction)
- Not: "Your generous contributions" (flattery feels performative)

The dashboard communicates IMPACT, not transaction history. The donor should feel like a participant, not a customer.

---

## 5. Campaigner Messaging Architecture

### 5.1 Discovery: Why Start a Campaign Here?

The first question every potential campaigner asks: "Why should I use this platform instead of the one everyone knows?"

**Landing page for campaigners** (linked from nav: "Share Your Story"):

Headline:
> "When people see your story is real, they give."

Subheadline:
> "LastDonor helps you share your story with the world. We confirm your details, set up your campaign, and make sure every donor knows their money is going where you say it is."

The following details appear as simple icon+text rows:

> **Your story, your way.** Write it yourself or let our tools help you find the right words.

> **People can follow your progress.** Donors see updates, milestones, and exactly how funds are used.

> **A real person is here to help.** Questions about your campaign? Reach a human by chat, email, or phone.

> **You keep what you raise.** No need to hit your full goal. Every dollar goes to you, minus standard card processing.

What this page does NOT say:
- "Unlike GoFundMe..." or any competitor reference
- "We're the most transparent / trusted / honest platform" (claims)
- "Millions raised" or any metric that highlights our smaller scale vs. incumbents
- "Apply now" (application framing implies possible rejection)

The CTA button says: **"Start your campaign"** (not "Apply" or "Submit" or "Get started")

### 5.2 Campaign Creation Flow

The 4-step creation flow (Who, Story, Goal, Review & Publish) must feel like guidance, not gatekeeping.

**Step 1: Who is this for?**

Page title:
> "Tell us who this campaign will help"

Not: "Beneficiary Information" (bureaucratic)
Not: "Who are you raising money for?" (interrogative)

Fields:
- Your name (auto-filled if logged in)
- Who will receive the funds? [Myself / A family member / A friend / My community]
- Their first name (if not yourself)
- Where are they located? (city, state)

Below the fields:
> "This information helps donors feel connected to your story. We'll never share personal details you don't want public."

**Step 2: Share your story**

Page title:
> "What happened, and how can people help?"

Not: "Campaign Description" (clinical)
Not: "Write your fundraiser story" (instructional)

AI assistance prompt (if the user pauses or clicks "Help me write this"):
> "Tell us a few details and we'll help you put your story into words. You can always edit it."

After the AI drafts copy:
> "Here's a draft based on what you shared. Make any changes you'd like, then move on when it feels right."

Not: "We've generated your campaign description" (robotic)
Not: "Review and approve your AI-generated content" (legal tone)

**Step 3: Set your goal**

Page title:
> "How much do you need?"

Below the goal input:
> "Be as specific as you can. When donors can see exactly what you need and why, they're more likely to help."

If we offer an ML-driven goal suggestion:
> "Campaigns like yours typically set a goal around $X,XXX. You can choose any amount that fits your situation."

Not: "Based on our data models, the optimal goal is..." (tech-speak)
Not: "We recommend..." (implies we're an authority over their own need)

**Step 4: Review & Publish**

Page title:
> "Here's how your campaign will look."

Preview of the live campaign page.

Before the publish button:
> "After you publish, we'll confirm a few details so donors can see your story is real. Your campaign can start receiving donations right away."

The publish button says: **"Publish my campaign"**

Not: "Submit for review" (implies approval is uncertain)
Not: "Launch fundraiser" (startup language)

### 5.3 Post-Publish: The Confirmation and Next Steps

**After publishing (confirmation screen)**:

> "Your campaign is live."
>
> "Here's what happens next:"
>
> 1. **Share your link.** The more people who see your story, the faster you'll reach your goal. [Copy Link] [Share on Facebook] [Share on WhatsApp]
>
> 2. **We'll confirm your details.** Within [X hours], we'll reach out to confirm a few things so we can add a verified badge to your campaign. This helps donors feel confident.
>
> 3. **Post updates as things progress.** Donors love knowing their help is making a difference. Even a short note goes a long way.

What this does:
- Puts sharing FIRST (the action that will make their campaign succeed)
- Frames verification as something that HELPS THEM, not something they must endure
- Sets a time expectation ("within X hours")
- Encourages updates without requiring them

### 5.4 Ongoing Campaigner Dashboard

**Dashboard headline**:
> "Your campaign at a glance"

Key metrics shown:
- Total raised (and percentage of goal)
- Number of donors
- Number of shares (if trackable)
- Verification status (displayed as a progress indicator, not a pass/fail)

**Verification status display**:

| Status | What the Campaigner Sees | Language |
|--------|------------------------|----------|
| Unconfirmed | A gentle progress bar at 0% with text: "Confirm your details to earn your verified badge" | Not "Verification pending" (implies bureaucracy) |
| Documents uploaded | Progress bar at 50%: "We're reviewing your details. Most confirmations complete within 24 hours." | Not "Awaiting approval" (implies gatekeeping) |
| Confirmed (Tier 1) | Green check + "Verified. Donors can see your campaign is confirmed." | Not "Identity verified" (sounds like a police process) |
| Fully confirmed (Tier 2) | Gold check + "Fully verified. Your campaign has the highest trust level." | Not "Tier 2 approved" (internal jargon) |
| Needs attention | Amber indicator + "We have a question about your campaign. [See details]" | Not "Rejected" or "Failed verification" |

**Update posting interface**:

Prompt above the text field:
> "Let your donors know how things are going. A photo or a few sentences can make their day."

Not: "Post a campaign update" (transactional)
Not: "You're required to post updates at each milestone" (mandatory tone, even if true)

---

## 6. Fee and Pricing Language

### 6.1 The Core Statement

On the pricing page and anywhere fees are discussed:

> **There is no platform fee.**
>
> The only cost is payment processing: 2.9% + $0.30 per donation, charged by Stripe. This covers credit card, debit, and digital wallet transactions. It goes to Stripe, not to us.
>
> If you'd like to support LastDonor, you can add a contribution when you donate. It starts at $0 and it's entirely up to you.

### 6.2 Why This Phrasing

| Element | Why |
|---------|-----|
| "There is no platform fee" | States a fact. Not "free" (overused, triggers skepticism). Not "0% fee" (could be compared to processing fee and seem misleading). "No platform fee" is precise. |
| "charged by Stripe" | Externalizes the cost. The donor doesn't feel like LastDonor is taking money. Stripe is a known, trusted brand. |
| "It goes to Stripe, not to us" | Removes ambiguity. The donor knows exactly who gets what. |
| "you can add a contribution" | "Contribution" sounds purposeful and voluntary. Not "tip" (service industry connotation, GoFundMe baggage). |
| "It starts at $0" | "Starts at" is factual. Not "default is" (sounds like a setting to be changed). Not "optional" alone (GoFundMe also calls their tip "optional" while pre-setting it at 15%). "$0" is the evidence that it's truly voluntary. |
| "entirely up to you" | Closing with agency. The donor's last impression is: I'm in control. |

### 6.3 Pricing FAQ Copy

> **Q: What does LastDonor charge?**
> There is no platform fee. The only cost is standard payment processing (2.9% + $0.30 per donation), which goes to our payment processor, Stripe. You can optionally contribute to LastDonor to help keep us running, starting at $0.

> **Q: How does LastDonor make money?**
> We are a 501(c)(3) nonprofit. We sustain operations through voluntary contributions from donors who choose to support us, along with grants and institutional partnerships. We never take a cut from your campaign.

> **Q: What if I donate $100? How much goes to the campaigner?**
> $96.80. Stripe's processing fee is $3.20 (2.9% + $0.30), and the remaining $96.80 goes directly to the campaign. If you choose to contribute to LastDonor, that's a separate line item so it never reduces the campaigner's share.

### 6.4 What We Never Say About Pricing

| Never say... | Why |
|-------------|-----|
| "We're free" | We are not. There is a processing fee. "Free" is a lie that will be caught. |
| "No hidden fees" | Implies fees could be hidden. Just show the breakdown and let silence speak. |
| "0% fee" without context | Technically true for platform fee, but misleading given processing costs. Be complete. |
| "GoFundMe charges 17%" | Competitive attack. Invites their response and a comparison war. |
| "We're cheaper than..." | Comparison invites scrutiny of your own model. Let word-of-mouth do this. |
| "Tip" | GoFundMe's word. Culturally loaded (service industry). We use "contribution" or "support." |

---

## 7. Verification Messaging: The Supportive Frame

Verification is LastDonor's core differentiator. It is also the moment most likely to create friction for campaigners. The language must thread a precise needle: communicate rigor to donors while feeling supportive to campaigners.

### 7.1 The Dual-Audience Challenge

When we communicate about verification, two audiences are reading simultaneously:
- **Donors** should think: "Good. Someone checked this."
- **Campaigners** should think: "This is helping me reach my goal."

If either audience gets the wrong impression, we've failed.

### 7.2 Donor-Facing Verification Language

On campaign pages, the verification badge appears as a small check icon next to the campaigner's name. Hovering or tapping shows:

> "This campaigner has confirmed their identity with LastDonor."

Not: "This campaign has been verified as legitimate" (implies other campaigns are not)
Not: "Verified by our Trust & Safety team" (institutional, intimidating)
Not: "Fraud-checked" (fear language)

For fully verified campaigns (Tier 2):
> "This campaigner has provided documentation confirming their story."

On the "How It Works" page:
> "Every campaigner on LastDonor confirms their identity. This means the person behind the campaign is who they say they are. It's one of the reasons donors come here."

### 7.3 Campaigner-Facing Verification Language

**Initial prompt (after campaign publish)**:

> "To add a verified badge to your campaign, we'll confirm a few details. This usually takes less than 24 hours and helps donors feel confident about giving."

**Document upload screen**:

Title:
> "Help donors see your story is real"

Subtitle:
> "A quick confirmation of your identity lets donors know exactly who they're supporting."

File upload label:
> "Upload a photo ID" (not "Submit identity documentation for verification")

Below the upload:
> "Your ID is reviewed by a member of our team and is never shared publicly. It's only used to confirm your identity."

**If additional documents are needed**:

> "We'd like to add a few more details to strengthen your campaign. Here's what would help:"

Followed by a specific, friendly list:
> "A photo or document that shows [specific thing, e.g., the medical bill, the damage report]."
> "This helps donors feel even more connected to your story."

Not: "Additional documentation required." (bureaucratic demand)
Not: "Your campaign cannot proceed without..." (threatening)

### 7.4 Verification Timeline Communication

| Moment | Campaigner Sees |
|--------|----------------|
| Just uploaded docs | "We've received your documents. Our team reviews most submissions within 24 hours." |
| Under review (no action needed) | "Your confirmation is in progress. You'll hear from us soon." |
| Confirmed (Tier 1) | "You're verified! Donors can now see a verified badge on your campaign. This can help increase donations." |
| Needs more info | "We have a quick question about your campaign. [See details] - Once we hear back, we'll get you verified right away." |
| Confirmed (Tier 2) | "Your campaign is now fully verified with the highest trust level. Donors love seeing this." |

---

## 8. Fund Release and Milestone Language

Milestone-based fund release is a powerful trust tool, but it can feel like LastDonor is withholding the campaigner's money. The language must frame milestones as checkpoints of progress, not barriers to access.

### 8.1 The Frame

**Wrong frame**: "We hold your funds until you prove you used them correctly."
**Right frame**: "Funds are released in stages as your campaign reaches its milestones. This helps donors see their impact, and it helps you show your progress."

The milestone system is:
- For the DONOR: proof that funds are being used as described
- For the CAMPAIGNER: a way to show progress that builds donor confidence and can attract more donations

### 8.2 Milestone Setup Language (During Campaign Creation)

> "Define your milestones"

Subtitle:
> "Break your goal into steps. As each step is reached, funds are released and donors can see their help in action. This builds trust and often encourages more people to contribute."

Not: "Set fund release conditions" (sounds like a contract)
Not: "Define disbursement triggers" (institutional jargon)

For each milestone input:
> "What will this phase accomplish? (e.g., 'Purchase the van,' 'Start physical therapy,' 'Cover first three months of rent')"

### 8.3 Milestone Progress Language (Campaigner Dashboard)

| Milestone Status | What They See |
|-----------------|---------------|
| Pending | "This milestone hasn't been reached yet. Keep sharing your campaign!" |
| Reached | "Your campaign reached this milestone. Upload a quick update or photo so we can release the funds." |
| Evidence submitted | "We've received your update. Our team will review it shortly." |
| Funds released | "Funds for this milestone have been released. Great progress!" |
| Needs attention | "We have a question about this milestone. [See details]" |

**When funds are released (notification)**:
> "$[amount] has been released for [milestone name]. You can expect the transfer within [X] business days."

**Not**: "Your fund disbursement request has been approved" (bureaucratic, implies it could have been denied)

### 8.4 Milestone Language for Donors

On the campaign page, donors see a visual progress track:

```
Phase 1: Medical equipment ........... âœ“ Completed
Phase 2: Physical therapy sessions ... â- In progress  
Phase 3: Home modifications .......... â-‹ Upcoming
```

Hovering or tapping a completed milestone shows:
> "Funds for this phase were released on [date]. [View campaigner's update]"

This gives donors confidence without detailed financial paperwork visible on the public page.

---

## 9. Customer Service Voice

### 9.1 The Standard

Every interaction with a LastDonor team member should feel like talking to a helpful, calm, knowledgeable person who genuinely cares about the outcome. Not a bot. Not a script. Not corporate speak.

**Research anchor**: Platforms rated above 4.5 on Trustpilot (SpotFund, WhyDonate, Zeffy) have one thing in common: real human names in support interactions. Users praise specific people by name. "Akshit from WhyDonate was incredible." "The team at SpotFund actually called me back." This is the single strongest predictor of platform satisfaction.

### 9.2 Voice Principles

| Principle | Meaning | Example |
|-----------|---------|---------|
| **Use your name** | Every message, chat, and email comes from a named person. Never "The Team" or "Support." | "Hi Maria, this is James from LastDonor." |
| **Match their energy** | If they're panicking, be calm but urgent. If they're casual, be warm. Never be more formal than the person you're speaking with. | If user writes "help!! my campaign stopped!!" - respond: "I can see what happened. Let me fix this for you right now." |
| **Answer first, explain second** | Lead with the answer or action, then explain why. People in distress need solutions before reasons. | "I've reactivated your campaign. Here's what happened..." not "Due to our automated system which detected..." |
| **Never blame the user** | Even if they made an error. Frame it as something that happened, then fix it. | "It looks like the document didn't upload correctly. Let me help you try again." Not "You uploaded the wrong file type." |
| **Close with clarity** | End every interaction with what happens next and when. | "I'll follow up with you by tomorrow morning with an update." |

### 9.3 Response Templates (Flexible, Not Scripts)

**Donor asking about campaign legitimacy**:
> "That's a great question, and I'm happy you asked. This campaign was started by [Name], who has confirmed their identity with us. Their verified badge means we've reviewed their details. If you'd like to know more about how we confirm campaigns, I can share that with you."

Not: "All campaigns are verified and safe." (Vague, claim-based, triggers suspicion)

**Campaigner upset about verification delay**:
> "I understand this is frustrating, especially when you need funds quickly. Let me look into where things stand right now. [Checks.] Your documents are being reviewed and I'm going to flag this for priority attention. I'll follow up with you within [specific time]. Is there anything else I can help with while we wait?"

Not: "Verification typically takes 3-5 business days. Please be patient." (Dismissive, institutional)

**Campaigner whose milestone evidence was questioned**:
> "Hi [Name], this is [Agent] from LastDonor. I wanted to reach out because our team had a quick question about the update you posted for [milestone name]. It's nothing major, and I think we can sort it out quickly. Could you [specific ask: e.g., 'share a photo of the receipt' or 'clarify the date on the document']? Once we have that, we'll get the funds released."

Not: "Your milestone evidence submission has been flagged for review." (Alarming, impersonal)

**Donor requesting refund**:
> "Of course. I'll process your refund right now. You should see it back in your account within [X] days. Is there anything about the campaign you'd like us to look into?"

Not: "Refund requests must be submitted through our Giving Guarantee process and are subject to review." (Bureaucratic, creates doubt)

### 9.4 Channel-Specific Notes

| Channel | Voice Adjustment |
|---------|-----------------|
| **Live chat** | Conversational. Short sentences. Emojis are okay if the user uses them first. Fast response expected. |
| **Email** | Slightly more structured. Include greeting, answer, next steps. Still warm, never formal. |
| **Phone** | Most personal. Use their name. Summarize the conversation before ending. "Just to recap..." |
| **WhatsApp** | Most casual channel. Match the medium. Brief, clear, responsive. |
| **Social media (public)** | Brief, empathetic, move to private. "I'm sorry to hear this. I'd like to help. Can you DM us so I can look into your account?" Never argue publicly. |
| **Trustpilot responses** | Respond to EVERY negative review. Name the agent responding. Be specific to their complaint. Never use a template that reads like a template. |

**Trustpilot response policy**:

Every 1-star, 2-star, and 3-star review gets a personal response within 48 hours. This is non-negotiable.

**Research anchor**: GoFundMe does not respond to negative Trustpilot reviews. Zeffy responds to 72%. WhyDonate responds to 100%. The correlation between response rate and Trustpilot score is near-perfect. This is the easiest trust signal to implement and the hardest for competitors to retroactively fix.

---

## 10. Sharing and Amplification Copy

Sharing is the single most important action for campaign success. The messaging must make sharing feel natural, effective, and emotionally rewarding, not like a chore.

### 10.1 Share Prompts on Campaign Page

**Primary share CTA** (below donate button):
> "Know someone who might help? Share this campaign."

Not: "SHARE THIS FUNDRAISER!" (aggressive, all-caps)
Not: "Help spread the word!" (vague, clichÃ©)

**Share options** (with pre-written copy for each channel):

**Facebook share text** (pre-populated, editable):
> "[Name] needs our help. I donated to their campaign on LastDonor. Every bit counts. [link]"

**WhatsApp/SMS share text**:
> "Hey, I wanted to share this with you. [Name] is raising money for [short description]. I donated, and I thought you might want to take a look. [link]"

**Email share template**:
> Subject: "[Name] needs help, and I thought of you"
> Body: "I came across [Name]'s story on LastDonor and felt I should share it. They're raising [amount] for [brief description]. I already donated, and I'm passing it along in case you'd like to as well. Here's the link: [link]"

### 10.2 Post-Donation Share Prompt

Immediately after donating (on the thank-you screen):

> "Sharing this campaign is the single best way to help [Name] reach their goal. Most donations come from personal shares, not social media posts."

Below that:
> [Copy Link] [Share by Text] [Share on Facebook] [Share by Email]

**Key psychology**: The line "Most donations come from personal shares, not social media posts" is based on research and serves two purposes:
1. It gives the donor permission to share via personal channels (text, WhatsApp, email) which feel less performative than social media
2. It reframes sharing from "broadcasting" (which feels uncomfortable) to "sending to someone specific" (which feels natural)

### 10.3 Campaigner Sharing Coaching

After campaign creation, the campaigner's dashboard includes a sharing section:

> **Get the word out**
>
> Your first donors will likely be people who know you. Send your campaign link directly to family and close friends before posting on social media. A personal message works better than a public post.

Suggested first action:
> "Send your campaign to 10 people who know you. A text or WhatsApp message with a personal note is the most effective way to get your first donations."

One-click share:
> [Copy your campaign link]

Post-first-donation encouragement:
> "Your campaign just received its first donation! Sharing an update with your network often leads to a second wave of donations."

The coaching never feels pushy. It offers practical evidence-based guidance ("personal messages outperform social posts") and lets the campaigner act on it in their own time.

---

## 11. Error, Rejection, and Difficult Moment Language

These moments determine whether someone stays on the platform or leaves forever. Every error message, rejection, or awkward state must preserve dignity and offer a path forward.

### 11.1 Campaign Not Approved / Needs Revision

**What the campaigner sees**:
> "Your campaign needs a bit more detail before we can publish it."
>
> Specifically:
> - [Specific, actionable item: e.g., "Your story mentions medical expenses, but we couldn't find a related medical provider. Adding a brief note about the provider would help."]
>
> "Once you've updated this, we'll take another look. If you have any questions, [Name] from our team is here to help: [contact]."

**What they do NOT see**:
- "Your campaign has been rejected."
- "Reason: Insufficient documentation."
- Error code references
- A generic "contact support" link without a name

### 11.2 Verification Identity Check Failed

**What the campaigner sees**:
> "We weren't able to confirm your identity from the document you uploaded. This can happen if the photo is blurry, the document is expired, or the name doesn't match your campaign details."
>
> "You can upload a new document anytime: [Upload button]"
>
> "If you're having trouble, [Agent Name] can walk you through it: [contact method]."

### 11.3 Payment Failed

**What the donor sees**:
> "The payment didn't go through. This is usually a temporary issue with the card. You can try again or use a different payment method."

Not: "Payment declined." (blunt, shaming)
Not: "Your card was rejected. Please contact your bank." (shifts blame, creates anxiety)

### 11.4 Campaign Page Not Found

> "This campaign is no longer active. The organizer may have completed their goal or taken the campaign down."
>
> "Looking for another way to help? [Browse active campaigns]"

Not: "Error 404: Campaign not found." (robotic)
Not: "This page doesn't exist." (dismissive)

### 11.5 Campaign Paused by Admin

**What the campaigner sees**:
> "Your campaign has been paused while we clarify a few details. Donations are on hold, but nothing has been removed."
>
> "[Agent Name] from our team will reach out to you within [X hours] to explain what's needed."

**What donors see on a paused campaign page**:
> "This campaign is temporarily paused. Check back soon."

Not: "This campaign is under review." (implies suspicion, damages the campaigner's reputation with existing donors)
Not: "This campaign has been flagged." (alarming language)

### 11.6 Campaign Suspended (Fraud/Violation)

This is the most sensitive scenario. Even in cases of clear violation, the language should be firm but not humiliating.

**What the campaigner sees**:
> "Your campaign has been suspended because it doesn't meet our community guidelines. If you believe this is a mistake, you can reach out to our team: [contact]."

**What donors see**:
> "This campaign is no longer active. If you donated to this campaign and have concerns, please contact us: [contact]."

No public accusations. No language that implies the campaigner is a criminal. Let the absence of the campaign speak for itself. Donors who want to follow up have a clear contact path.

---

## 12. Marketing and Public Positioning

### 12.1 Position Statements

These are internal statements that guide all external communications. They are not copy that appears verbatim on the platform, but they anchor every marketing decision.

**Primary position**:
> LastDonor is where people go when they want to know their donation matters. Every campaign is real, every dollar is tracked, and a real person is always available to help.

**For donor-focused marketing**:
> Every campaign on LastDonor has a confirmed identity, a clear goal, and updates you can follow. You see where your money goes because there is nothing we need to hide.

**For campaigner-focused marketing**:
> When donors can see your story is real, they give more, share more, and come back. LastDonor helps you build that confidence from day one.

**For press/institutional**:
> LastDonor is a 501(c)(3) nonprofit crowdfunding platform built on identity-confirmed campaigns, milestone-based fund release, and radical fee transparency. We charge no platform fee. Processing costs are passed through at cost. Voluntary contributions from donors sustain our operations.

### 12.2 What We Lead With (and What We Don't)

| Lead With | Avoid Leading With |
|-----------|-------------------|
| Specific stories and outcomes | Industry comparisons |
| How the platform works (show, demonstrate) | Why other platforms are bad |
| Named team members and real support | Scale metrics (users, dollars raised) unless they're genuinely impressive |
| The verified badge and what it means | Security buzzwords (encrypted, 256-bit, SOC-2) unless specifically asked |
| The donor experience (see where your money goes) | The platform's mission statement (actions over declarations) |

### 12.3 Social Media Copy Principles

- **Every post should feature a person**, not the platform
- Share campaign stories, donor stories, completion stories
- Never post "We just launched [feature]!" without tying it to a human benefit
- Never attack competitors, directly or indirectly
- Respond to every comment, every DM, every mention. Speed matters.

**Examples of good social posts**:

> "Maria's campaign reached its goal today. 47 donors, 12 days, one community. Here's what happened: [link]"

> "Ben asked us: 'How do I know the money actually gets there?' Here's how it works on LastDonor: [short video or infographic link]"

> "Our support agent James helped 14 campaigners today. He says the best part of his job is calling someone to tell them their funds were released. We agree."

**Examples of bad social posts**:

> "We're so proud to announce our new milestone tracking feature! #Innovation #Crowdfunding"
(Self-congratulatory, nobody cares about features)

> "Tired of hidden fees? Try LastDonor. Unlike other platforms, we don't charge 17%. #TransparentDonation"
(Competitive attack, draws unwanted comparison, sounds defensive)

### 12.4 SEO and Content Marketing

Blog and educational content is the one space where competitor comparisons can appear, because users are actively searching for this information.

**Allowed in SEO content**:
- "GoFundMe fees explained" (educational, factual, serving user intent)
- "Best crowdfunding platforms 2026" (comparison, include LastDonor alongside others)
- "How donation processing fees work" (educational)
- "What happens to your money when you donate on crowdfunding sites" (category-level education)

**Not allowed in SEO content**:
- "Why GoFundMe is a scam" (inflammatory, legally risky, beneath the brand)
- "GoFundMe stole my money" (accusation, not our voice)
- Hit pieces disguised as comparisons

The rule: **Educate, never attack.** Position LastDonor as the knowledgeable, credible voice in the space. Attacks make you look small. Education makes you look like the authority.

---

## 13. Tone Calibration by Campaign Context

Not all campaigns carry the same emotional weight. The platform's tone should subtly adapt.

### 13.1 Medical Emergencies

- **Tone**: Warm, steady, focused on the person
- **Language**: Use first names. Reference the specific medical need. Avoid clinical language.
- **Never**: Use urgency manipulation ("Time is running out to save [Name]!"). Let the medical facts create their own urgency naturally.
- **Example**: "David, 42, from San Antonio. He needs $6,000 for cardiac rehab after a heart attack three weeks ago. He's a father of two and a high school football coach."

### 13.2 Funeral and Memorial Campaigns

- **Tone**: Respectful, quiet, dignified
- **Language**: Past tense for the person's life, present tense for the family's need. Never euphemistic ("passed away" is fine, "lost his battle" is clichÃ©).
- **Never**: Use the deceased person's story as a dramatic hook. The family is the focus.
- **Example**: "Jessica Moreno was 31. She was a teacher in Amarillo who loved hiking with her dog, Biscuit. Her family is raising money to cover funeral expenses and support her two kids."

### 13.3 Disaster Relief

- **Tone**: Clear, factual, action-oriented
- **Language**: Specifics about the disaster, the community, the immediate need. Link to verified news sources.
- **Never**: Exploit disaster imagery. Use photos that show people rebuilding, helping, standing together, not just destruction.
- **Example**: "After the March 2026 flooding in eastern Kentucky, 400 families lost their homes. This campaign supports the Rodriguez family in Breathitt County."

### 13.4 Community and Essential Needs

- **Tone**: Encouraging, community-focused
- **Language**: Frame the community as the solution. The campaign enables collective action.
- **Example**: "The Maplewood Community Center needs $12,000 in roof repairs before winter. 83 families use this center every week."

### 13.5 When a Campaign Succeeds

- **Tone**: Celebratory but not performative. Let the community feel the win.
- **Language**: Name the last donor (if they consent). Show the final number. Share what happens next.
- **Example**: "Marcus closed this campaign with a $25 donation. 61 donors came together to raise $4,200 for Maria's van. Maria says: 'I can take my daughter to school on my own now.' That's what this was for."

---

## 14. Copy Anti-Patterns: What We Never Say

This section consolidates every banned phrase and pattern in one reference.

### 14.1 Universal Bans (Never Appears Anywhere on Platform)

| Phrase/Pattern | Why It's Banned |
|---------------|----------------|
| "Trust us" / "You can trust us" | If you say it, you've already lost. Trust is demonstrated. |
| "The most trusted platform" | Superlative claim. Invites disproof. Sounds like an ad. |
| "Unlike [any competitor]" | Makes us the alternative, not the standard. |
| "Safe and secure" as a headline | Implies danger exists. |
| "Free" as a standalone claim | We are not free. There are processing fees. This would be caught and weaponized. |
| "Guaranteed" in donor-facing headlines | Legal connotation. Implies things can go wrong. |
| "Report fraud" as visible UI element | Activates fear. Use "Something doesn't look right? Let us know." |
| Countdown timers on donations | Manufactured urgency. Beneath the brand. |
| "Act now before it's too late" | Pressure tactic. We don't do this, ever. |
| "Join X million donors" | We don't have millions yet. Avoid metrics that highlight small scale. |
| "We've raised $X million" | Same. When the number is genuinely impressive, use it. Until then, highlight individual campaign impact. |
| "No hidden fees" | Planting the idea that fees could be hidden. |
| "Donate now" (as a generic button) | Always personalize: "Donate to [Name]'s campaign" |
| "Beneficiary" | Bureaucratic. Use the person's name or "the person you're helping." |
| "Fundraiser" as primary term | Use "campaign" or "story." "Fundraiser" sounds transactional. |
| "Submit" as a button label | Use "Publish," "Send," "Share," or another active verb. "Submit" implies subordination. |
| Em dashes | House style. Use colons, periods, or sentence restructuring. |

### 14.2 Internal Jargon That Must Never Reach Users

| Internal Term | User-Facing Equivalent |
|--------------|----------------------|
| Verification status | Confirmation progress |
| Tier 1 / Tier 2 | Verified / Fully verified |
| Fund disbursement | Funds released |
| Evidence submission | Milestone update |
| Trust & Safety team | Our team |
| Flagged | Needs attention |
| Suspended | No longer active |
| Rejected | Needs a closer look |
| Pipeline | [never reference] |
| Seed donations | [never reference, internal only] |
| Simulation | [never reference, internal only] |
| Reconciliation | [never reference] |
| Cron job | [never reference] |
| Admin panel | [never reference] |

---

## 15. Appendix: Research Anchors

These are the key research findings that directly shaped the messaging architecture in this document. Each anchor connects a real user complaint, behavior, or insight to a specific messaging decision.

### 15.1 Fee Model Research

| Source | Finding | Messaging Decision |
|--------|---------|-------------------|
| Ruth, Trustpilot 1-star | "If it was set at zero and you could choose to add a tip, that would be different." | $0-default contribution. Text field, not slider. |
| Thomas, Trustpilot 2-star | "17.5%! And it's not clear to see how you remove it, or if you even can." | No removal needed. Starts at $0. Nothing to discover or navigate. |
| Shannon, Trustpilot 1-star | "$117.50 charged for $100 donation... the additional $17.50 was labeled as a tip." | Pre-checkout breakdown shows exact total before payment. |
| Susan Gallo, Trustpilot 2-star | "I do not think this is right. You should have the option of adding a tip, not be forced to remove one." | Contribution is additive (start at $0, add if you want), never subtractive (start at 15%, remove if you notice). |
| Steve, Trustpilot 1-star | "They deducted an unauthorized tip of $52.50." | No pre-selected amounts. Period. |
| Zeffy Trustpilot analysis | Even "100% free" Zeffy uses 17% default tip. Complaints from Suzanne Yee, John Caley. | LastDonor's $0-default differentiates against the ENTIRE industry, not just GoFundMe. |

### 15.2 Customer Service Research

| Source | Finding | Messaging Decision |
|--------|---------|-------------------|
| SpotFund Trustpilot (4.7) | Users praise specific agents by name. "It was so refreshing to communicate with a real person." | Every interaction uses agent's real name. Never "The Team." |
| WhyDonate Trustpilot (4.9) | WhatsApp support, 100% negative review response rate. Named agents: Akshit, Vaibhav, Rushikesh, Sonali. | Multi-channel support with WhatsApp. All negative reviews answered within 48 hours. |
| GoFundMe Trustpilot (3.2) | GoFundMe does NOT respond to negative Trustpilot reviews. 57% are 1-star. | Respond to every negative review. Every one. Non-negotiable. |
| Ken, GoFundMe 1-star | "AI worse than Cerberus from Greek epics." | Lead with human agents. AI can assist, but a human is always available. |
| GoFundMe 5-star reviews | 9+ individually named agents praised in positive reviews (Luis, Natasha, Jose, etc.) | When CS works, it is GoFundMe's strongest asset. Match this quality, then make it consistent. |

### 15.3 Verification and Trust Research

| Source | Finding | Messaging Decision |
|--------|---------|-------------------|
| u/wickedpixel1221, Reddit (7 upvotes) | "They have verification procedures in place... If Gofundme isn't able to fund a campaign due to verification issues, the funds are returned to the donors." | Verification is valued by donors. The problem is not that it exists, but how it's communicated to campaigners. |
| Miss Katy Shields, GoFundMe 1-star | MS patient's account shut down without warning after 3 years. | Never shut down a campaign without advance notice and a human conversation. |
| Richard Carter, GoFundMe 1-star | Can't delete own campaign, had to report himself. | Give campaigners full control over their own campaigns, including the ability to close them. |
| BP, GoFundMe 2-star | Gaza fundraiser paused after 1.5 years, accused of infractions. | If a campaign is paused, explain specifically why and offer a clear path to resolution. |
| u/SparkEthos, Reddit (5 upvotes) | "You only have issues if they believe your fundraising is a scam, they hold on to the funds in order to protect the people who donated." | Frame fund holds as donor protection, not campaigner punishment. But always communicate with the campaigner first. |

### 15.4 Donor Behavior Research

| Source | Finding | Messaging Decision |
|--------|---------|-------------------|
| AP-NORC poll (via Reddit) | "Roughly 2 in 10 U.S. adults donated... Most don't have high confidence that crowdfunding sites charge reasonable service fees." | Fee transparency is not a bonus. It is a prerequisite to donor participation. |
| r/ALS fundraiser | "GFM is a NUMBERS GAME. You want to make sure hundreds of people see your campaign." | Build sharing coaching into the campaigner experience. Don't just provide share buttons. |
| r/gofundme success stories | The dying cancer patient's wedding campaign (259 upvotes) and the funeral fundraiser ($1,600, 150 upvotes) are the most engaging posts. | Success stories are the most powerful marketing. Build collection and amplification of completion stories into the platform. |
| MzLou, GoFundMe 2-star | "Auto-enrolled in monthly donations unknowingly." | Never auto-enroll. Monthly giving is opt-in only, never default. |
| Reddit thread on GoFundMe scams (18 upvotes) | "GFM has done absolutely nothing. The campaign is still live." | Proactive, visible moderation. When something is reported, a human looks at it and the reporter gets a response. |

---

## End of Document

This messaging architecture is a living document. As the platform launches, collects user feedback, and observes how real donors and campaigners respond to language, this document should be updated with evidence-based revisions.

The single guiding question for any copy decision: **"If I were asking strangers for money to help someone I love, and if I were a stranger being asked to give, would these words make me feel respected, informed, and confident?"**

If the answer is yes, publish. If it is anything else, rewrite.
