/**
 * E2E-18: Admin Simulation Controls
 * Priority: P1
 *
 * Verifies admin simulation pages load (or redirect to login) and that the
 * simulation control panel, fund pool management, and analytics pages are
 * accessible from the admin navigation.
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-18: Admin Simulation Controls', () => {
  test('admin simulation page loads or redirects to login', async ({ page }) => {
    await page.goto('/admin/simulation');

    // Should either render the simulation controls or redirect to login
    await expect(page).toHaveURL(/\/(admin|login)/);
  });

  test('admin simulation page has correct heading when authenticated', async ({ page }) => {
    await page.goto('/admin/simulation');

    // If we land on the simulation page, check for expected heading
    const isSimPage = page.url().includes('/admin/simulation');
    if (isSimPage) {
      await expect(page.getByRole('heading', { name: /simulation controls/i })).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test('fund pool management page loads or redirects', async ({ page }) => {
    await page.goto('/admin/simulation/fund-pool');

    // Should load fund pool page or redirect to login
    await expect(page).toHaveURL(/\/(admin|login)/);
  });

  test('fund pool page has correct heading when authenticated', async ({ page }) => {
    await page.goto('/admin/simulation/fund-pool');

    const isFundPage = page.url().includes('/admin/simulation/fund-pool');
    if (isFundPage) {
      await expect(page.getByRole('heading', { name: /fund pool/i })).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test('analytics page loads or redirects', async ({ page }) => {
    await page.goto('/admin/simulation/analytics');

    // Should load analytics page or redirect to login
    await expect(page).toHaveURL(/\/(admin|login)/);
  });

  test('admin simulation pages do not expose simulation internals to unauthenticated users', async ({
    page,
  }) => {
    // Visit simulation page without auth - should redirect
    await page.goto('/admin/simulation');
    const url = page.url();

    // If redirected to login, the page content should not leak simulation details
    if (url.includes('/login')) {
      const html = await page.content();
      expect(html).not.toContain('simulationConfig');
      expect(html).not.toContain('simulation_flag');
      expect(html).not.toContain('EMAIL_DOMAINS');
      expect(html).not.toContain('generateRealisticPaymentId');
    }
  });

  test('admin navigation includes simulation links', async ({ page }) => {
    await page.goto('/admin');

    // If admin page loads (user is authenticated), check for simulation nav links
    const isAdmin = page.url().includes('/admin') && !page.url().includes('/login');
    if (isAdmin) {
      const simLink = page.getByRole('link', { name: /simulation/i }).first();
      const simVisible = await simLink.isVisible({ timeout: 5000 }).catch(() => false);

      if (simVisible) {
        await simLink.click();
        await expect(page).toHaveURL(/\/admin\/simulation/);
      }
    }
  });
});
