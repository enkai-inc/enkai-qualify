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

describe('RefinementInput non-rate-limit error feedback', () => {
  it('displays non-rate-limit error message', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'Failed to refine idea' });
    });

    render(<RefinementInput />);

    expect(screen.getByText('Failed to refine idea')).toBeInTheDocument();
  });

  it('renders error message with red text styling', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'Network error. Please check your connection.' });
    });

    render(<RefinementInput />);

    const message = screen.getByText('Network error. Please check your connection.');
    expect(message).toHaveClass('text-red-600');
  });

  it('clears the store error after detecting non-rate-limit error', async () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'Failed to refine idea' });
    });

    render(<RefinementInput />);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().error).toBeNull();
    });
  });

  it('auto-dismisses error message after 10 seconds', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'Failed to refine idea' });
    });

    render(<RefinementInput />);

    expect(screen.getByText('Failed to refine idea')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10001);
    });

    expect(screen.queryByText('Failed to refine idea')).not.toBeInTheDocument();
  });

  it('has a dismiss button that clears the error message', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'Failed to refine idea' });
    });

    render(<RefinementInput />);

    expect(screen.getByText('Failed to refine idea')).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Failed to refine idea')).not.toBeInTheDocument();
  });

  it('does not show error message for rate-limit errors', () => {
    act(() => {
      useWorkspaceStore.setState({ error: 'RATE_LIMITED:30' });
    });

    render(<RefinementInput />);

    // Should show rate limit message, not the generic error
    expect(screen.getByText('Rate limited. Try again in 30 seconds.')).toBeInTheDocument();
    expect(screen.queryByText('RATE_LIMITED:30')).not.toBeInTheDocument();
  });
});
