import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Metis');
  });

  test('should display the tagline', async ({ page }) => {
    const tagline = page.getByText('Transform market signals into buildable SaaS opportunities');
    await expect(tagline).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Metis/);
  });

  test('should display Discover Ideas section', async ({ page }) => {
    const discoverSection = page.getByText('🔍 Discover Ideas');
    await expect(discoverSection).toBeVisible();

    const discoverDescription = page.getByText('Browse data-driven opportunities from market signals');
    await expect(discoverDescription).toBeVisible();
  });

  test('should display Generate Ideas section', async ({ page }) => {
    const generateSection = page.getByText('✨ Generate Ideas');
    await expect(generateSection).toBeVisible();

    const generateDescription = page.getByText('Create with AI assistance based on your preferences');
    await expect(generateDescription).toBeVisible();
  });

  test('should have a two-column grid on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Check for grid layout
    const grid = page.locator('.grid');
    await expect(grid).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(heading).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(heading).toBeVisible();
  });

  test('should have card sections with proper styling', async ({ page }) => {
    const cards = page.locator('.bg-white.rounded-lg.shadow');
    await expect(cards).toHaveCount(2);
  });
});
