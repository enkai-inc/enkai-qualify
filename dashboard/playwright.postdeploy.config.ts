import { defineConfig, devices } from '@playwright/test';

/**
 * Post-deploy smoke test configuration.
 * Runs against the live deployment URL after ECS services are updated.
 */
export default defineConfig({
  testDir: './e2e/postdeploy',

  fullyParallel: false,
  forbidOnly: true,
  retries: 2,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report/postdeploy' }],
    ['junit', { outputFile: 'test-results/postdeploy/junit-results.xml' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://enkai-qualify.digitaldevops.io',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  timeout: 30_000,
  expect: { timeout: 10_000 },
});
