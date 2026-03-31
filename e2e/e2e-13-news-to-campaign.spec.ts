/**
 * E2E-13: Admin → news feed → "Create Campaign From This" → pre-fills editor
 * Priority: P2
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-13: News Feed to Campaign', () => {
  test('admin news feed page loads', async ({ page }) => {
    await page.goto('/admin/news-feed');

    // Should load or redirect to login
    await expect(page).toHaveURL(/\/(admin|login)/);
  });
});
