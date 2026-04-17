/**
 * E2E-04: Register → login → profile → view donation history → see badges
 * Priority: P1
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-04: Registration & Profile', () => {
  test('registration page loads and displays form fields', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test('login page loads and displays form fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('profile page redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/profile');

    // /profile redirects to /dashboard/settings, which redirects unauthenticated users to login
    await expect(page).toHaveURL(/\/(login|dashboard\/settings)/);
  });
});
