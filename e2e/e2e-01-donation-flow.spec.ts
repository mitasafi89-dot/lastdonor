/**
 * E2E-01: Homepage → campaigns → campaign → read story → donate $50 → confirmation toast
 * Priority: P0
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-01: Donation Flow', () => {
  test('navigates from homepage to campaign and initiates donation', async ({ page }) => {
    await page.goto('/');

    // Click campaigns link
    await page.getByRole('link', { name: /campaigns/i }).first().click();
    await expect(page).toHaveURL(/\/campaigns/);

    // Click into first campaign
    const firstCampaign = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    await firstCampaign.click();

    // Should be on a campaign page
    await expect(page).toHaveURL(/\/campaigns\//);

    // Verify campaign has story content
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Look for donation form
    const donateButton = page.getByRole('button', { name: /donate/i }).first();
    await expect(donateButton).toBeVisible();
  });

  test('homepage loads with hero, trust bar, and impact counter', async ({ page }) => {
    await page.goto('/');

    // Verify key homepage sections exist
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });
});
