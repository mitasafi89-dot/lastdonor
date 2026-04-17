# LastDonor.org - Brand Guidelines

**Version**: 0.1 (Pre-Development)
**Date**: March 19, 2026
**Status**: Draft

---

## 1. Brand Identity

**Name**: LastDonor
**Domain**: lastdonor.org
**Tagline**: "You're the reason it's done."
**Category descriptor**: A nonprofit fundraising platform

### Brand Positioning
LastDonor is a story-driven, editorially curated fundraising platform where every campaign has a real person, a specific goal, and a finish line. The "Last Donor" - the person whose donation closes a campaign - is celebrated as the hero.

### Brand Personality
- **Bold** - we don't sugarcoat. We show real stories, real needs, real impact.
- **Trustworthy** - every dollar is tracked. Every story is verified. Every report is published.
- **Urgent** - people need help now. We don't waste time or words.
- **Warm** - behind the boldness is real human compassion. We care about people, not metrics.
- **American** - rooted in American communities, serving American causes first, without being partisan.

### What We Are NOT
- Not political. No party affiliation. No endorsements.
- Not guilt-driven. We don't shame people into donating.
- Not slick. We're not a Silicon Valley startup. We're a mission.
- Not vague. Every campaign has a name, a face, and a number.

---

## 2. Color Palette

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Deep Teal** | #0F766E | Primary brand color - headers, nav, brand anchoring, trust signals |
| **Warm White** | #F8F6F2 | Page backgrounds, card backgrounds, breathing space |
| **Warm Amber** | #D97706 | Accent - CTAs, progress bars, highlights, the "." in logo, achievements, donate buttons |

### Secondary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Deep Red** | #8B2332 | Urgent elements only - "Last Donor Zone" indicators, critical alerts. Used sparingly. |
| **Forest Green** | #2D6A4F | Success states - campaign completed, goal met, confirmation messages |
| **Near Black** | #1A1A1A | Body text on light backgrounds |
| **Medium Gray** | #6B7280 | Secondary text, captions, timestamps |
| **Light Gray** | #E5E7EB | Borders, dividers, subtle backgrounds |

### Dark Mode Colors

| Element | Hex |
|---------|-----|
| Background | #0F1A19 |
| Surface / Cards | #1A2E2B |
| Text (primary) | #F1F5F9 |
| Text (secondary) | #94A3B8 |
| Warm Amber (same) | #D97706 |
| Deep Teal (lighter for dark bg) | #14B8A6 |
| Borders | #2D4A47 |

### Color Rules
- Amber is for **action and achievement only**: donate buttons, progress bars, badge highlights, completed campaign markers. If everything is amber, nothing is.
- Red is for **urgency only**: Last Donor Zone activation, critical campaign needs. Never decorative.
- Teal is the default. When in doubt, use teal.
- Never combine red and amber in the same element. They compete.
- Teal + amber is the primary pairing. Amber CTAs on teal backgrounds = maximum contrast and clarity.

---

## 3. Typography

### Font Stack

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines** | DM Serif Display | Regular (400) | Georgia, serif |
| **Body text** | DM Sans | Regular (400), Medium (500) | system-ui, sans-serif |
| **Stats/Numbers** | DM Mono | Regular (400) | monospace |
| **UI elements** | DM Sans | Medium (500), Semi-bold (600) | system-ui, sans-serif |

All three fonts are from the same DM type family - designed with shared proportions and visual DNA. This creates natural harmony without effort.

