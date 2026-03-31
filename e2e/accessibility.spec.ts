/**
 * Accessibility Testing Helpers for Playwright
 *
 * Uses @axe-core/playwright for automated WCAG 2.1 AA checks.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Run axe accessibility analysis on the current page.
 * Fails the test if any violations are found.
 */
export async function checkA11y(page: Page, disableRules?: string[]) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(disableRules ?? [])
    .analyze();

  expect(results.violations).toEqual([]);
}

test.describe('Accessibility: Key Pages', () => {
  const pages = [
    { name: 'Homepage', path: '/' },
    { name: 'Campaigns', path: '/campaigns' },
    { name: 'About', path: '/about' },
    { name: 'How It Works', path: '/how-it-works' },
    { name: 'Blog', path: '/blog' },
    { name: 'Register', path: '/register' },
    { name: 'Login', path: '/login' },
    { name: 'Privacy', path: '/privacy' },
    { name: 'Terms', path: '/terms' },
    { name: 'Last Donor Wall', path: '/last-donor-wall' },
  ];

  for (const { name, path } of pages) {
    test(`${name} page passes WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await checkA11y(page);
    });
  }
});
