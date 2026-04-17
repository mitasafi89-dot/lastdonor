# LastDonor.org â€” Kling AI Image Generation Guide

**Version**: 1.0
**Date**: March 26, 2026
**Status**: Production Reference
**Depends On**: Doc 02 (Brand Guidelines), Doc 17 (Blog Automation Pipeline)

---

## TABLE OF CONTENTS

1. [Purpose & Scope](#1-purpose--scope)
2. [Brand Constraints â€” Non-Negotiable Rules](#2-brand-constraints--non-negotiable-rules)
3. [Kling AI Platform Overview](#3-kling-ai-platform-overview)
4. [Authentication â€” JWT Token Generation](#4-authentication--jwt-token-generation)
5. [API Contract â€” Endpoints, Request, Response](#5-api-contract--endpoints-request-response)
6. [Image Types & Dimensions](#6-image-types--dimensions)
7. [Prompt Engineering â€” Core Framework](#7-prompt-engineering--core-framework)
8. [Category-Specific Prompt Templates (All 23 Categories)](#8-category-specific-prompt-templates-all-23-categories)
9. [Negative Prompt Strategy](#9-negative-prompt-strategy)
10. [Full Pipeline Architecture](#10-full-pipeline-architecture)
11. [Supabase Storage Integration](#11-supabase-storage-integration)
12. [Retry Logic & Error Recovery](#12-retry-logic--error-recovery)
13. [Image Optimization](#13-image-optimization)
14. [Cost Management](#14-cost-management)
15. [Environment Variables](#15-environment-variables)
16. [Troubleshooting](#16-troubleshooting)
17. [Quality Checklist](#17-quality-checklist)

---

## 1. PURPOSE & SCOPE

This document is the single source of truth for how LastDonor.org generates blog images using Kling AI. It covers:

- The exact API contract (authentication, endpoints, request/response shapes)
- Prompt engineering perfected for LastDonor's visual identity
- The full pipeline from prompt â†’ generated image â†’ optimized file â†’ Supabase Storage â†’ public URL in database
- Every cause category's visual language
- Error handling, retries, fallbacks, and cost tracking

**What this document does NOT cover:**
- Campaign hero images (sourced from DVIDS/FEMA/user uploads â€” see Doc 02)
- OG card generation (handled by `@vercel/og` â€” see OG image routes)
- Platform photography rotation (see Doc 02 Â§5)

---

## 2. BRAND CONSTRAINTS â€” NON-NEGOTIABLE RULES

These rules come directly from Doc 02 (Brand Guidelines Â§5) and override any Kling capability or prompt pattern:

### Absolute Rules

| Rule | Rationale |
|------|-----------|
| **No AI-generated people.** No faces, no realistic human bodies. | LastDonor uses real photography of real people (from DVIDS, FEMA, user uploads). AI faces undermine trust. |
| **No photorealism.** Every AI image must be obviously illustrative. | Readers must never confuse an AI image with a real photograph. Trust is the platform's currency. |
| **Abstract, geometric, brand-colored.** Teal (#0F766E) and amber (#D97706) must dominate. | Visual consistency across all blog posts. Every image must feel like it belongs to LastDonor. |
| **No exploitation imagery.** No graphic suffering, destruction, gore, helplessness. | Dignity first. Show strength, resilience, hope â€” never victimhood. |
| **No text in images.** No logos, watermarks, or readable text. | Text belongs in HTML, not images. Text in images is inaccessible, non-localizable, non-searchable. |

### Allowed Representations of Humans

Geometric/abstract silhouettes are acceptable when they:
- Have no recognizable facial features (no eyes, nose, mouth)
- Are clearly stylized (geometric shapes, solid colors, no skin tones)
- Represent concepts (community, support, togetherness) not specific people
- Use brand colors (teal/amber silhouettes on neutral backgrounds)

### Color Requirements

| Element | Color(s) | Hex |
|---------|----------|-----|
| Primary shapes/forms | Deep Teal | #0F766E |
| Accent elements, highlights, energy | Warm Amber | #D97706 |
| Background (light) | Warm white or soft cream | #F8F6F2 or #FFF7ED |
| Background (dark) | Soft charcoal or deep teal | #1A2E2B or #0F1A19 |
| Supporting elements | Light gray or medium gray | #E5E7EB or #6B7280 |
| Never use | Red, bright green, purple, or any color outside the brand palette | â€” |

---

## 3. KLING AI PLATFORM OVERVIEW

| Property | Value |
|----------|-------|
| Provider | Kuaishou Technology |
| Product | Kling AI Image Generation |
| Model | `kling-v2-1` (latest generation model) |
| API Region | Singapore |
| API Base URL | `https://api-singapore.klingai.com` |
| Authentication | JWT (HS256) â€” **not** plain API keys |
| Task Model | Asynchronous: submit â†’ poll â†’ retrieve |
| Output Format | JPEG/PNG (temporary URLs â€” must download immediately) |
| Typical Generation Time | 15â€“60 seconds |
| Maximum Generation Time | ~3 minutes (180 seconds) |

### How Kling Differs from Other Image APIs

1. **JWT authentication** â€” You do not pass an API key as a Bearer token. You generate a short-lived JWT signed with your secret key.
2. **Asynchronous generation** â€” The API returns a `task_id` immediately. You poll a separate endpoint until the image is ready.
3. **Temporary URLs** â€” The image URL returned by Kling expires. You must download the image and re-host it yourself.
4. **Response code field** â€” Success is `code: 0` in the JSON body, not HTTP status codes. A 200 HTTP response can still contain an error in `code`.

---

## 4. AUTHENTICATION â€” JWT TOKEN GENERATION

Kling uses JWT (JSON Web Token) authentication signed with HS256.

### JWT Structure

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "iss": "<KLING_ACCESS_KEY>",
  "exp": <current_unix_timestamp + 1800>,
  "nbf": <current_unix_timestamp - 5>,
  "iat": <current_unix_timestamp>
}
```

| Claim | Value | Purpose |
|-------|-------|---------|
| `iss` | Your `KLING_ACCESS_KEY` | Identifies the API consumer |
| `exp` | Now + 1800 (30 minutes) | Token expiration. Kling rejects expired tokens. |
| `nbf` | Now - 5 | "Not before" â€” 5-second buffer for clock skew between your server and Kling's |
| `iat` | Now | Issued-at timestamp |

**Signing:** The payload is signed with `KLING_SECRET_KEY` using the HS256 algorithm.

### Implementation

```typescript
import jwt from 'jsonwebtoken';

function generateKlingToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: process.env.KLING_ACCESS_KEY,
      exp: now + 1800,
      nbf: now - 5,
      iat: now,
    },
    process.env.KLING_SECRET_KEY!,
    { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } },
  );
}
```

### Token Lifecycle

- Generate a **fresh token per request batch** (or cache for up to ~25 minutes)
- Do not reuse tokens across long pipeline runs
- If you get an auth error, regenerate the token immediately and retry once

---

## 5. API CONTRACT â€” ENDPOINTS, REQUEST, RESPONSE

### Base URL

```
https://api-singapore.klingai.com
```

### Headers (all requests)

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Endpoint 1: Create Image Generation Task

```
POST /v1/images/generations
```

**Request Body:**

```json
{
  "model_name": "kling-v2-1",
  "prompt": "...",
  "negative_prompt": "...",
  "n": 1,
  "aspect_ratio": "16:9"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_name` | string | **Yes** | Always `"kling-v2-1"` |
| `prompt` | string | **Yes** | Text description of the desired image (see Â§7â€“8) |
| `negative_prompt` | string | No | Comma-separated list of elements to exclude (see Â§9) |
| `n` | integer | No | Number of images per request. Default `1`. Max `4`. |
| `aspect_ratio` | string | **Yes** | One of: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9` |

**Success Response (HTTP 200):**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123def456..."
  }
}
```

**Error Response (HTTP 200 with non-zero code):**

```json
{
  "code": 1001,
  "message": "Invalid prompt content"
}
```

> **Critical**: Always check `code === 0`. An HTTP 200 with `code !== 0` is an error.

### Endpoint 2: Poll Task Status

```
GET /v1/images/generations/{task_id}
```

**Response (in-progress):**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123def456...",
    "task_status": "processing"
  }
}
```

**Response (complete):**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123def456...",
    "task_status": "succeed",
    "task_result": {
      "images": [
        {
          "url": "https://cdn.klingai.com/temporary/..."
        }
      ]
    }
  }
}
```

**Response (failed):**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123def456...",
    "task_status": "failed",
    "task_status_msg": "Content policy violation"
  }
}
```

### Task Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| `submitted` | Queued for processing | Continue polling |
| `processing` | Image generation in progress | Continue polling |
| `succeed` | Complete â€” image URL in `task_result.images[0].url` | Download immediately |
| `failed` | Generation failed â€” see `task_status_msg` | Log error, retry with adjusted prompt |

### Endpoint 3: List Tasks (diagnostic)

```
GET /v1/images/generations?pageNum=1&pageSize=10
```

Returns recent tasks. Useful for debugging but not used in the pipeline.

---

## 6. IMAGE TYPES & DIMENSIONS

### Blog Image Types

| Type | Purpose | Aspect Ratio | Kling `aspect_ratio` | Pixel Dimensions | Target File Size |
|------|---------|-------------|---------------------|-----------------|-----------------|
| Hero/Cover | Top of blog post, OG share image, blog listing card | 16:9 | `"16:9"` | 1200Ã-630 | < 150KB (WebP) |
| Section | Break up text every 500â€“800 words | 16:9 | `"16:9"` | 800Ã-450 | < 100KB (WebP) |
| Infographic | Data visualization, process diagrams | 3:4 | `"3:4"` | 800Ã-1067 | < 200KB (WebP) |

### Aspect Ratio Reference

Kling supports these aspect ratios:

| Ratio | Decimal | Best For |
|-------|---------|----------|
| `1:1` | 1.0 | Square thumbnails, social avatars |
| `16:9` | 1.78 | Hero banners, wide images (primary for blog) |
| `9:16` | 0.56 | Vertical/mobile stories |
| `4:3` | 1.33 | Standard landscape |
| `3:4` | 0.75 | Portrait/infographic |
| `3:2` | 1.5 | Standard landscape photo |
| `2:3` | 0.67 | Portrait |
| `21:9` | 2.33 | Ultra-wide cinematic |

For blog images, use `16:9` for hero and section images, `3:4` for infographics.

---

## 7. PROMPT ENGINEERING â€” CORE FRAMEWORK

### The Challenge

Kling excels at photorealistic output. LastDonor requires abstract geometric illustrations. This means our prompts must be aggressively specific about style to override Kling's photorealistic tendencies.

### Base Style Directive (included in every prompt)

```
STYLE: Modern flat vector illustration with clean geometric shapes and subtle gradients.
Color palette restricted to deep teal (#0F766E), warm amber (#D97706), soft cream (#F8F6F2),
and neutral grays. No photography. No photorealism. No realistic textures.

AESTHETIC: Abstract and conceptual. Represent themes through geometric shapes, icons,
and symbols â€” never through realistic depictions. Clean lines, bold shapes, generous
negative space. The image should look like a premium editorial illustration from a
modern nonprofit annual report.

COMPOSITION: Centered focal point with supporting abstract elements. Balanced layout.
Substantial negative space (at least 30% of canvas). No cluttered scenes.
Suitable for web use as a blog header image.

MANDATORY EXCLUSIONS: No human faces. No realistic human bodies. No photographic
elements. No 3D rendering. No dark/gloomy palettes. No text or typography in the image.
```

### Prompt Structure Template

Every blog image prompt follows this 6-part structure:

```
[BASE STYLE DIRECTIVE]

SUBJECT: [Abstract visual metaphor for the topic]

VISUAL ELEMENTS: [Specific geometric shapes, icons, and symbols to include]

COLOR EMPHASIS: [Which brand colors dominate and where]

MOOD: [Emotional register â€” hopeful, warm, empathetic, resilient, celebratory]

FORMAT: [Aspect ratio and dimension context]
```

### Why This Structure Works

1. **Style directive first** â€” Kling processes prompts front-to-back. Establishing "flat vector illustration" immediately prevents photorealistic interpretation.
2. **Abstract subject** â€” Describing visual metaphors (a shield for protection, a bridge for transition) produces better illustrations than describing literal scenes.
3. **Specific visual elements** â€” Naming exact shapes and icons ("hexagonal grid", "circular flow diagram", "ascending staircase pattern") gives Kling concrete geometry to render.
4. **Color specification with hex codes** â€” Kling responds well to hex color codes. Including them produces more accurate color matching than color names alone.
5. **Mood keywords** â€” These influence lighting, warmth, and visual weight. "Hopeful" produces brighter, more upward-oriented compositions.
6. **Format context** â€” Telling Kling the intended use helps it choose appropriate composition density.

### Prompt Length Guidelines

| Element | Target Length | Why |
|---------|-------------|-----|
| Base style directive | ~80 words | Consistent across all images |
| Subject description | 15â€“25 words | Specific enough for the topic, abstract enough to avoid photorealism |
| Visual elements | 20â€“40 words | Concrete geometric vocabulary Kling can act on |
| Color emphasis | 10â€“20 words | Prevents Kling from introducing off-brand colors |
| Mood | 5â€“10 words | Sets emotional tone without overriding style |
| Total prompt | 150â€“200 words | Longer prompts give Kling more constraints, reducing randomness |

---

## 8. CATEGORY-SPECIFIC PROMPT TEMPLATES (ALL 23 CATEGORIES)

Each template below provides the SUBJECT, VISUAL ELEMENTS, COLOR EMPHASIS, and MOOD for that cause category. The base style directive from Â§7 is always prepended.

### 8.1 Medical

```
SUBJECT: Abstract representation of healing and medical support through geometric forms.

VISUAL ELEMENTS: Stylized medical cross made of teal geometric blocks. Heartbeat/pulse
line rendered as a flowing amber ribbon. Circular shapes suggesting cellular healing or
protection. Gentle upward-arcing curves conveying recovery. A shield shape surrounding
the medical cross suggesting care and safety.

COLOR EMPHASIS: Deep teal (#0F766E) for the medical cross and primary shapes. Warm amber
(#D97706) for the pulse line and accent highlights. Cream (#F8F6F2) background.

MOOD: Hopeful, warm, reassuring. Soft gradients suggesting dawn or new beginning.
```

### 8.2 Disaster

```
SUBJECT: Abstract representation of community resilience and rebuilding after hardship.

VISUAL ELEMENTS: Geometric house outline being reconstructed from teal building blocks.
Amber rays breaking through from behind, suggesting sunlight after a storm. Interlocking
geometric shapes forming a foundation. Ascending arrow motifs. A stylized horizon line
with abstract landscape elements above it.

COLOR EMPHASIS: Deep teal (#0F766E) for building/structural shapes. Warm amber (#D97706)
for light rays and hope accents. Soft gradient from darker gray at bottom to cream at top,
suggesting emergence from difficulty.

MOOD: Resilient, determined, forward-looking. The composition should move upward and outward.
```

### 8.3 Military

```
SUBJECT: Abstract tribute to military service rendered as geometric symbols of duty and honor.

VISUAL ELEMENTS: Stylized shield or chevron shape in teal. Geometric star formation
(not a literal flag). Abstract dog tag shapes with clean lines. Folded geometric shapes
suggesting a ceremonial form. Strong vertical lines conveying structure and discipline.
A subtle amber highlight suggesting warmth behind the formal geometry.

COLOR EMPHASIS: Deep teal (#0F766E) dominant for structure and duty. Amber (#D97706)
as warm accent suggesting the human element behind service. Neutral gray supporting
elements on cream (#F8F6F2) background.

MOOD: Dignified, proud, warm. Not militaristic or aggressive â€” honorable and humane.
```

### 8.4 Veterans

```
SUBJECT: Abstract representation of transition, new beginnings, and continued service to community.

VISUAL ELEMENTS: A geometric bridge shape connecting two stylized landscapes (structured/
angular on one side transitioning to organic/flowing on the other). Medal or star shapes in
amber. Pathway rendered as clean parallel lines leading forward. Circular shapes suggesting
community integration.

COLOR EMPHASIS: Teal (#0F766E) bridge structure. Amber (#D97706) medal/star accents and
the forward-facing side. Gradient from structured teal to warmer amber tones suggesting
transition.

MOOD: Hopeful, transitional, purposeful. The composition should suggest forward movement.
```

### 8.5 Memorial

```
SUBJECT: Abstract representation of remembrance, legacy, and the warmth of memory.

VISUAL ELEMENTS: Stylized candle flame rendered as an amber geometric shape with a soft
glow effect. Concentric circles radiating outward suggesting ripples of impact. Gentle
arc shapes suggesting embracing arms or sheltering forms. Abstract flower shapes in teal
(simple geometric petals). A subtle halo or ring of light.

COLOR EMPHASIS: Warm amber (#D97706) for the flame/light center. Deep teal (#0F766E)
for surrounding memorial shapes. Soft warm-toned background (cream to pale amber gradient).

MOOD: Peaceful, warm, dignified. Quiet and contemplative, not sad or dark.
```

### 8.6 First Responders

```
SUBJECT: Abstract tribute to emergency service duty through bold geometric symbols.

VISUAL ELEMENTS: Stylized badge or shield shape as the central element. Geometric flame
shape (for fire service) or medical cross (for EMS) rendered abstractly. Bold intersecting
lines suggesting rapid response and decisive action. Angular shapes conveying strength and
readiness. A subtle homeward-pointing element suggesting the return after duty.

COLOR EMPHASIS: Deep teal (#0F766E) for badge/shield structures. Amber (#D97706)
for flame elements and urgency accents. Strong contrast on clean cream (#F8F6F2) background.

MOOD: Bold, courageous, warm. Strength paired with humanity.
```

### 8.7 Community

```
SUBJECT: Abstract representation of togetherness, mutual support, and neighborhood strength.

VISUAL ELEMENTS: Interlocking circular or hexagonal shapes forming a connected network.
Multiple geometric forms fitting together like puzzle pieces. A central gathering point
with radiating connections. Abstract tree or root structure suggesting organic growth from
community foundation. Overlapping teal and amber shapes creating depth.

COLOR EMPHASIS: Alternating deep teal (#0F766E) and warm amber (#D97706) shapes to show
diversity within unity. Softer tones where shapes overlap. Cream (#F8F6F2) background.

MOOD: Warm, inclusive, interconnected. The composition should feel cohesive despite
multiple elements â€” unity from diversity.
```

### 8.8 Essential Needs

```
SUBJECT: Abstract representation of stability, shelter, and life's fundamental necessities.

VISUAL ELEMENTS: Geometric house shape with a strong roofline. Abstract representations of
warmth (radiating lines from the house center). Simple geometric forms suggesting food
(circular plate shape), water (droplet), warmth (flame or sun). Horizontal grounding
line providing visual stability. A protective encompassing arch or dome shape.

COLOR EMPHASIS: Deep teal (#0F766E) for the house/shelter structure. Amber (#D97706) for
warmth rays and essential elements. Thick stable lines in darker teal at the base.

MOOD: Stable, secure, warm. Grounded and reassuring â€” the visual equivalent of "you are safe."
```

### 8.9 Education

```
SUBJECT: Abstract representation of learning, growth, and intellectual empowerment.

VISUAL ELEMENTS: Geometric book shape or open-book silhouette as the central form. Abstract
ascending staircase or growth chart pattern. Lightbulb shape rendered as geometric teal and
amber forms. Graduation cap as a simple angular shape. Branching tree structure suggesting
knowledge pathways.

COLOR EMPHASIS: Deep teal (#0F766E) for books and foundational knowledge shapes. Amber
(#D97706) for the lightbulb and growth highlights â€” amber represents achievement. Cream
(#F8F6F2) background.

MOOD: Aspirational, bright, forward-moving. Upward compostion suggesting growth and potential.
```

### 8.10 Animal

```
SUBJECT: Abstract representation of animal care, compassion, and the human-animal bond.

VISUAL ELEMENTS: Stylized paw print rendered as a geometric teal shape. Abstract heart
shape combining with the paw motif. Simple geometric animal silhouettes (cat, dog) using
only basic shapes â€” circles, triangles â€” clearly not realistic. Sheltering arch or hand
shape (geometric) suggesting protection. Soft curved elements contrasting with angular structure.

COLOR EMPHASIS: Deep teal (#0F766E) for the paw and animal shapes. Warm amber (#D97706)
for heart and care accents. Cream (#F8F6F2) with soft warmth.

MOOD: Gentle, compassionate, warm. Softer edges than other categories, reflecting tenderness.
```

### 8.11 Emergency

```
SUBJECT: Abstract representation of rapid response, immediate relief, and crisis mobilization.

VISUAL ELEMENTS: Dynamic angular shapes suggesting speed and urgency. Geometric lightning
bolt or alert symbol in amber. Concentric circles radiating from a central point (epicenter
of help). Arrow shapes pointing inward toward the center (converging aid). A stabilizing
horizontal element at the base suggesting the ground being held.

COLOR EMPHASIS: Amber (#D97706) dominant for urgency and alert elements. Deep teal
(#0F766E) for stabilizing structure. Higher contrast than other categories â€” bolder, sharper.

MOOD: Urgent but not chaotic. Purposeful energy. The visual says "help is coming" not "everything is falling apart."
```

### 8.12 Family

```
SUBJECT: Abstract representation of family bonds, intergenerational support, and togetherness.

VISUAL ELEMENTS: Nested geometric shapes (larger protecting smaller â€” parent/child metaphor).
Abstract tree of life with branching geometric limbs. Concentric circles suggesting
connection and closeness. Interlocking simple shapes representing different family members
(varied sizes, same visual language). A hearth or home base element anchoring the composition.

COLOR EMPHASIS: Balanced teal (#0F766E) and amber (#D97706) â€” neither dominates, reflecting
partnership and equality. Warm cream (#F8F6F2) background with soft warmth.

MOOD: Warm, nurturing, secure. The visual equivalent of a warm embrace â€” without depicting one.
```

### 8.13 Faith

```
SUBJECT: Abstract representation of spiritual community, devotion, and service through faith.

VISUAL ELEMENTS: Upward-reaching geometric forms suggesting aspiration. Abstract light
rays fanning from a central point. Simple arch or dome shape suggesting sacred architecture
(non-denominational). Circular community gathering pattern. Clean vertical lines balanced
with gentle curves. A dove silhouette rendered as two intersecting geometric curves.

COLOR EMPHASIS: Deep teal (#0F766E) for the structural/community elements. Amber (#D97706)
for light rays and spiritual warmth. Lighter background suggesting openness and light.

MOOD: Peaceful, reverent, communal. Warm light without being radiant. Non-denominational â€” the visual should resonate across faiths.
```

### 8.14 Environment

```
SUBJECT: Abstract representation of environmental stewardship, nature conservation, and sustainability.

VISUAL ELEMENTS: Geometric leaf shapes and abstract tree forms. Circular earth/globe
rendered as concentric teal rings. Water droplet shapes in gradient teal. Abstract landscape
with rolling geometric hills. A recycling or infinity symbol rendered in brand colors.
Clean branching patterns suggesting both trees and neural networks of ecological connection.

COLOR EMPHASIS: Deep teal (#0F766E) dominant â€” teal already reads as an environmental color.
Amber (#D97706) for sun elements and energy accents. Green is NOT used (off-brand) â€” teal
carries the environmental message.

MOOD: Clean, hopeful, expansive. Open compositions suggesting wide landscapes and possibility.
```

### 8.15 Sports

```
SUBJECT: Abstract representation of teamwork, athletic determination, and community through sport.

VISUAL ELEMENTS: Dynamic angular shapes suggesting movement and energy. Abstract trophy
or medal forms. Geometric field or court patterns (parallel lines, arcs). Overlapping
shapes in motion suggesting team dynamics. Ascending forms suggesting achievement. Circular
target or goal shapes.

COLOR EMPHASIS: Deep teal (#0F766E) for team/structural elements. Amber (#D97706) for
energy, movement, and achievement highlights. High-contrast composition.

MOOD: Energetic, determined, celebratory. Dynamic composition with implied movement â€”
asymmetric balance.
```

### 8.16 Creative

```
SUBJECT: Abstract representation of artistic expression, creativity, and healing through art.

VISUAL ELEMENTS: Geometric paintbrush or pen shape. Abstract canvas or frame form. Musical
note shapes rendered as simple geometric curves. Color spectrum represented through teal-to-amber
gradient bands. Flowing curves contrasting with structured geometric forms â€” the tension
between discipline and freedom. Stage curtain shapes rendered as elegant geometric drapes.

COLOR EMPHASIS: Full teal-to-amber gradient spectrum used more freely than other categories.
This category has the most color variety within brand constraints.

MOOD: Expressive, inspiring, liberating. The composition should feel less structured than
other categories â€” more flowing, more dynamic.
```

### 8.17 Funeral

```
SUBJECT: Abstract representation of celebrating a life lived, farewell, and community in grief.

VISUAL ELEMENTS: Stylized memorial flame or eternal light shape in amber. Gentle arch
shapes suggesting a gateway or passage. Abstract floral arrangement using simple geometric
petal forms. Radiating light from a central warm point. Soft horizontal lines suggesting
peace and rest. A flowing ribbon or banner shape.

COLOR EMPHASIS: Warm amber (#D97706) prominent â€” warmth and light in somber context.
Deep teal (#0F766E) as supporting structure. Warmer background than other categories
(pale amber/cream gradient).

MOOD: Dignified, peaceful, warm. Celebration of life, not sorrow. The visual should
feel like golden hour light â€” warm and gentle.
```

### 8.18 Addiction

```
SUBJECT: Abstract representation of recovery, breaking free, and the journey toward healing.

VISUAL ELEMENTS: Broken chain links transforming into flowing organic shapes. A geometric
phoenix or rising bird silhouette (two triangular wings ascending). Pathway rendered as
parallel lines starting narrow and widening forward. Sunrise/dawn depicted as concentric
amber arcs on the horizon. A cocoon-to-butterfly metamorphosis suggested through shape
progression from angular to flowing.

COLOR EMPHASIS: Transition gradient from darker teal (#0F766E) at the bottom/past to
warm amber (#D97706) at the top/future. The color journey IS the narrative.

MOOD: Triumphant, hopeful, transformative. Unmistakably forward-facing. Every visual
element should move upward or forward.
```

### 8.19 Elderly

```
SUBJECT: Abstract representation of dignified aging, intergenerational connection, and elder care.

VISUAL ELEMENTS: Geometric tree with deep roots and wide canopy â€” strength from years of
growth. Concentric rings (tree ring metaphor for years lived). Interlocking shapes of
different sizes suggesting intergenerational bonds (larger experienced shapes supporting
smaller newer ones). A rocking chair silhouette rendered as two gentle curves. Warm
radiating elements suggesting wisdom shared.

COLOR EMPHASIS: Deep teal (#0F766E) for the mature structural elements. Amber (#D97706)
for warmth and life accents. Softer, warmer overall palette than other categories.

MOOD: Dignified, warm, respectful. The visual should convey "valued" not "vulnerable."
```

### 8.20 Justice

```
SUBJECT: Abstract representation of fairness, advocacy, and the pursuit of equitable outcomes.

VISUAL ELEMENTS: Geometric balance scales rendered with clean teal lines â€” perfectly
level. A gavel shape simplified to its essential geometric form. Equal sign as a prominent
visual element. Shield shape suggesting protection of rights. Strong vertical line (pillar)
providing structural backbone to the composition.

COLOR EMPHASIS: Deep teal (#0F766E) dominant for institutional structure and stability.
Amber (#D97706) for the balance point and justice highlights. High contrast, clean lines.

MOOD: Resolute, principled, balanced. The composition itself should be symmetrical or
nearly symmetrical â€” visual justice.
```

### 8.21 Housing

```
SUBJECT: Abstract representation of stable housing, home ownership, and shelter security.

VISUAL ELEMENTS: Geometric key shape as the central icon (key to a home). Abstract house
blueprint pattern with clean architectural lines. Door frame shape suggesting entrance
and welcome. Roof line drawn with strong protective angles. Foundation blocks stacked
in stable geometric formations. A welcome mat or threshold element.

COLOR EMPHASIS: Deep teal (#0F766E) for structural/architectural elements. Amber (#D97706)
for the key and welcoming warmth from within the house shape. Warm light suggested
emanating from doorway/window shapes.

MOOD: Secure, welcoming, stable. The visual says "this is yours, this is solid, this is home."
```

### 8.22 Mental Health

```
SUBJECT: Abstract representation of mental wellness, inner peace, and emotional support.

VISUAL ELEMENTS: Geometric brain shape formed from flowing interconnected curves (not
anatomical â€” stylized). Concentric calming circles or ripples suggesting mindfulness.
A peaceful landscape of rolling geometric hills. Abstract sun or dawn shape suggesting
clarity. Puzzle pieces fitting together. Clean open space dominating the composition
(visual breathing room).

COLOR EMPHASIS: Softer teal (#14B8A6 â€” lighter variant) for calming therapeutic elements.
Amber (#D97706) as subtle warmth. More negative space than other categories â€” the emptiness
is intentional and therapeutic.

MOOD: Calm, clear, supportive. The most spacious composition of all categories. Minimal
elements, maximum breathing room. The visual should feel like a deep breath.
```

### 8.23 Wishes

```
SUBJECT: Abstract representation of dreams fulfilled, joy, and making the impossible possible.

VISUAL ELEMENTS: Geometric star burst pattern radiating outward. Abstract gift box shape
with amber ribbon. Sparkle shapes rendered as small diamond/rhombus forms. Magic wand shape
simplified to a line with a star endpoint. Ascending celebration shapes (confetti as simple
geometric dots and triangles). A doorway opening to reveal light.

COLOR EMPHASIS: Amber (#D97706) dominant â€” this is the most amber-forward category.
Warmth and celebration. Deep teal (#0F766E) as grounding structure. Bright, high-energy
palette within brand constraints.

MOOD: Joyful, magical, celebratory. The brightest and most energetic composition of all
categories. Visual exuberance.
```

---

## 9. NEGATIVE PROMPT STRATEGY

Negative prompts tell Kling what to exclude. They are critical for forcing illustration-style output from a model that defaults to photorealism.

### Base Negative Prompt (always included)

```
photograph, photorealistic, realistic, real photo, DSLR, camera, photography,
3D render, 3D, CGI, hyperrealistic, realistic textures, realistic lighting,
human face, human eyes, real person, portrait, headshot, skin tone, skin texture,
text, typography, words, letters, numbers, watermark, logo, signature, stamp,
blurry, low quality, distorted, deformed, ugly, amateur, pixelated,
dark, gloomy, depressing, horror, scary, disturbing, violent, gore, blood,
red color, purple color, bright green color, neon colors, rainbow,
cluttered, busy, noisy, complex background, multiple focal points
```

### Why Each Element Is There

| Negative Element | Prevents |
|-----------------|----------|
| `photograph, photorealistic, realistic, DSLR, camera` | Kling's photorealism tendency |
| `3D render, 3D, CGI, hyperrealistic` | 3D renderings that look quasi-photographic |
| `human face, human eyes, real person, portrait, headshot` | AI-generated faces (brand rule) |
| `skin tone, skin texture` | Any realistic human skin rendering |
| `text, typography, words, letters, numbers` | Text baked into the image |
| `watermark, logo, signature, stamp` | Attribution artifacts |
| `blurry, low quality, distorted, deformed` | Quality issues |
| `dark, gloomy, depressing, horror, scary` | Off-brand emotional tone |
| `violent, gore, blood` | Exploitation imagery |
| `red color, purple color, neon colors, rainbow` | Off-brand colors |
| `cluttered, busy, noisy, complex background` | Overly complex compositions |

### Category-Specific Negative Additions

These are appended to the base negative prompt for specific categories:

| Category | Additional Negatives | Rationale |
|----------|---------------------|-----------|
| Medical | `surgery, hospital bed, needles, blood draw, IV drip, medical equipment closeup` | Avoid clinical/uncomfortable imagery |
| Disaster | `destruction, rubble, collapsed building, flood water, tornado, fire damage, wreckage` | Show resilience, not devastation |
| Military | `weapons, guns, combat, battlefield, war, explosion, camouflage` | Honor service, not glorify combat |
| Memorial | `coffin, casket, graveyard, tombstone, crying, tears, mourning` | Celebration of life, not death imagery |
| Emergency | `accident, crash, injury, ambulance interior, stretcher, trauma` | Show response mobilization, not the crisis |
| Addiction | `drugs, alcohol, needles, pills, bottles, substances, withdrawal` | Show recovery, never the addiction |
| Funeral | `open casket, body, burial, cemetery, graves, mourners crying` | Dignity and warmth, not sorrow imagery |

---

## 10. FULL PIPELINE ARCHITECTURE

### Flow Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Blog Pipeline        â”‚
â”‚  requests hero image  â”‚
â”‚  for topic            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  1. Build Prompt      â”‚
â”‚  - Base style         â”‚
â”‚  - Category template  â”‚
â”‚  - Negative prompt    â”‚
â”‚  - Aspect ratio       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  2. Generate JWT      â”‚
â”‚  - HS256 sign with    â”‚
â”‚    KLING_SECRET_KEY   â”‚
â”‚  - 30-min expiry      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  3. Submit Task       â”‚
â”‚  POST /v1/images/     â”‚
â”‚    generations        â”‚
â”‚  - model: kling-v2-1  â”‚
â”‚  - prompt + negative  â”‚
â”‚  - aspect_ratio       â”‚
â”‚  Response: task_id    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  4. Poll for Result   â”‚
â”‚  GET /v1/images/      â”‚
â”‚    generations/{id}   â”‚
â”‚  - Every 5 seconds    â”‚
â”‚  - Max 180 seconds    â”‚
â”‚  - Check task_status  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
     â”Œâ”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”
     â–¼            â–¼
  succeed       failed
     â”‚            â”‚
     â”‚            â–¼
     â”‚     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚     â”‚ Retry once   â”‚
     â”‚     â”‚ with adjustedâ”‚
     â”‚     â”‚ prompt       â”‚
     â”‚     â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
     â”‚            â”‚
     â”‚     â”Œâ”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”
     â”‚     â–¼            â–¼
     â”‚  succeed    still failed
     â”‚     â”‚            â”‚
     â”‚     â”‚            â–¼
     â”‚     â”‚     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚     â”‚     â”‚ Return null  â”‚
     â”‚     â”‚     â”‚ â†’ OG fallbackâ”‚
     â”‚     â”‚     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
     â”‚     â”‚
     â–¼     â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  5. Download Image    â”‚
â”‚  - Fetch from temp    â”‚
â”‚    Kling URL          â”‚
â”‚  - Validate size and  â”‚
â”‚    content-type       â”‚
â”‚  - Convert to Buffer  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  6. Upload to         â”‚
â”‚     Supabase Storage  â”‚
â”‚  - Bucket: 'media'    â”‚
â”‚  - Path: blog/{slug}/ â”‚
â”‚    {keyword}-{type}   â”‚
â”‚    .webp              â”‚
â”‚  - Get public URL     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚
           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  7. Return permanent  â”‚
â”‚     public URL +      â”‚
â”‚     alt text +        â”‚
â”‚     dimensions        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Timing Budget

| Step | Expected Duration |
|------|-------------------|
| Build prompt | < 1ms |
| Generate JWT | < 5ms |
| Submit task (network) | 200â€“500ms |
| Poll wait (generation) | 15â€“60 seconds |
| Download image | 1â€“3 seconds |
| Upload to Supabase | 1â€“3 seconds |
| **Total per image** | **20â€“70 seconds** |

---

## 11. SUPABASE STORAGE INTEGRATION

### Storage Path Convention

```
media/blog/{post-slug}/{keyword-slug}-{type}.webp
```

Examples:
```
media/blog/how-to-help-after-a-house-fire/house-fire-assistance-hero.webp
media/blog/how-to-help-after-a-house-fire/house-fire-assistance-section-1.webp
media/blog/veteran-housing-programs-guide/veteran-housing-hero.webp
```

### Upload Process

1. Download the image from Kling's temporary URL into a `Buffer`
2. Upload to Supabase Storage using the service role client
3. Retrieve the permanent public URL via `getPublicUrl()`
4. Store only the **permanent** public URL in the `blog_posts.cover_image_url` column

### File Format

All blog images are stored as WebP. If Kling returns a JPEG or PNG, the image should be
converted before upload (future optimization â€” for now, store as-is with `.webp` extension
if already WebP, or appropriate extension if not).

### Size Limits

The existing Supabase Storage configuration (`src/lib/supabase-storage.ts`) allows:
- Maximum file size: 5MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- Bucket: `media`

Kling-generated images are typically 200KBâ€“1MB, well within limits.

---

## 12. RETRY LOGIC & ERROR RECOVERY

### Retry Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Max retries per image | 2 | Prevents infinite loops while allowing transient failure recovery |
| Delay between retries | 3,000ms | Gives Kling time to recover from transient issues |
| Poll interval | 5,000ms | Kling's recommended minimum interval |
| Poll timeout | 180,000ms (3 min) | Most images complete in 60 seconds; 3 minutes handles slow queue |
| Delay between task submissions | 1,000ms | Prevents rate limiting when generating multiple images |

### Retry Scenarios

| Scenario | Action |
|----------|--------|
| JWT auth error (401) | Regenerate token and retry immediately |
| Task submission fails (network) | Wait 3s, retry with same prompt |
| Task status `failed` | Simplify prompt (remove most specific elements), retry |
| Poll timeout (no result in 180s) | Log, return null â†’ fallback |
| Image download fails | Wait 3s, retry download (URL may still be valid) |
| Supabase upload fails | Wait 3s, retry upload |
| All retries exhausted | Return null â†’ OG fallback image |

### Prompt Simplification on Retry

When a task fails, the retry uses a shorter, safer prompt:

```
Simple geometric abstract illustration in teal (#0F766E) and amber (#D97706) colors.
Clean shapes on cream background. Modern editorial style. No text, no people.
```

This drastically reduces the chance of content policy violation or generation failure while still producing a usable brand-consistent image.

---

## 13. IMAGE OPTIMIZATION

### Current Approach (MVP)

For the initial pipeline, images are stored as-is from Kling after downloading. The images
are typically high enough quality for web use without additional processing.

### Future Enhancement (Post-MVP)

When image volume increases, add `sharp` for server-side optimization:

```bash
npm install sharp
```

Optimization targets:
- Convert to WebP (quality 80)
- Resize to exact pixel dimensions (1200Ã-630 for hero, 800Ã-450 for section)
- Strip EXIF/metadata
- Target < 150KB for hero images, < 100KB for section images
- Generate base64 blur placeholder (10Ã-5px) for above-the-fold images

This is **not implemented in the initial pipeline** because:
1. `sharp` requires native binaries that complicate Vercel deployment
2. Kling's output quality is sufficient for web use
3. The blog generates 1 image per day â€” optimization savings are negligible at this volume

---

## 14. COST MANAGEMENT

### Per-Image Costs

| Component | Cost | Notes |
|-----------|------|-------|
| Kling generation (kling-v2-1) | ~$0.05â€“0.10 | Per image, varies by plan tier |
| Supabase Storage | ~$0.001 | Per image stored (~500KB average) |
| Supabase bandwidth | ~$0.001 | Per image served to a reader |
| **Total per image** | **~$0.05â€“0.10** | |

### Per-Post Costs

| Scenario | Images | Cost |
|----------|--------|------|
| Hero only (default) | 1 | $0.05â€“0.10 |
| Hero + 2 section images | 3 | $0.15â€“0.30 |
| Hero + 3 section + infographic | 5 | $0.25â€“0.50 |

### Monthly Budget (at 1 post/day)

| Scenario | Monthly Posts | Monthly Image Cost |
|----------|-------------|-------------------|
| Hero only | 30 | $1.50â€“$3.00 |
| Hero + 2 sections | 30 | $4.50â€“$9.00 |
| Maximum (5 images/post) | 30 | $7.50â€“$15.00 |

### Cost Tracking

Every Kling API call should be logged to `blog_generation_logs` with step `images_generated`
and metadata including the number of images requested and task IDs, enabling cost monitoring
through the existing pipeline health metrics.

---

## 15. ENVIRONMENT VARIABLES

### Required for Kling Integration

| Variable | Description | Example |
|----------|-------------|---------|
| `KLING_ACCESS_KEY` | Public access key â€” JWT issuer (`iss`) claim | `AhpgDBPf...` |
| `KLING_SECRET_KEY` | Secret key â€” HS256 signing key | `PayHGBCb...` |

### Optional Pipeline Controls

| Variable | Description | Default |
|----------|-------------|---------|
| `KLING_API_URL` | API base URL (override for testing) | `https://api-singapore.klingai.com` |
| `KLING_IMAGES_PER_POST` | Images to generate per blog post | `1` |
| `KLING_MODEL` | Model name | `kling-v2-1` |

### Behavior When Keys Are Missing

If `KLING_ACCESS_KEY` or `KLING_SECRET_KEY` is not set:
- `generateBlogImage()` returns `null` immediately (no API call attempted)
- The pipeline falls back to the OG image generator (`/api/v1/og/page`)
- A warning is logged but the pipeline does **not** fail
- The blog post is still created with a fallback cover image

---

## 16. TROUBLESHOOTING

### Common Issues

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| `JWT auth failed` / 401 | Wrong keys, expired token, or clock skew | Verify `KLING_ACCESS_KEY` and `KLING_SECRET_KEY` match your Kling dashboard. Ensure server clock is synced. |
| `code: 1001` in response | Prompt triggered content filter | Simplify prompt. Remove words like "injury", "fire", "blood", "weapon" even in abstract context. |
| Task stuck in `processing` | High API load or complex prompt | Wait for full 180s timeout. If still stuck, the task may complete later â€” but we move on to fallback. |
| Image URL returns 404 | Kling temporary URL expired | This means the download step took too long. Images must be downloaded within seconds of `succeed` status. |
| Wrong style (photorealistic instead of illustration) | Prompt not assertive enough about style | Ensure `STYLE: Modern flat vector illustration` appears at the very start of the prompt. Add more anti-photorealism terms to negative prompt. |
| Off-brand colors | Missing hex codes in prompt | Always include `#0F766E` and `#D97706` in the prompt. Include off-brand colors in negative prompt. |
| Image has text/words | Missing negative prompt | Ensure `text, typography, words, letters, numbers` is in negative prompt. |
| Image has faces | Missing negative prompt | Ensure `human face, human eyes, real person, portrait, headshot` is in negative prompt. |
| Supabase upload fails | Bucket not found or role key wrong | Verify `SUPABASE_SERVICE_ROLE_KEY` is set and the `media` bucket exists. |

### Diagnostic Steps

1. **Test JWT generation**: Generate a token and decode it at jwt.io to verify structure
2. **Test API access**: Call the list endpoint (`GET /v1/images/generations?pageNum=1&pageSize=1`) â€” should return `code: 0`
3. **Test simple generation**: Submit a minimal prompt like `"abstract teal circles on white background"` and verify end-to-end
4. **Check generation logs**: Query `blog_generation_logs` for `step = 'images_generated'` or `step = 'error'`

---

## 17. QUALITY CHECKLIST

Before any Kling-generated image is stored as a blog post's cover image, verify:

| Check | Pass Criteria |
|-------|---------------|
| **No faces** | Image contains zero recognizable faces or realistic human features |
| **Illustration style** | Image is obviously illustrative/geometric, not photorealistic |
| **Brand colors** | Teal (#0F766E) and/or amber (#D97706) visible as dominant colors |
| **No off-brand colors** | No red, purple, bright green, neon, or rainbow present |
| **No text** | Zero readable text, watermarks, or logos in the image |
| **No exploitation** | No graphic suffering, destruction, or hopelessness depicted |
| **Category relevance** | Visual elements relate to the blog post's cause category |
| **Clean composition** | Clear focal point, adequate negative space, no clutter |
| **File size** | Under 1MB (Kling output), under 5MB (Supabase limit) |
| **Correct dimensions** | Matches intended aspect ratio (16:9 for hero, 3:4 for infographic) |

These checks are currently human-verified via the admin UI (drafts are reviewed before publishing). Future enhancement: automated image classification to flag violations before human review.

---

## APPENDIX A: QUICK REFERENCE

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  KLING AI â€” LASTDONOR QUICK REFERENCE                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  API Base:     https://api-singapore.klingai.com                â”‚
â”‚  Model:        kling-v2-1                                       â”‚
â”‚  Auth:         JWT (HS256) â€” KLING_ACCESS_KEY + KLING_SECRET_KEYâ”‚
â”‚  Create:       POST /v1/images/generations                      â”‚
â”‚  Poll:         GET  /v1/images/generations/{task_id}             â”‚
â”‚  Success:      code === 0 && task_status === "succeed"           â”‚
â”‚  Poll Interval:5s  |  Timeout: 180s  |  Retries: 2             â”‚
â”‚  Output:       Temporary URL â†’ download â†’ Supabase Storage      â”‚
â”‚  Storage Path: media/blog/{slug}/{keyword}-{type}.webp          â”‚
â”‚  Style:        Abstract geometric illustration                  â”‚
â”‚  Colors:       Teal #0F766E + Amber #D97706 on Cream #F8F6F2   â”‚
â”‚  NEVER:        Faces, photorealism, text, off-brand colors      â”‚
â”‚  Fallback:     /api/v1/og/page (branded text-on-gradient)       â”‚
â”‚  Dependencies: jsonwebtoken                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## APPENDIX B: ALL 23 CATEGORY VISUAL ELEMENT SUMMARY

| # | Category | Central Icon/Shape | Dominant Color | Mood |
|---|----------|-------------------|---------------|------|
| 1 | medical | Medical cross + pulse ribbon | Teal | Hopeful, reassuring |
| 2 | disaster | Rebuilding house + amber rays | Teal â†’ Amber | Resilient, forward |
| 3 | military | Shield/chevron + star | Teal | Dignified, proud |
| 4 | veterans | Bridge + medal shapes | Teal â†’ Amber | Transitional, hopeful |
| 5 | memorial | Candle flame + concentric circles | Amber | Peaceful, warm |
| 6 | first-responders | Badge/shield + flame | Teal + Amber | Bold, courageous |
| 7 | community | Interlocking hexagons/circles | Balanced | Warm, inclusive |
| 8 | essential-needs | House + warmth rays | Teal | Stable, secure |
| 9 | education | Book + lightbulb + stairs | Teal | Aspirational, bright |
| 10 | animal | Paw print + heart | Teal | Gentle, compassionate |
| 11 | emergency | Lightning + converging arrows | Amber | Urgent, purposeful |
| 12 | family | Nested shapes + tree of life | Balanced | Warm, nurturing |
| 13 | faith | Upward forms + light rays + dove | Teal + Amber | Peaceful, communal |
| 14 | environment | Leaf + earth rings + water | Teal dominant | Clean, expansive |
| 15 | sports | Dynamic angles + trophy | Teal + Amber | Energetic, dynamic |
| 16 | creative | Brush + canvas + notes | Full gradient | Expressive, flowing |
| 17 | funeral | Memorial flame + arch | Amber | Dignified, warm |
| 18 | addiction | Broken chain + phoenix + sunrise | Teal â†’ Amber | Triumphant, hopeful |
| 19 | elderly | Tree + rings + canopy | Teal | Dignified, respectful |
| 20 | justice | Balance scales + gavel + pillar | Teal | Resolute, balanced |
| 21 | housing | Key + house blueprint + door | Teal + Amber | Secure, welcoming |
| 22 | mental-health | Brain curves + ripples | Light Teal | Calm, spacious |
| 23 | wishes | Star burst + gift + sparkles | Amber dominant | Joyful, magical |
