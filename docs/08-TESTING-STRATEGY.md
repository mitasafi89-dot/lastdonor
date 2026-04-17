# LastDonor.org - Testing Strategy

**Document ID**: LD-TEST-001
**Version**: 0.1
**Date**: March 19, 2026
**Status**: Draft
**Classification**: Internal
**Owner**: Engineering Lead

---

## 1. Testing Philosophy

1. **Tests are a first-class deliverable.** Untested code does not ship.
2. **Test behavior, not implementation.** Tests should survive refactors.
3. **Fast feedback loops.** Unit tests run in < 10 seconds locally. Full suite in < 5 minutes in CI.
4. **Financial code has zero tolerance for bugs.** Every path through donation processing is tested.
5. **Tests document intent.** A test file is the source of truth for how a feature should behave.

---

## 2. Test Pyramid

```
                    ╱╲
                   ╱  ╲          E2E Tests
                  ╱ 10 ╲         (Playwright)
                 ╱──────╲        Critical user journeys
                ╱        ╲
               ╱   20     ╲     Integration Tests
              ╱────────────╲    (Vitest + test DB)
             ╱              ╲   API routes, DB queries, Stripe webhooks
            ╱                ╲
           ╱       70         ╲  Unit Tests
          ╱────────────────────╲ (Vitest)
                                 Components, utilities, business logic
```

| Layer | Tool | Count Target (MVP) | Run Time Target |
|-------|------|:---:|:---:|
| **Unit** | Vitest + React Testing Library | 200+ tests | < 15 seconds |
| **Integration** | Vitest + Supabase test instance | 50+ tests | < 2 minutes |
| **E2E** | Playwright | 15-20 flows | < 5 minutes |

---

## 3. Unit Tests

### 3.1 What Unit Tests Cover

| Category | Examples |
|----------|---------|
| **Business logic** | Phase calculation (0-25% = first_believers, etc.), donation amount validation, campaign status transitions, progress percentage computation |
| **Utility functions** | Currency formatting (cents → display), slug generation, date formatting, input sanitization |
| **React components** | Campaign card renders correctly, progress bar shows correct width, donation form validates inputs, phase badge displays correct label |
| **State management** | Campaign list filtering, donation form state, dark mode toggle, newsletter signup state |
| **Data transformations** | API response → component props, RSS feed parsing, Stripe event → donation record |

### 3.2 Unit Test Standards

```typescript
// File naming: [module].test.ts or [component].test.tsx
// Co-located with source: src/utils/currency.ts → src/utils/currency.test.ts

// Example: Phase calculation
describe('getCampaignPhase', () => {
  it('returns first_believers when 0-25% funded', () => {
    expect(getCampaignPhase(0)).toBe('first_believers');
    expect(getCampaignPhase(10)).toBe('first_believers');
    expect(getCampaignPhase(25)).toBe('first_believers');
  });

  it('returns the_push when 26-60% funded', () => {
    expect(getCampaignPhase(26)).toBe('the_push');
    expect(getCampaignPhase(60)).toBe('the_push');
  });

  it('returns closing_in when 61-90% funded', () => {
    expect(getCampaignPhase(61)).toBe('closing_in');
    expect(getCampaignPhase(90)).toBe('closing_in');
  });

  it('returns last_donor_zone when 91-100% funded', () => {
    expect(getCampaignPhase(91)).toBe('last_donor_zone');
    expect(getCampaignPhase(100)).toBe('last_donor_zone');
  });

  it('handles edge case: negative percentage', () => {
    expect(getCampaignPhase(-1)).toBe('first_believers');
  });

  it('handles edge case: over 100%', () => {
    expect(getCampaignPhase(105)).toBe('last_donor_zone');
  });
});
```

### 3.3 Component Testing Rules

- Use React Testing Library. Query by role, label, text - not by class name or test ID (unless necessary).
- Test what the user sees, not internal state.
- Mock API calls with MSW (Mock Service Worker) - not by stubbing fetch.
- Snapshot tests only for static components (logo, footer). Never for dynamic components.

