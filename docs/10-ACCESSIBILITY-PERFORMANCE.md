# LastDonor.org â€” Accessibility & Performance Budget

**Document ID**: LD-A11Y-PERF-001
**Version**: 0.1
**Date**: March 19, 2026
**Status**: Draft
**Classification**: Internal â€” Engineering
**Owner**: Engineering Lead
**Compliance Target**: WCAG 2.1 Level AA

---

## 1. Accessibility Standards

### 1.1 Compliance Target

**WCAG 2.1 Level AA** â€” mandatory for all pages before launch.

Rationale: A nonprofit fundraising platform must be usable by everyone, including donors with visual, motor, or cognitive disabilities. Beyond ethics, ADA lawsuits against websites are increasing. AA compliance blocks this risk entirely.

### 1.2 WCAG 2.1 AA Requirements Matrix

| Principle | Guideline | Implementation |
|-----------|-----------|---------------|
| **Perceivable** | 1.1 â€” Text alternatives | All images have descriptive `alt` text. Decorative images use `alt=""`. Campaign hero images describe the person/scene. |
| | 1.2 â€” Time-based media | Any future video/audio content must have captions and transcripts. |
| | 1.3 â€” Adaptable | Semantic HTML throughout (`<main>`, `<nav>`, `<article>`, `<section>`, `<aside>`). Headings in proper hierarchy (`h1` > `h2` > `h3`). Form inputs have `<label>` elements. |
| | 1.4 â€” Distinguishable | Color contrast ratios meet minimums. Text is resizable to 200%. No information conveyed by color alone. |
| **Operable** | 2.1 â€” Keyboard accessible | All interactive elements reachable via Tab. Custom components have proper keyboard handlers. No keyboard traps. Skip-to-content link on every page. |
| | 2.2 â€” Enough time | No auto-advancing content. Session timeouts show warning with option to extend. |
| | 2.3 â€” Seizures | No flashing content. No auto-playing animations. |
| | 2.4 â€” Navigable | Clear page titles. Focus order matches visual order. Link purpose clear from text (no "click here"). Breadcrumbs on campaign pages. |
| | 2.5 â€” Input modalities | Touch targets minimum 44Ã-44px. |
| **Understandable** | 3.1 â€” Readable | `lang="en"` on `<html>`. Reading level: aim for 8th grade on campaign pages. |
| | 3.2 â€” Predictable | Navigation consistent across pages. No unexpected context changes. Form submission requires explicit action (button click). |
| | 3.3 â€” Input assistance | Form errors identified clearly. Required fields marked. Error messages suggest corrections. |
| **Robust** | 4.1 â€” Compatible | Valid HTML. ARIA attributes used correctly. Works with screen readers (NVDA, JAWS, VoiceOver). |

### 1.3 Color Contrast Requirements

| Element | Foreground | Background | Ratio | Minimum Required |
|---------|-----------|------------|:-----:|:-----:|
| Body text (light mode) | `#1A1A1A` (Near Black) | `#F8F6F2` (Warm White) | 15.4:1 | 4.5:1 âœ“ |
| Body text (dark mode) | `#F1F5F9` | `#0F1A19` | 14.8:1 | 4.5:1 âœ“ |
| Amber CTA button text | `#FFFFFF` | `#D97706` (Amber) | 3.1:1 | 3:1 (large text) âœ“ |
| Amber CTA â€” adjusted for small text | `#0F1A19` (Dark text) | `#D97706` (Amber) | 4.7:1 | 4.5:1 âœ“ |
| Red urgency badge | `#FFFFFF` | `#8B2332` (Red) | 7.1:1 | 4.5:1 âœ“ |
| Green success badge | `#FFFFFF` | `#2D6A4F` (Green) | 5.8:1 | 4.5:1 âœ“ |
| Teal on white | `#0F766E` (Deep Teal) | `#F8F6F2` (Warm White) | 5.2:1 | 4.5:1 âœ“ |
| White on teal | `#FFFFFF` | `#0F766E` (Deep Teal) | 4.6:1 | 4.5:1 âœ“ |
| Muted text | `#6B7280` | `#F8F6F2` | 4.6:1 | 4.5:1 âœ“ |
| Muted text (dark mode) | `#94A3B8` | `#0F1A19` | 7.2:1 | 4.5:1 âœ“ |

**Rule**: If any brand color combination fails 4.5:1, use dark text on that background instead of white. Verified above: amber buttons must use dark text at body-text sizes.

