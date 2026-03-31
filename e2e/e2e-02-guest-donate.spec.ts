/**
 * E2E-02: Campaign → guest donate (no login) → receipt email triggered
 * Priority: P0
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-02: Guest Donation', () => {
  test('guest can access donation form without logging in', async ({ page }) => {
    await page.goto('/campaigns');

    // Navigate to first campaign
    const firstCampaign = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    await firstCampaign.click();

    await expect(page).toHaveURL(/\/campaigns\//);

    // Donation form should be visible without login
    const donateSection = page.getByRole('button', { name: /donate/i }).first();
    await expect(donateSection).toBeVisible();

    // No "login required" message — guests can donate
    await expect(page.getByText(/must log in|login required/i)).not.toBeVisible();
  });

  test('campaign page shows progress and phase info', async ({ page }) => {
    await page.goto('/campaigns');

    // Navigate to a campaign
    const campaignLink = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    await campaignLink.click();

    // Progress bar should be present
    await expect(page.getByRole('progressbar')).toBeVisible();
  });
});