---

## 4. Integration Tests

### 4.1 What Integration Tests Cover

| Category | What's Tested |
|----------|--------------|
| **API routes** | Full request → response cycle including auth, validation, DB operations, response format |
| **Stripe webhook processing** | Receive webhook → verify signature → create donation → update campaign → check goal completion |
| **Database operations** | Campaign CRUD, donation recording, user management, audit log writing |
| **Auth flows** | Registration → email verification → login → session → role-based access |
| **Newsletter** | Subscribe → duplicate handling → unsubscribe token generation → unsubscribe |
| **Campaign lifecycle** | Draft → active → last_donor_zone (auto-transition at 90%) → completed (auto-transition at 100%) |

### 4.2 Test Database Strategy

- **Separate test database** on Supabase (not production, not development).
- **Migrations run before test suite** - test DB always matches production schema.
- **Each test file gets a clean state** - truncate tables in `beforeEach` or use transactions that roll back.
- **Seed data** - standardized test fixtures:

```typescript
// test/fixtures/campaigns.ts
export const testCampaigns = {
  active: {
    id: 'test-campaign-active',
    title: 'Test Active Campaign',
    slug: 'test-active',
    status: 'active',
    goalAmount: 3000000,  // $30,000
    raisedAmount: 1500000, // $15,000 (50%)
    donorCount: 150,
    // ... full campaign object
  },
  lastDonorZone: {
    id: 'test-campaign-ldz',
    // ... 92% funded
  },
  almostComplete: {
    id: 'test-campaign-almost',
    // ... $50 away from goal
  },
  completed: {
    id: 'test-campaign-done',
    status: 'completed',
    // ...
  },
  draft: {
    id: 'test-campaign-draft',
    status: 'draft',
    // ...
  }
};
```

### 4.3 Stripe Integration Testing

Stripe provides a test mode with predictable card numbers. Integration tests use Stripe test mode exclusively.

| Test Scenario | Stripe Test Card | Expected Outcome |
|---------------|-----------------|------------------|
| Successful donation | `4242424242424242` | PaymentIntent succeeds, donation recorded |
| Card declined | `4000000000000002` | PaymentIntent fails, no donation recorded |
| Insufficient funds | `4000000000009995` | PaymentIntent fails, error returned |
| Recurring donation setup | `4242424242424242` + subscription | Subscription created, first invoice paid |
| Refund | Refund on successful charge | Donation marked refunded, campaign amount decremented |
| Webhook signature invalid | Tampered payload | HTTP 400, no database changes |
| Webhook duplicate event | Same event ID twice | Second event ignored (idempotent) |

### 4.4 Critical Path: Donation → Last Donor Detection

This flow has **100% test coverage**. No exceptions.

```
Test: "When a donation causes campaign to reach goal"

Setup:
  - Campaign with goal $30,000, raised $29,960 ($40 remaining)
  
Action:
  - Process webhook for $50 donation

Assertions:
  1. Donation record created with correct amount
  2. Campaign raisedAmount updated to $30,010
  3. Campaign status changed to 'completed'
  4. Campaign completedAt timestamp set
  5. Campaign lastDonorId set to the donor's user ID (or null for guest)
  6. Donor receives "Last Donor" badge (if registered)
  7. Receipt email triggered with "You're the last donor!" messaging
  8. Excess $10 handled per policy (documented, rolled to general fund)
  9. Audit log entry created for campaign completion
  10. Campaign page revalidation triggered (ISR)
```

---

## 5. End-to-End Tests (Playwright)

### 5.1 Critical User Journeys

Every E2E test simulates a real user in a real browser.

