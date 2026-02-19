import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock PricingTable
jest.mock('@/components/billing/PricingTable', () => ({
  PricingTable: () => <div data-testid="pricing-table" />,
}));

// We need to control fetch behavior
const mockFetch = jest.fn();
global.fetch = mockFetch;

import BillingPage from '../page';

describe('Billing page decorative SVGs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.set('success', 'true');
  });

  afterEach(() => {
    mockSearchParams.delete('success');
  });

  it('renders the success banner SVG with aria-hidden="true"', async () => {
    mockFetch
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
      });

    const { container } = render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('pro')).toBeInTheDocument();
    });

    const successSvg = container.querySelector('svg.h-5.w-5.text-green-400');
    expect(successSvg).toBeInTheDocument();
    expect(successSvg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the error banner SVG with aria-hidden="true" when error occurs', async () => {
    mockSearchParams.delete('success');
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { container } = render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const errorSvg = container.querySelector('svg.h-5.w-5.text-red-400');
    expect(errorSvg).toBeInTheDocument();
    expect(errorSvg).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('BillingContent retry button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a "Try Again" button when there is an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('retries fetching subscription when "Try Again" is clicked', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user-1' }),
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
      });

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(screen.getByText('pro')).toBeInTheDocument();
    });

    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });

  it('shows loading state after clicking "Try Again"', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

    const { container } = render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Fetch failed')).toBeInTheDocument();
    });

    let resolveAuth: (value: unknown) => void;
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAuth = resolve; })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    expect(screen.queryByText('Fetch failed')).not.toBeInTheDocument();
  });
});

describe('BillingPage - UsageCard ARIA progressbar attributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders progress bars with role="progressbar" and correct ARIA attributes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user-1' }),
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
      });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('pro')).toBeInTheDocument();
    });

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);

    const ideasBar = screen.getByRole('progressbar', { name: 'Ideas Used' });
    expect(ideasBar).toHaveAttribute('aria-valuenow', '5');
    expect(ideasBar).toHaveAttribute('aria-valuemin', '0');
    expect(ideasBar).toHaveAttribute('aria-valuemax', '100');

    const packsBar = screen.getByRole('progressbar', { name: 'Packs Used' });
    expect(packsBar).toHaveAttribute('aria-valuenow', '2');
    expect(packsBar).toHaveAttribute('aria-valuemin', '0');
    expect(packsBar).toHaveAttribute('aria-valuemax', '10');
  });

  it('renders correct ARIA attributes for unlimited usage', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan: 'enterprise',
          status: 'active',
          ideas_used: 50,
          ideas_limit: -1,
          packs_used: 10,
          packs_limit: -1,
          current_period_end: '2026-03-01T00:00:00Z',
        }),
      });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('enterprise')).toBeInTheDocument();
    });

    const ideasBar = screen.getByRole('progressbar', { name: 'Ideas Used' });
    expect(ideasBar).toHaveAttribute('aria-valuenow', '0');
    expect(ideasBar).toHaveAttribute('aria-valuemin', '0');
    expect(ideasBar).toHaveAttribute('aria-valuemax', '0');

    const packsBar = screen.getByRole('progressbar', { name: 'Packs Used' });
    expect(packsBar).toHaveAttribute('aria-valuenow', '0');
    expect(packsBar).toHaveAttribute('aria-valuemin', '0');
    expect(packsBar).toHaveAttribute('aria-valuemax', '0');
  });
});