### Typography Rules
- Headlines: DM Serif Display Regular. Sentence case. Never all-caps except in the logo. Only one weight available - let the serif itself carry the visual weight.
- Body: DM Sans Regular, 16px minimum on desktop, 15px on mobile. Line height 1.6.
- Stats and dollar amounts: DM Mono. "$42,750 raised" in mono feels more precise and trustworthy.
- Never use more than 2 fonts on a single page (DM Mono is the exception - used only for numbers/stats, not prose).
- Links in body text: warm amber (#D97706), underlined on hover only.

---

## 4. Logo Usage

### Logo format (pending final design)
Logo will always appear with tagline in first-impression contexts:

```
LAST DONOR.
You're the reason it's done.
```

### Logo Rules
- Minimum clear space: height of the "D" in DONOR on all sides
- Minimum size: 120px wide (digital), 1 inch (print)
- Never stretch, rotate, recolor outside approved palette, or add effects
- On photography backgrounds: always use a semi-transparent navy overlay behind the logo

### Favicon
- TBD based on final logo direction
- Must be legible at 16x16px and 32x32px

---

## 5. Imagery

### Photography Strategy

LastDonor uses two distinct image systems:

1. **Campaign images** - Real photography tied to specific people and events, sourced from news and federal databases.
2. **Platform images** - Fresh public domain photography for the site's own visual identity, rotated every 1-2 weeks.

### Platform Photography (Homepage, Category Headers, Blog)

- **Freshness rule**: All platform photography must be published within the last 14 days. Never show stale imagery.
- **Primary source**: DVIDS (dvidshub.net) for military/first-responder/veterans imagery - hundreds of high-res photos uploaded daily, all public domain.
- **Secondary source**: FEMA Media Library / NWS / NOAA for disaster imagery - all public domain.
- **Rotation**: Weekly cron selects top-scoring recent photos per category. Old photos archived for blog/social reuse.
- **Credit**: Always credit the photographer - "Photo: Sgt. James Carter / DVIDS, March 14, 2026". Not legally required (public domain) but builds credibility.

| Platform Location | Source | Rotation |
|------------------|--------|----------|
| Homepage hero | DVIDS or FEMA (most impactful recent photo) | Weekly |
| Military / Veterans category header | DVIDS (recent, branch-relevant) | Weekly |
| First Responders category header | DVIDS / public domain fire/EMS sources | Weekly |
| Disaster category header | FEMA / NWS (active or recent disaster) | On disaster events, otherwise weekly |
| Medical / Memorial / Community / Essential Needs headers | Typography-forward design with teal/amber gradient. No fake people. | Static (brand design) |

### Brand Treatment (Applied to All Platform Photos)

Every photo receives a consistent treatment so any image, regardless of subject, feels like LastDonor:

- Desaturate to ~60%
- Apply deep teal (#0F766E) color wash at ~15% opacity
- Dark gradient overlay at bottom (for text readability)
- DM Serif Display headline positioned consistently
- Result: every photo looks like it belongs to the same publication

### AI-Generated Imagery (Kling AI)

For illustrations, abstract backgrounds, textures, and decorative elements where photography doesn't fit:

- **Provider**: Kling AI (klingai.com)
- **Use cases**: SVG-style category icons, abstract background textures, decorative elements, OG card backgrounds, email header art
- **Never**: Generate images of people (real or fictional). No AI faces on the platform, ever.
- **Style**: Abstract, geometric, brand-colored (teal + amber). Obviously illustrative, never photorealistic.

### Campaign Photography

- **Primary source**: DVIDS for military/first-responder campaign stories, FEMA for disaster stories
- **Secondary**: User-submitted photos (with permission), local news (with permission)
- **Fallback**: Solid teal/amber gradient placeholder with category SVG icon - never a fake photo
- **Treatment**: Slightly desaturated. No Instagram filters. No oversaturation. Serious, respectful.
- **Faces visible when possible** - people donate to people, not landscapes
- **Never exploit suffering** - show strength, resilience, and humanity. Never gore, never helplessness without dignity.

### Image Rules
- Hero images: minimum 1920x1080, optimized as WebP with JPEG fallback
- Campaign cards: 16:9 aspect ratio, consistent across the grid
- All images must have alt text (accessibility)
- Lazy load all images below the fold
- OG/share cards: programmatically generated with `@vercel/og` (campaign title + progress bar + brand treatment)

---

## 6. Tone of Voice

### Writing Style

| Do | Don't |
|----|-------|
| Use first names - "Mike," not "SSG Torres" | Use military jargon - not "AOR," "CENTCOM," "TDY" |
| Mention their hometown - "from Tulsa, Oklahoma" | Use vague locations - not "overseas" or "deployed" |
| Include one specific human detail per story | Write press releases |
| Short paragraphs - 2-3 sentences max | Wall-of-text paragraphs |
| Active voice - "Sarah sent a care package" | Passive voice - "A care package was sent" |
| End with the ask, connected to the person | End with generic "please donate" language |
| Dignify - these are heroes, not victims | Use pity language - "poor," "suffering," "helpless" |

### Headlines
- Direct. Short. Person-focused.
- Good: "Sgt. Pennington gave everything. His family shouldn't have to."
- Bad: "Support military families in need this holiday season."

### CTAs
- Action verbs. Specific.
- Good: "Fund Maria's recovery" / "Close this campaign"
- Bad: "Donate now" / "Click here to help"

### Error / Empty States
- Human, not robotic.
- Good: "No active campaigns right now. Check back soon - we're always working on the next one."
- Bad: "Error 404: Page not found."

---

## 7. Category-Contextual Design Elements

LastDonor serves 8 campaign categories. Visual accents adapt to context - the platform feels cohesive, but individual campaigns carry the emotional texture of their cause.

### Patriotic Accents (military, veterans, first-responders only)
- A very faint, desaturated American flag texture may be used as a background element on military/veterans/first-responder campaign pages
- Opacity: 3-5% maximum - barely perceptible
- Never used behind text-heavy sections - only in hero areas or section dividers
- Never cartoonish or clip-art style
- A single, subtle star may be used as a design accent (section breaks, list bullets, badge elements)
- Star style: simple, geometric, not illustrative
- Star color: amber or teal only

### Neutral Presentation (medical, disaster, memorial, community, essential-needs)
- No patriotic textures on non-service campaign pages
- Use warm, neutral photography and the standard teal/amber palette
- Let the person's story carry the emotional weight - no visual theme beyond the brand itself

### Global Rules
- Contextual elements are **textural**, never central
- The people in the stories are the emotion. The design just supports the mood.
- Never use flag bunting, eagles, shields, or red/white/blue stripes as primary design elements
- This is a charity, not a campaign rally
- Category-specific accents only appear on individual campaign pages and category browse pages - the homepage, about page, and shared UI remain category-neutral

---

## 8. Social Media Presence

### Profile Image
- Favicon/icon mark on navy background (consistent across all platforms)

### Cover Images
- Featured campaign imagery with logo overlay
- Updated monthly or with each major campaign

### Share Cards (OpenGraph)
- Every campaign page generates a unique share card:
  - Campaign hero image
  - Logo top-left
  - Campaign title
  - Progress bar
  - "lastdonor.org" bottom-right

### Handle
- Target: @lastdonor (all platforms)
- Backup: @lastdonororg
