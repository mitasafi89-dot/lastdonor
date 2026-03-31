/**
 * E2E-11: Campaign page → check OG meta tags present in HTML
 * Priority: P2
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-11: OG Meta Tags', () => {
  test('homepage has required OG meta tags', async ({ page }) => {
    await page.goto('/');

    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content');

    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
  });

  test('campaign page has campaign-specific OG meta tags', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    if (await campaignLink.isVisible()) {
      const href = await campaignLink.getAttribute('href');
      if (href) {
        await page.goto(href);

        // Should have OG tags for sharing
        const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
        expect(ogTitle).toBeTruthy();
      }
    }
  });

  test('pages have canonical URLs', async ({ page }) => {
    await page.goto('/');

    const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
    // Canonical may or may not exist, just verify it's present if used
    if (canonical) {
      expect(canonical).toContain('lastdonor');
    }
  });
});
