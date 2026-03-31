/**
 * E2E-09: Dark mode toggle → verify key pages render correctly
 * Priority: P2
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-09: Dark Mode', () => {
  test('dark mode toggle changes theme', async ({ page }) => {
    await page.goto('/');

    // Find dark mode toggle
    const toggle = page.getByRole('switch', { name: /dark|theme/i }).or(
      page.getByRole('button', { name: /dark|theme/i }),
    );

    if (await toggle.isVisible()) {
      // Click toggle
      await toggle.click();

      // Check that dark class is applied to html/body
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark'),
      );
      expect(isDark).toBe(true);

      // Toggle back
      await toggle.click();
      const isLight = await page.evaluate(() =>
        !document.documentElement.classList.contains('dark'),
      );
      expect(isLight).toBe(true);
    }
  });

  test('dark mode persists across navigation', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('switch', { name: /dark|theme/i }).or(
      page.getByRole('button', { name: /dark|theme/i }),
    );

    if (await toggle.isVisible()) {
      await toggle.click();

      // Navigate to another page
      await page.goto('/campaigns');

      // Dark mode should persist
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark'),
      );
      expect(isDark).toBe(true);
    }
  });
});
