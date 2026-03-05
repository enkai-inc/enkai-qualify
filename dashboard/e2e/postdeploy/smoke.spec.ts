import { test, expect } from '@playwright/test';

test.describe('Post-deploy smoke tests', () => {
  test('health endpoint returns healthy', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('enkai-qualify-dashboard');
  });

  test('health endpoint responds within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/health');
    const elapsed = Date.now() - start;

    expect(response.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(5000);
  });

  test('app serves HTML at root', async ({ request }) => {
    const response = await request.get('/');

    // Should get a 200 (or 307/302 redirect to login/ideas)
    expect(response.status()).toBeLessThan(500);
  });
});
