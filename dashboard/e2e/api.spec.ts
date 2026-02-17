import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test.describe('Health Check Endpoint', () => {
    test('should return healthy status', async ({ request }) => {
      const response = await request.get('/api/health');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('dashboard');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    test('should return valid JSON', async ({ request }) => {
      const response = await request.get('/api/health');

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('should include timestamp in ISO format', async ({ request }) => {
      const response = await request.get('/api/health');
      const body = await response.json();

      // Validate ISO 8601 format
      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    test('should include version string', async ({ request }) => {
      const response = await request.get('/api/health');
      const body = await response.json();

      expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should respond within acceptable time', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get('/api/health');
      const endTime = Date.now();

      expect(response.ok()).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  test.describe('Error Handling', () => {
    test('should return 404 for non-existent API routes', async ({ request }) => {
      const response = await request.get('/api/nonexistent');
      expect(response.status()).toBe(404);
    });
  });
});
