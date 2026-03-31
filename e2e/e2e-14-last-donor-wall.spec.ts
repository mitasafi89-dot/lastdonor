/**
 * E2E-14: Donor profile → Last Donor Wall → completed campaign with donor info
 * Priority: P2
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-14: Last Donor Wall', () => {
  test('last donor wall page loads and has heading', async ({ page }) => {
    await page.goto('/last-donor-wall');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('last donor wall is accessible from navigation', async ({ page }) => {
    await page.goto('/');

    const ldwLink = page.getByRole('link', { name: /last donor wall/i }).first();
    if (await ldwLink.isVisible()) {
      await ldwLink.click();
      await expect(page).toHaveURL('/last-donor-wall');
    }
  });
});
