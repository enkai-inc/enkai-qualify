/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the stripe-service module
jest.mock('@/lib/services/stripe-service', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
  getTierFromPriceId: jest.fn().mockReturnValue('EXPLORER'),
}));

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

function createRequest(options: { body?: string; signature?: string } = {}) {
  const { body = 'test-body', signature } = options;
  const headers = new Headers();
  if (signature) {
    headers.set('stripe-signature', signature);
  }
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  });
}

describe('POST /api/webhooks/stripe', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('webhook secret validation', () => {
    it('should return 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const request = createRequest({ signature: 'valid-sig' });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Webhook configuration error');
    });

    it('should return 500 when STRIPE_WEBHOOK_SECRET is empty string', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = '';

      const request = createRequest({ signature: 'valid-sig' });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Webhook configuration error');
    });

    it('should still return 400 when stripe-signature header is missing', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';

      const request = createRequest({ signature: undefined });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing stripe-signature header');
    });

    it('should proceed to constructEvent when webhook secret is set', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';

      const { stripe } = require('@/lib/services/stripe-service');
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { id: 'inv_123' } },
      });

      const request = createRequest({ signature: 'valid-sig' });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'test-body',
        'valid-sig',
        'whsec_test123'
      );
    });
  });
});
