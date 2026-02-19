import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'success') return 'true';
      return null;
    },
  }),
}));

// Mock the PricingTable component
jest.mock('@/components/billing/PricingTable', () => ({
  PricingTable: () => <div data-testid="pricing-table">PricingTable</div>,
}));

// Mock fetch for subscription data
global.fetch = jest.fn()
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'user-1', subscription: { stripeCustomerId: 'cus_123' } }),
  })
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      plan: 'pro',
      status: 'active',
      ideas_used: 5,
      ideas_limit: 100,
      packs_used: 2,
      packs_limit: 10,
      current_period_end: '2026-03-01T00:00:00Z',
    }),
  }) as jest.Mock;

import BillingPage from '../page';

describe('Billing page decorative SVGs', () => {
  it('renders the success banner SVG with aria-hidden="true"', async () => {
    const { container } = render(<BillingPage />);

    // Wait for async effects to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const successSvg = container.querySelector('svg.h-5.w-5.text-green-400');
    expect(successSvg).toBeInTheDocument();
    expect(successSvg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the error banner SVG with aria-hidden="true" when error occurs', async () => {
    // Reset fetch mock to simulate an error
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { container } = render(<BillingPage />);

    // Wait for async effects to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const errorSvg = container.querySelector('svg.h-5.w-5.text-red-400');
    expect(errorSvg).toBeInTheDocument();
    expect(errorSvg).toHaveAttribute('aria-hidden', 'true');
  });
});
