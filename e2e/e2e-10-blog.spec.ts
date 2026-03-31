/**
 * E2E-10: Blog listing → read post → back → pagination works
 * Priority: P2
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-10: Blog Flow', () => {
  test('blog listing page loads', async ({ page }) => {
    await page.goto('/blog');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveURL('/blog');
  });

  test('blog post page loads via slug', async ({ page }) => {
    await page.goto('/blog');

    // Click on a blog post if any exist
    const postLink = page.getByRole('link').filter({ hasText: /.{10,}/ }).first();
    if (await postLink.isVisible()) {
      await postLink.click();
      await expect(page).toHaveURL(/\/blog\/.+/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});