| Test ID | Journey | Priority |
|---------|---------|:---:|
| **E2E-01** | Homepage loads → view active campaigns → click campaign → read story → donate $50 → see confirmation | P0 |
| **E2E-02** | Campaign page → donate as guest → verify receipt email content | P0 |
| **E2E-03** | Campaign in Last Donor Zone → donate exact remaining amount → campaign shows completed → Last Donor celebrated | P0 |
| **E2E-04** | Register account → login → view profile → see donation history → see badges | P1 |
| **E2E-05** | Homepage → subscribe to newsletter → verify confirmation | P1 |
| **E2E-06** | Admin login → create campaign → publish → verify it appears on homepage | P1 |
| **E2E-07** | Admin login → post campaign update → verify it appears on campaign page | P1 |
| **E2E-08** | Mobile viewport → homepage → campaign → donate (responsive test) | P0 |
| **E2E-09** | Dark mode toggle → verify all pages render correctly in dark mode | P2 |
| **E2E-10** | Blog listing → read post → navigate back → verify pagination | P2 |
| **E2E-11** | Campaign share button → verify OpenGraph meta tags present | P2 |
| **E2E-12** | Accessibility: keyboard-only navigation through donation flow | P1 |
| **E2E-13** | Admin → view news feed → click "Create Campaign" from news item | P2 |
| **E2E-14** | Donor profile → Last Donor Wall → verify completed campaign donors listed | P2 |
| **E2E-15** | Campaign page → progress bar updates after donation (via polling or WS) | P1 |

### 5.2 E2E Test Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
  ],
});
```

### 5.3 Visual Regression Testing

- Use Playwright's screenshot comparison for key pages:
  - Homepage (light + dark mode)
  - Campaign page (each phase: first_believers, the_push, closing_in, last_donor_zone, completed)
  - Donation form (empty, filled, error states)
  - Mobile variants of above
- Threshold: 0.1% pixel difference tolerance
- Baseline screenshots committed to repo, updated intentionally

---

## 6. Financial Integrity Tests

Donation processing is treated like banking software. These tests run on every CI build.

### 6.1 Invariants That Must Always Hold

```
INVARIANT 1: campaign.raisedAmount == SUM(donations.amount) WHERE campaign_id = campaign.id AND status != 'refunded'
→ Tested by: Reconciliation test that creates N random donations, sums them, and compares to campaign total.

INVARIANT 2: campaign.donorCount == COUNT(donations) WHERE campaign_id = campaign.id AND status != 'refunded'
→ Tested by: Same reconciliation test.

INVARIANT 3: campaign.status == 'completed' IFF campaign.raisedAmount >= campaign.goalAmount
→ Tested by: State machine test covering all transitions.

INVARIANT 4: campaign.lastDonorId IS NOT NULL IFF campaign.status == 'completed'
→ Tested by: Completion flow test.

INVARIANT 5: No donation.amount < 500 (minimum $5.00)
→ Tested by: Validation test on create-intent endpoint + DB constraint.

INVARIANT 6: Every donation has a corresponding Stripe payment record
→ Tested by: Integration test verifying Stripe charge exists for every DB donation.
```

### 6.2 Concurrency Tests

```
SCENARIO: Two donors submit the final donation at the same time

Setup:
  - Campaign needs $50 more to complete
  - Donor A submits $50
  - Donor B submits $50 (near-simultaneously)

Expected:
  - Both donations are recorded
  - Campaign total = original + $100 (overfunded by $50)
  - Campaign status = completed
  - Only ONE donor is marked as lastDonorId (the one whose webhook processed first)
  - No race condition on raised_amount (use atomic UPDATE ... SET raised_amount = raised_amount + $amount)
