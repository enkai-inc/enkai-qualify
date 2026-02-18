import { test, expect } from '@playwright/test';

// Skip billing tests when Clerk authentication is not configured
// These tests require authentication which won't work without Clerk keys
const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

test.describe('Billing Page', () => {
  test.skip(!clerkConfigured, 'Skipping billing tests - Clerk not configured');
  test.beforeEach(async ({ page }) => {
    // Mock the subscription API to avoid network timeout
    await page.route('**/api/billing/subscription/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'free',
          status: 'active',
          ideas_used: 5,
          ideas_limit: 10,
          packs_used: 1,
          packs_limit: 3,
          current_period_end: '2026-03-01T00:00:00Z',
        }),
      });
    });

    await page.goto('/billing');
  });

  test('should display the billing page heading', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'Billing & Subscription' });
    await expect(heading).toBeVisible();
  });

  test('should display "Choose Your Plan" section', async ({ page }) => {
    const planHeading = page.getByRole('heading', { name: 'Choose Your Plan' });
    await expect(planHeading).toBeVisible();
  });

  test('should display current plan info', async ({ page }) => {
    // Wait for the mocked subscription to load
    const currentPlan = page.getByRole('heading', { name: 'Current Plan' });
    await expect(currentPlan).toBeVisible();

    // Check plan name is displayed
    const planName = page.getByText('free', { exact: false });
    await expect(planName.first()).toBeVisible();
  });

  test('should display usage cards', async ({ page }) => {
    // Check for usage cards
    const ideasUsed = page.getByText('Ideas Used');
    await expect(ideasUsed).toBeVisible();

    const packsUsed = page.getByText('Packs Used');
    await expect(packsUsed).toBeVisible();
  });

  test('should display support link', async ({ page }) => {
    const supportLink = page.getByRole('link', { name: /Contact support/i });
    await expect(supportLink).toBeVisible();
    await expect(supportLink).toHaveAttribute('href', '/support');
  });

  test('should handle success query parameter', async ({ page }) => {
    await page.goto('/billing?success=true');

    const successMessage = page.getByText('Subscription updated successfully!');
    await expect(successMessage).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    const heading = page.getByRole('heading', { name: 'Billing & Subscription' });
    await expect(heading).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(heading).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(heading).toBeVisible();
  });
});
