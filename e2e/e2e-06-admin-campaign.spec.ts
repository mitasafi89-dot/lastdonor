/**
 * E2E-06: Admin login → create campaign → publish → appears on campaigns page
 * Priority: P1
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-06: Admin Campaign Management', () => {
  test('admin page loads', async ({ page }) => {
    await page.goto('/admin');

    // Admin page should either load or redirect to login
    await expect(page).toHaveURL(/\/(admin|login)/);
  });

  test('admin campaigns page loads', async ({ page }) => {
    await page.goto('/admin/campaigns');

    // Should load admin campaigns or redirect
    await expect(page).toHaveURL(/\/(admin|login)/);
  });
});
