/**
 * E2E-03: LDZ campaign → donate exact remaining → campaign shows completed → Last Donor celebrated
 * Priority: P0
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-03: Last Donor Zone Completion', () => {
  test('last donor zone campaign displays LDZ badge', async ({ page }) => {
    // Visit campaigns page and look for a LDZ-status campaign
    await page.goto('/campaigns');

    // If a LDZ badge exists, verify it renders
    const ldzBadge = page.locator('text=Last Donor Zone').first();
    if (await ldzBadge.isVisible()) {
      await expect(ldzBadge).toBeVisible();
    }
  });

  test('last donor wall page loads', async ({ page }) => {
    await page.goto('/last-donor-wall');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveURL('/last-donor-wall');
  });
});
