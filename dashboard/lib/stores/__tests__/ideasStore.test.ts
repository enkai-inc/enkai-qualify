import { useIdeasStore } from '@/lib/stores/ideasStore';
import { act } from '@testing-library/react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createFetchResponse(data: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(data),
  };
}

const defaultResponseData = {
  items: [{ id: '1', title: 'Test Idea' }],
  total: 1,
  hasMore: false,
};

describe('ideasStore - AbortController', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    act(() => {
      useIdeasStore.getState().reset();
    });
    mockFetch.mockReset();
  });

  it('should pass an AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValueOnce(createFetchResponse(defaultResponseData));

    await act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    // Second argument should contain signal
    expect(callArgs[1]).toBeDefined();
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('should abort previous request when a new fetchIdeas is called', async () => {
    // Create a delayed response for the first call
    let resolveFirst: (value: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      // Listen for abort on this signal
      const signal = options?.signal;
      return new Promise((resolve, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
        firstPromise.then(resolve);
      });
    });

    // Second call resolves immediately
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(createFetchResponse(defaultResponseData))
    );

    // Start first fetch (don't await)
    let firstDone = false;
    const firstFetch = act(async () => {
      await useIdeasStore.getState().fetchIdeas();
      firstDone = true;
    });

    // Start second fetch - this should abort the first
    await act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    // Resolve the first promise to let the abort handler fire
    resolveFirst!(createFetchResponse(defaultResponseData));
    await firstFetch;

    // The store should have data from the second request, not the first
    const state = useIdeasStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should not set error state when a request is aborted', async () => {
    // First call will be aborted
    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      const signal = options?.signal;
      return new Promise((resolve, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
        // Never resolves naturally
      });
    });

    // Second call succeeds
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(createFetchResponse(defaultResponseData))
    );

    // Start first fetch
    const firstFetch = act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    // Start second fetch which aborts the first
    await act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    await firstFetch;

    const state = useIdeasStore.getState();
    // Should not have an error from the aborted request
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should still handle non-abort errors normally', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    const state = useIdeasStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.isLoading).toBe(false);
  });

  it('should update state correctly on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(createFetchResponse(defaultResponseData));

    await act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    const state = useIdeasStore.getState();
    expect(state.ideas).toEqual(defaultResponseData.items);
    expect(state.total).toBe(1);
    expect(state.hasMore).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should not update state if a newer request has started', async () => {
    const firstResponseData = {
      items: [{ id: 'old', title: 'Old Data' }],
      total: 1,
      hasMore: false,
    };
    const secondResponseData = {
      items: [{ id: 'new', title: 'New Data' }],
      total: 2,
      hasMore: true,
    };

    // First request is slow
    let resolveFirst: (value: unknown) => void;
    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      const signal = options?.signal;
      return new Promise((resolve, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
        resolveFirst = resolve;
      });
    });

    // Second request is fast
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(createFetchResponse(secondResponseData))
    );

    // Start first fetch
    const firstFetch = act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    // Start second fetch (aborts first)
    await act(async () => {
      await useIdeasStore.getState().fetchIdeas();
    });

    // Resolve first (after abort, so it should be ignored)
    resolveFirst!(createFetchResponse(firstResponseData));
    await firstFetch;

    // State should reflect the second (newer) request
    const state = useIdeasStore.getState();
    expect(state.ideas).toEqual(secondResponseData.items);
    expect(state.total).toBe(2);
    expect(state.hasMore).toBe(true);
  });
});