### 1.4 Focus Indicators

```css
/* Global focus style â€” visible, high-contrast, not reliant on color alone */
:focus-visible {
  outline: 3px solid #D97706;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Dark mode */
[data-theme="dark"] :focus-visible {
  outline-color: #FBBF24;
}
```

- Never remove focus outlines (`outline: none` is banned unless replaced with equivalent visible indicator)
- Focus indicators must be visible against both light and dark backgrounds
- Tab order follows visual reading order (left-to-right, top-to-bottom)

### 1.5 Keyboard Navigation Map

| Page | Expected Tab Order |
|------|-------------------|
| **Homepage** | Skip-to-content â†’ Logo (home link) â†’ Nav items â†’ Hero CTA â†’ Featured campaign cards â†’ Campaign CTAs â†’ Blog preview cards â†’ Footer links |
| **Campaign Page** | Skip-to-content â†’ Nav â†’ Campaign title â†’ Progress bar (ARIA live region) â†’ Donate button â†’ Story content â†’ Recent donors (ARIA live region) â†’ Updates â†’ Footer |
| **Donate Flow** | Amount presets (radio group) â†’ Custom amount input â†’ Payment form (Stripe Elements handles internal keyboard) â†’ Submit button |
| **Blog Post** | Skip-to-content â†’ Nav â†’ Article title â†’ Article body â†’ Related posts â†’ Footer |

### 1.6 ARIA Requirements

| Component | ARIA Pattern |
|-----------|-------------|
| Progress bar (campaign funding) | `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Campaign funding progress"` |
| Donation amount selector | `role="radiogroup"`, each option `role="radio"` |
| Mobile nav menu | `aria-expanded`, `aria-controls`, menu items have `role="menuitem"` |
| Real-time donor feed | `aria-live="polite"`, `aria-atomic="false"` (announces new donors without interrupting) |
| Phase badges | `aria-label` with full description (e.g., `aria-label="Campaign phase: Closing In, 75% funded"`) |
| Toast notifications | `role="alert"`, `aria-live="assertive"` |
| Modals/dialogs | `role="dialog"`, `aria-modal="true"`, focus trapped inside, Escape to close |

### 1.7 Screen Reader Testing Matrix

| Screen Reader | Browser | OS | Test Frequency |
|--------------|---------|-----|:---:|
| **NVDA** | Chrome | Windows | Every release |
| **JAWS** | Chrome | Windows | Monthly |
| **VoiceOver** | Safari | macOS | Every release |
| **VoiceOver** | Safari | iOS | Every release |
| **TalkBack** | Chrome | Android | Monthly |

**Minimum**: NVDA + VoiceOver (macOS + iOS) every release. JAWS and TalkBack monthly.

### 1.8 Testing Tools

| Tool | Stage | Purpose |
|------|-------|---------|
| **axe-core** (via `@axe-core/playwright`) | CI/CD | Automated accessibility checks on every PR |
| **Lighthouse** | CI/CD + manual | Accessibility audit score (target: 100) |
| **eslint-plugin-jsx-a11y** | Development | Catch a11y issues in JSX at lint time |
| **Manual screen reader** | Pre-release | Verify real screen reader experience |
| **Keyboard-only testing** | Pre-release | Navigate entire flow without mouse |

### 1.9 CI Gate

```
Accessibility score < 95 on any page â†’ build fails.
Any axe-core critical/serious violation â†’ build fails.
```

---

## 2. Performance Budgets

### 2.1 Core Web Vitals Targets

| Metric | Target | Maximum Acceptable | Measured On |
|--------|:-----:|:---:|-------------|
| **Largest Contentful Paint (LCP)** | < 1.5s | 2.5s | Homepage, campaign pages on 4G mobile |
| **Interaction to Next Paint (INP)** | < 100ms | 200ms | Campaign page interactions (donate button, amount selection) |
| **Cumulative Layout Shift (CLS)** | < 0.05 | 0.1 | All pages, especially campaign pages with dynamic donor feeds |
| **First Contentful Paint (FCP)** | < 1.0s | 1.8s | All pages |
| **Time to First Byte (TTFB)** | < 200ms | 600ms | All pages (Vercel edge) |

### 2.2 Page Weight Budgets

