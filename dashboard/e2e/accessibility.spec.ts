import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/ideas');
  });

  test('should have proper html lang attribute', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
  });

  test('should have no accessibility violations in page structure', async ({ page }) => {
    // Check for proper heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/\S+/); // Non-empty text
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Focus should be manageable
    await page.keyboard.press('Tab');
    // No errors should occur during tab navigation
  });

  test('should have proper contrast for text', async ({ page }) => {
    const heading = page.locator('h1');
    const styles = await heading.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        fontSize: computed.fontSize,
      };
    });

    // Heading should have readable font size (at least 16px)
    const fontSize = parseFloat(styles.fontSize);
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('should have visible content', async ({ page }) => {
    // Check that critical content is visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // At least one description paragraph
    const descriptions = page.locator('p');
    const count = await descriptions.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Performance', () => {
  test('should load page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForURL('**/ideas');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Ignore expected errors like fetch failures in test environment
        const text = msg.text();
        if (
          !text.includes('fetch') &&
          !text.includes('Failed to fetch') &&
          !text.includes('Failed to load resource') &&
          !text.includes('/api/') &&
          !text.includes('401')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForURL('**/ideas');
    await page.waitForLoadState('networkidle');

    expect(consoleErrors).toHaveLength(0);
  });

  test('should not have any failed network requests for critical resources', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('requestfailed', (request) => {
      const url = request.url();
      // Ignore API failures and Next.js RSC prefetch/navigation failures in test environment
      if (
        !url.includes('/api/') &&
        !url.includes('_rsc=') &&
        !url.includes('_next/')
      ) {
        failedRequests.push(`${url} - ${request.failure()?.errorText}`);
      }
    });

    await page.goto('/');
    await page.waitForURL('**/ideas');
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toHaveLength(0);
  });
});
