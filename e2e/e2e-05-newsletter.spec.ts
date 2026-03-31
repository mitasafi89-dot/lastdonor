/**
 * E2E-05: Homepage → newsletter subscribe → confirmation toast
 * Priority: P1
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-05: Newsletter Subscribe', () => {
  test('newsletter form accepts email and submits', async ({ page }) => {
    await page.goto('/');

    // Find newsletter input in footer or CTA section
    const emailInput = page.getByPlaceholder(/email/i).first();
    await expect(emailInput).toBeVisible();

    await emailInput.fill('e2etest@example.com');

    // Submit the form
    const submitBtn = page.getByRole('button', { name: /subscribe|sign up|join/i }).first();
    await submitBtn.click();

    // Should show success state (toast, message, or visual change)
    const successIndicator = page.locator('text=/thank|subscribed|success/i').first();
    await expect(successIndicator).toBeVisible({ timeout: 5000 });
  });
});