```

---

## 7. Performance / Load Testing

### 7.1 Load Scenarios

| Scenario | Tool | Target |
|----------|------|--------|
| Homepage under load | k6 | 500 concurrent users, < 2s TTFB, 0% error rate |
| Campaign page under load | k6 | 200 concurrent users, < 2s TTFB, 0% error rate |
| Donation flow under load | k6 | 50 concurrent donation intents, < 3s response, 0% error rate |
| Webhook burst | k6 | 100 webhooks in 10 seconds, all processed, 0 data loss |
| API rate limiting | k6 | Verify 429 returned after limit exceeded, no bypass |

### 7.2 When Load Tests Run

- **Not in CI** - too slow and requires infrastructure.
- **Before launch**: Full load test against staging environment.
- **Before any major campaign launch**: Verify capacity for expected traffic spike.
- **Quarterly**: Regression check.

---

## 8. CI/CD Test Pipeline

```
PULL REQUEST OPENED
        │
        ▼
┌─────────────────────────┐
│  Stage 1: Static Checks │  (~30 seconds)
│  ├── ESLint              │
│  ├── TypeScript (tsc)    │
│  └── Prettier check      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Stage 2: Unit Tests    │  (~15 seconds)
│  └── Vitest (unit only) │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Stage 3: Integration   │  (~2 minutes)
│  ├── Vitest (integration)│
│  └── Stripe test mode    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Stage 4: Build         │  (~1 minute)
│  └── next build          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Stage 5: E2E           │  (~5 minutes)
│  └── Playwright          │
│      (against preview)   │
└────────────┬────────────┘
             │
             ▼
    ALL PASS → Ready for review
    ANY FAIL → Block merge
```

### Stage Gating

- **Stage 1-2 failing** blocks Stage 3+. No point running expensive tests on broken code.
- **Stage 3 (integration) failure** is a merge blocker. Financial code must pass.
- **Stage 5 (E2E) failure** on P0 tests is a merge blocker. P2 failures create a ticket but don't block.

---

## 9. Coverage Targets

| Category | Coverage Target | Enforcement |
|----------|:---:|:---:|
| Business logic (utils, lib) | 90% | CI fails if below |
| API routes | 85% | CI fails if below |
| React components | 70% | CI warns if below |
| Financial / donation code | 100% | CI fails if below |
| Overall | 80% | CI warns if below |

Coverage is measured by Vitest's built-in Istanbul reporter. Coverage reports uploaded to CI artifacts.

**Coverage is a floor, not a ceiling.** High coverage with bad tests is worse than moderate coverage with meaningful tests. Review test quality in code review, not just coverage numbers.

---

## 10. Test Data Management

### 10.1 Rules

1. **Never use production data in tests.** All test data is synthetic.
2. **No hardcoded IDs** that reference real Stripe, Supabase, or user records.
3. **Factories over fixtures** for dynamic data. Use a `createTestCampaign()` factory that generates valid data with overrides.
4. **Clean up after each test.** No test should depend on another test's state.

### 10.2 Test Factory Example

```typescript
// test/factories/campaign.ts
export function createTestCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: randomUUID(),
    title: 'Test Campaign',
    slug: `test-${randomUUID().slice(0, 8)}`,
    status: 'active',
    goalAmount: 3000000,
    raisedAmount: 0,
    donorCount: 0,
    category: 'military',
    heroImageUrl: 'https://example.com/test.webp',
    subjectName: 'Test Subject',
    storyHtml: '<p>Test story</p>',
    publishedAt: new Date(),
    ...overrides,
  };
}
```

---

## 11. Manual Testing Checklist (Pre-Release)

For major releases, in addition to automated tests:

- [ ] Complete donation flow on real device (iPhone + Android)
- [ ] Verify Stripe receipt email received and formatted correctly
- [ ] Test with screen reader (VoiceOver on macOS, NVDA on Windows)
- [ ] Verify dark mode on all key pages
- [ ] Test with slow 3G network throttling (Chrome DevTools)
- [ ] Verify OpenGraph share cards render on Facebook, X, LinkedIn (use debug tools)
- [ ] Test campaign at each phase visually (progress bar, badges, CTAs)
- [ ] Admin: create campaign → publish → verify public visibility
- [ ] Admin: post update → verify appears on campaign page
- [ ] Verify 404 page works and is styled
- [ ] Verify robots.txt and sitemap.xml are correct