| Resource Type | Budget Per Page | Notes |
|--------------|:---:|-------|
| **HTML** | < 50 KB | Compressed. Server-rendered content. |
| **CSS** | < 50 KB | Compressed. Tailwind purge removes unused. |
| **JavaScript (total)** | < 170 KB | Compressed. Code-split per route. |
| **JavaScript (first-party)** | < 90 KB | Our code + shadcn/ui components, compressed. |
| **JavaScript (third-party)** | < 80 KB | Stripe.js (~40KB), Framer Motion (~30KB on complex pages), analytics, Sentry. |
| **Images** | < 400 KB | Per page. Critical images optimized. |
| **Fonts** | < 80 KB | 3 font families, subset to latin characters. |
| **Total page weight** | < 700 KB | Initial load, compressed. |

### 2.3 JavaScript Bundle Budget

| Bundle | Max Size (gzipped) | Contents |
|--------|:---:|---------|
| **Framework chunk** | 45 KB | React, Next.js runtime |
| **Main app chunk** | 30 KB | Layout, nav, footer, shared components |
| **Campaign page** | 35 KB | Campaign UI, Framer Motion progress bar + number counters, real-time donor feed |
| **Donate flow** | 20 KB + Stripe.js | shadcn/ui form components, React Hook Form + Zod validation, Sonner toasts |
| **Blog page** | 10 KB | Article renderer, share buttons |
| **Admin dashboard** | 50 KB | (lazy loaded, not in critical path) |
| **Stripe.js** | ~40 KB | External, loaded only on pages with payment |

**Enforcement**: `@next/bundle-analyzer` run in CI. Alert if any chunk grows > 10% beyond budget.

### 2.4 Image Strategy

| Context | Format | Max Dimensions | Max File Size | Loading |
|---------|--------|:---:|:---:|---------|
| Campaign hero | WebP (AVIF where supported) | 1200Ã-675 | 80 KB | `priority` (LCP element) |
| Campaign card thumbnail | WebP | 600Ã-338 | 30 KB | `lazy` |
| Blog post header | WebP | 1200Ã-675 | 80 KB | `priority` on first post, `lazy` on listings |
| Blog inline images | WebP | 800Ã-600 | 50 KB | `lazy` |
| Profile avatars | WebP | 96Ã-96 | 10 KB | `lazy` |
| Logo | SVG | N/A | < 5 KB | Inline |

**Implementation**:
```tsx
// Next.js Image component handles format negotiation, resizing, lazy loading
<Image
  src={campaign.heroImage}
  alt={campaign.heroAlt}
  width={1200}
  height={675}
  priority={isAboveFold}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
/>
```

- All DVIDS-sourced images processed through Next.js Image Optimization
- AVIF served to supporting browsers, WebP fallback, JPEG last resort (automatic)
- `sizes` attribute on every image to prevent downloading oversized images on mobile
- Placeholder: `blur` with low-quality inline base64 preview (prevents CLS)

### 2.5 Font Strategy

| Font | Weight(s) | Format | Size (subset) | Usage |
|------|-----------|--------|:---:|-------|
| DM Serif Display | 400 (Regular) | WOFF2 | ~20 KB | Headlines only |
| DM Sans | 400, 500, 600 | WOFF2, variable | ~28 KB | Body text, UI |
| DM Mono | 400 | WOFF2 | ~15 KB | Stats, numbers |

**Loading Strategy**:
```css
/* Font display swap â€” show fallback immediately, swap when loaded */
@font-face {
  font-family: 'DM Serif Display';
  font-display: swap;
  /* ... */
}
```

- Self-host all fonts (no Google Fonts CDN â€” privacy + performance)
- Subset to Latin characters only (saves ~40% file size)
- Preload critical font (DM Sans 400) in `<head>`
- `font-display: swap` on all fonts to prevent invisible text

