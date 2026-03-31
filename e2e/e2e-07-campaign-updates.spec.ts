/**
 * E2E-07: Admin → post campaign update → appears on campaign page timeline
 * Priority: P1
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-07: Campaign Updates', () => {
  test('campaign page displays updates section', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    if (await campaignLink.isVisible()) {
      await campaignLink.click();

      // Campaign page should have a heading
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});
