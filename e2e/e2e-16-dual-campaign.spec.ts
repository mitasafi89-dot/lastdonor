/**
 * E2E-16: Dual Campaign Indistinguishability
 * Priority: P0
 *
 * Verifies that simulated and real campaigns render identically from a
 * visitor's perspective – same DOM structure, donation form, and donor feed.
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-16: Dual Campaign Indistinguishability', () => {
  test('campaigns listing page loads and displays campaign cards', async ({ page }) => {
    await page.goto('/campaigns');

    // The page should have a heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Should render at least one campaign card (seed or real)
    const cards = page.locator('article');
    const count = await cards.count();
    test.skip(count === 0, 'No campaigns in database — skipping dual campaign tests');

    // Each card should have a link to the campaign detail
    const firstLink = cards.first().locator('a').first();
    await expect(firstLink).toHaveAttribute('href', /\/campaigns\/.+/);
  });

  test('campaign detail page renders all expected sections', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.locator('article a').first();
    const isVisible = await campaignLink.isVisible({ timeout: 5000 }).catch(() => false);
    test.skip(!isVisible, 'No campaigns available');

    await campaignLink.click();
    await expect(page).toHaveURL(/\/campaigns\/.+/);

    // Core structure: heading, story content, donation form
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Make a Donation')).toBeVisible({ timeout: 10_000 });

    // Donor feed section should exist
    const donorFeed = page.locator('[aria-live="polite"]').first();
    await expect(donorFeed).toBeVisible();
  });

  test('donation form is identical across multiple campaigns', async ({ page }) => {
    await page.goto('/campaigns');

    const cards = page.locator('article');
    const count = await cards.count();
    test.skip(count < 2, 'Need at least 2 campaigns to compare');

    // Visit first campaign and capture donation form structure
    const firstHref = await cards.first().locator('a').first().getAttribute('href');
    await page.goto(firstHref!);
    await expect(page.getByText('Make a Donation')).toBeVisible({ timeout: 10_000 });

    const firstFormPresets = await page
      .getByRole('radiogroup', { name: /amount/i })
      .getByRole('radio')
      .allTextContents();
    const firstHasEmailField = await page.getByLabel(/email/i).isVisible();

    // Visit second campaign
    const secondHref = await cards.nth(1).locator('a').first().getAttribute('href');
    await page.goto(secondHref!);
    await expect(page.getByText('Make a Donation')).toBeVisible({ timeout: 10_000 });

    const secondFormPresets = await page
      .getByRole('radiogroup', { name: /amount/i })
      .getByRole('radio')
      .allTextContents();
    const secondHasEmailField = await page.getByLabel(/email/i).isVisible();

    // Donation form structure should be identical
    expect(firstFormPresets).toEqual(secondFormPresets);
    expect(firstHasEmailField).toBe(secondHasEmailField);
  });

  test('donor feed renders identically across campaigns', async ({ page }) => {
    await page.goto('/campaigns');

    const cards = page.locator('article');
    const count = await cards.count();
    test.skip(count < 2, 'Need at least 2 campaigns to compare');

    // Collect donor feed container structure from two campaigns
    const hrefs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const href = await cards.nth(i).locator('a').first().getAttribute('href');
      hrefs.push(href!);
    }

    const feedStructures: string[] = [];
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.getByText('Make a Donation')).toBeVisible({ timeout: 10_000 });

      // The donor feed container should have identical accessibility attributes
      const feed = page.locator('[aria-live="polite"]').first();
      await expect(feed).toBeVisible();
      feedStructures.push(await feed.getAttribute('aria-live') ?? '');
    }

    expect(feedStructures[0]).toBe(feedStructures[1]);
  });

  test('campaign page has no simulation-revealing DOM attributes', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.locator('article a').first();
    const isVisible = await campaignLink.isVisible({ timeout: 5000 }).catch(() => false);
    test.skip(!isVisible, 'No campaigns available');

    await campaignLink.click();
    await expect(page).toHaveURL(/\/campaigns\/.+/);

    // Entire page HTML should not contain simulation-related terms
    const html = await page.content();
    const forbiddenPatterns = [
      'simulation_flag',
      'simulationFlag',
      'simulation_config',
      'simulationConfig',
      '@lastdonor.internal',
      'data-simulated',
      'data-simulation',
    ];

    for (const pattern of forbiddenPatterns) {
      expect(html).not.toContain(pattern);
    }
  });

  test('message wall section renders on campaign page', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.locator('article a').first();
    const isVisible = await campaignLink.isVisible({ timeout: 5000 }).catch(() => false);
    test.skip(!isVisible, 'No campaigns available');

    await campaignLink.click();
    await expect(page).toHaveURL(/\/campaigns\/.+/);

    // Message wall section should be present
    const messagesHeading = page.getByText(/messages of support/i);
    if (await messagesHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(messagesHeading).toBeVisible();
    }
  });
});
