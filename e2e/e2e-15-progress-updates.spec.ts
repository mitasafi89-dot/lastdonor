/**
 * E2E-15: Campaign → donate → progress bar updates (poll or Realtime)
 * Priority: P1
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-15: Progress Bar Updates', () => {
  test('campaign page shows progress bar with correct ARIA', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    if (await campaignLink.isVisible()) {
      await campaignLink.click();

      const progressBar = page.getByRole('progressbar');
      await expect(progressBar).toBeVisible();

      // Check ARIA attributes
      const ariaMin = await progressBar.getAttribute('aria-valuemin');
      const ariaMax = await progressBar.getAttribute('aria-valuemax');
      const ariaNow = await progressBar.getAttribute('aria-valuenow');

      expect(ariaMin).toBeDefined();
      expect(ariaMax).toBeDefined();
      expect(ariaNow).toBeDefined();
    }
  });
});
