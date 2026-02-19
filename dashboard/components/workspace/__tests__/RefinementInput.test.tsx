import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { RefinementInput } from '../RefinementInput';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

// Reset the store before each test
beforeEach(() => {
  act(() => {
    useWorkspaceStore.getState().reset();
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RefinementInput rate limit feedback', () => {
  it('displays rate limit message when error starts with RATE_LIMITED:', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'RATE_LIMITED:30' });
    });

    render(<RefinementInput />);

    expect(screen.getByText('Rate limited. Try again in 30 seconds.')).toBeInTheDocument();
  });

  it('clears rate limit message after the specified seconds', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'RATE_LIMITED:5' });
    });

    render(<RefinementInput />);

    expect(screen.getByText('Rate limited. Try again in 5 seconds.')).toBeInTheDocument();

    // Advance timers by 5 seconds and flush React updates
    act(() => {
      jest.advanceTimersByTime(5001);
    });

    expect(screen.queryByText('Rate limited. Try again in 5 seconds.')).not.toBeInTheDocument();
  });

  it('uses default 60 seconds when Retry-After value is not a number', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'RATE_LIMITED:abc' });
    });

    render(<RefinementInput />);

    expect(screen.getByText('Rate limited. Try again in 60 seconds.')).toBeInTheDocument();
  });

  it('does not display rate limit message for non-rate-limit errors', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'Failed to refine idea' });
    });

    render(<RefinementInput />);

    expect(screen.queryByText(/Rate limited/)).not.toBeInTheDocument();
  });

  it('renders the rate limit message with amber text styling', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'RATE_LIMITED:30' });
    });

    render(<RefinementInput />);

    const message = screen.getByText('Rate limited. Try again in 30 seconds.');
    expect(message).toHaveClass('text-amber-600');
  });

  it('clears the store error after detecting rate limit', async () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'RATE_LIMITED:30' });
    });

    render(<RefinementInput />);

    // The error in the store should be cleared by the useEffect
    await waitFor(() => {
      expect(useWorkspaceStore.getState().error).toBeNull();
    });
  });
});
