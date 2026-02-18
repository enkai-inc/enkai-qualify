import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should redirect to /ideas', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/ideas');
    expect(page.url()).toContain('/ideas');
  });

  test('should display the Ideas heading after redirect', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/ideas');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Ideas');
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Metis/);
  });

  test('should display New Idea button after redirect', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/ideas');
    const newIdeaLink = page.getByRole('link', { name: /New Idea/ });
    await expect(newIdeaLink).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/ideas');
    const heading = page.locator('h1');

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(heading).toBeVisible();

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(heading).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(heading).toBeVisible();
  });
});
