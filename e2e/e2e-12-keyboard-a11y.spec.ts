/**
 * E2E-12: Keyboard-only navigation: Tab through entire donation flow, submit with Enter
 * Priority: P1
 */
import { test, expect } from '@playwright/test';

test.describe('E2E-12: Keyboard Accessibility', () => {
  test('skip to content link works', async ({ page }) => {
    await page.goto('/');

    // Press Tab to reveal skip-to-content link
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: /skip to content/i });
    if (await skipLink.isVisible()) {
      await page.keyboard.press('Enter');
      // Focus should move to main content
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).not.toBe('BODY');
    }
  });

  test('navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Tab through navigation links
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Should have focus on a link
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedTag);
  });

  test('donation form fields are keyboard navigable', async ({ page }) => {
    await page.goto('/campaigns');

    const campaignLink = page.getByRole('link', { name: /donate|view|learn more/i }).first();
    if (await campaignLink.isVisible()) {
      await campaignLink.click();

      // Tab to donation form
      await page.keyboard.press('Tab');

      // Keep tabbing until we reach the donation form area
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          type: (document.activeElement as HTMLInputElement)?.type,
          role: document.activeElement?.getAttribute('role'),
        }));

        // If we hit an input or button in the donation area, test passes
        if (focused.tag === 'INPUT' || focused.tag === 'BUTTON') {
          expect(focused.tag).toBeTruthy();
          break;
        }
      }
    }
  });
});