```html
<link rel="preload" href="/fonts/dm-sans-latin-400.woff2" as="font" type="font/woff2" crossorigin />
```
```

### 2.6 Caching Strategy

| Resource | Cache-Control | CDN Cache | Notes |
|----------|:---:|:---:|-------|
| Static assets (JS, CSS, fonts) | `public, max-age=31536000, immutable` | Yes | Content-hashed filenames (Next.js default) |
| Images (Next.js optimized) | `public, max-age=86400, s-maxage=2592000` | Yes | 30-day CDN, 1-day browser |
| HTML (SSG pages) | `s-maxage=3600, stale-while-revalidate=86400` | Yes | 1-hour CDN, ISR revalidates |
| HTML (SSR pages) | `s-maxage=60, stale-while-revalidate=600` | Yes | 1-minute CDN, 10-minute stale |
| API responses | `no-store` or short `s-maxage` | Varies | Campaign data: 60s. Donation endpoint: no-store. |
| `/api/v1/stats` | `s-maxage=300, stale-while-revalidate=600` | Yes | 5-minute cache, acceptable staleness for global stats |

### 2.7 Third-Party Script Management

| Script | Load Strategy | Page(s) | Impact |
|--------|:---:|---------|:---:|
| **Stripe.js** | `async`, loaded only on donate pages | Campaign page, standalone donate page | ~40 KB gzip |
| **Plausible** | `defer`, `data-domain` attribute | All pages | ~1 KB gzip |
| **Sentry** | Lazy-loaded after page interactive | All pages | ~15 KB gzip (with tree-shaking) |

**Rules**:
- No third-party script loaded synchronously in `<head>` (except font preload)
- Stripe.js loaded only when donate form is in viewport or user scrolls near it
- Plausible is tiny and deferred â€” acceptable on all pages
- Sentry loaded after `onLoad` event via dynamic import
- No Google Analytics, no Facebook Pixel, no tracking scripts (brand promise: privacy-first)

---

## 3. Performance Monitoring

### 3.1 Lab Testing (Pre-Deploy)

| Tool | Integration | Runs When | Fail Threshold |
|------|------------|-----------|:---:|
| **Lighthouse CI** | GitHub Actions | Every PR | Performance < 90, Accessibility < 95, Best Practices < 90, SEO < 90 |
| **Bundlewatch** | GitHub Actions | Every PR | Any bundle exceeds budget by > 5% |
| **`@next/bundle-analyzer`** | Manual / CI | On request | Visual review of bundle composition |

### 3.2 Field Monitoring (Post-Deploy)

| Tool | What It Measures | Alert Threshold |
|------|-----------------|:---:|
| **Vercel Analytics** (Real User) | LCP, INP, CLS, FCP, TTFB from real visitors | LCP p75 > 2.5s, CLS p75 > 0.1 |
| **Plausible** | Page load time (aggregate) | Manual weekly review |
| **Sentry Performance** | Transaction duration, slow API routes | API p95 > 1s |

### 3.3 Performance Review Cadence

| Frequency | Action |
|-----------|--------|
| **Every PR** | Lighthouse CI + Bundlewatch automated checks |
| **Weekly** | Review Vercel Analytics dashboard. Note any regression. |
| **Monthly** | Full Core Web Vitals report. Compare to previous month. Bundle audit. |
| **Quarterly** | Third-party script audit. Font subset review. Image pipeline review. |

---

## 4. Responsive Design Requirements

### 4.1 Breakpoints

| Name | Width | Target |
|------|:---:|--------|
| **Mobile** | 0â€“639px | Phones (portrait) |
| **Tablet** | 640â€“1023px | Tablets, phones (landscape) |
| **Desktop** | 1024â€“1279px | Laptops, small desktops |
| **Wide** | 1280px+ | Large monitors |

(Uses Tailwind's default breakpoints: `sm:640`, `md:768`, `lg:1024`, `xl:1280`, `2xl:1536`)

### 4.2 Mobile-First Design Rules

- All CSS written mobile-first (base styles = mobile, `sm:` and up for larger)
- Touch targets: minimum 44Ã-44px
- No horizontal scrolling on any screen width
- Donate buttons always visible without scrolling on campaign pages
- Campaign progress bar readable at 320px width
- Navigation: hamburger menu on mobile, full nav on desktop
- Font sizes: minimum 16px body text on mobile (prevents iOS zoom)

### 4.3 Device Testing Matrix

| Device | Screen Size | Priority |
|--------|:---:|:---:|
| iPhone 14 / 15 | 390Ã-844 | P0 â€” must work perfectly |
| iPhone SE (3rd gen) | 375Ã-667 | P0 â€” smallest common phone |
| Samsung Galaxy S23 | 360Ã-780 | P0 â€” top Android device |
| iPad (10th gen) | 820Ã-1180 | P1 |
| MacBook Air 13" | 1440Ã-900 | P0 |
| Generic 1920Ã-1080 | 1920Ã-1080 | P0 â€” most common desktop |
| 4K display | 3840Ã-2160 | P2 â€” should be tested quarterly |

---

## 5. SEO Performance

### 5.1 Technical SEO Checklist

| Requirement | Implementation |
|-------------|---------------|
| Server-rendered HTML | Next.js SSR/SSG â€” all content in initial HTML response |
| Semantic heading hierarchy | One `<h1>` per page, proper nesting |
| Meta tags | `<title>`, `<meta name="description">` on every page, unique per page |
| Open Graph + Twitter Card | `og:title`, `og:description`, `og:image`, `twitter:card` on every page |
| Canonical URLs | `<link rel="canonical">` on every page |
| Sitemap | Auto-generated at `/sitemap.xml` via Next.js `sitemap.ts` |
| robots.txt | Allow all public pages, disallow `/admin/*`, `/api/*` |
| Structured data (JSON-LD) | `Nonprofit Organization` schema on homepage, `Article` on blog posts, `DonateAction` on campaign pages |
| 301 redirects | Configured in `next.config.ts` redirects for any URL changes |
| 404 page | Custom, helpful, includes search and popular campaign links |
| Page speed | LCP < 2.5s â€” a ranking factor |
| Mobile-friendly | Passes Google Mobile-Friendly Test |
| HTTPS | Enforced everywhere |

### 5.2 Dynamic OG Images

```
GET /api/og?title=...&raised=...&goal=...&phase=...
```

- Generated via `@vercel/og` (Satori)
- Campaign-specific OG images with progress bar, phase badge, and campaign title
- Cached at CDN level for 24 hours
- Used in `<meta property="og:image">` on campaign pages

---

## 6. Offline & Low-Connectivity Handling

### 6.1 Progressive Enhancement

| Scenario | Behavior |
|----------|---------|
| **JavaScript disabled** | All content visible (SSR). Donate form shows message: "JavaScript is required to make a donation." Links, navigation, content all functional. |
| **Slow connection (2G/3G)** | Critical CSS inlined. Hero image has blur placeholder. Non-critical images lazy-loaded. Stripe.js loads only when needed. |
| **Offline** | Static pages served from browser cache if previously visited. Donate form shows "You appear to be offline" with gentle message. |
| **Flaky connection** | Donation submission retried automatically (Stripe handles this). Toast notification for connection issues. |

### 6.2 Service Worker

Not in MVP scope. Evaluate for Phase 2 if:
- Repeat visitor rate > 30%
- Significant mobile traffic from areas with poor connectivity
- Push notification feature requested

---

## 7. Internationalization (Future)

Not in MVP scope. However, build with i18n readiness:

- All user-facing strings in a constants file (not hardcoded in JSX)
- Date formatting via `Intl.DateTimeFormat` (not manual string formatting)
- Currency formatting via `Intl.NumberFormat` (not manual `$` + `toFixed()`)
- `lang="en"` on `<html>` element
- No text embedded in images

This allows future i18n adoption without a rewrite.

---

## 8. Pre-Launch Audit Checklist

### Accessibility

- [ ] Lighthouse Accessibility score = 100 on homepage, campaign page, donate flow, blog
- [ ] axe-core: zero critical/serious violations
- [ ] Full keyboard navigation test (all pages, no traps)
- [ ] Screen reader test with NVDA (Windows) â€” full donate flow
- [ ] Screen reader test with VoiceOver (macOS + iOS) â€” full donate flow
- [ ] Color contrast verified for all text/background combinations (both themes)
- [ ] All images have appropriate alt text
- [ ] All form fields have labels
- [ ] Skip-to-content link works on every page
- [ ] Focus indicators visible on every interactive element
- [ ] No ARIA misuse (validated with axe)
- [ ] Touch targets â‰¥ 44Ã-44px on mobile

### Performance

- [ ] Lighthouse Performance score â‰¥ 90 on mobile (throttled 4G)
- [ ] LCP < 2.5s on campaign page (mobile, 4G)
- [ ] CLS < 0.1 on all pages
- [ ] INP < 200ms on campaign page
- [ ] Total page weight < 700 KB (compressed) on homepage
- [ ] JavaScript bundle within budget
- [ ] Images optimized and serving WebP/AVIF
- [ ] Fonts self-hosted with swap display and preloaded
- [ ] No render-blocking third-party scripts
- [ ] Caching headers correct on all resource types

### SEO

- [ ] Unique `<title>` and `<meta description>` on every page
- [ ] OG images generating correctly for all campaigns
- [ ] Sitemap.xml present and valid
- [ ] robots.txt present and correct
- [ ] JSON-LD structured data on homepage, campaigns, and blog posts
- [ ] Canonical URLs set
- [ ] Google Search Console configured
- [ ] No mixed content warnings
