import { act } from '@testing-library/react';
import { useIdeasStore } from '../ideasStore';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

describe('ideasStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useIdeasStore.getState().reset();
    });
  });

  describe('fetchIdeas - AbortController', () => {
    it('should abort previous fetch when a new fetchIdeas is called', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      // First call: never resolves (simulates slow request)
      const firstPromise = new Promise(() => {
        // intentionally never resolves
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Second call: resolves immediately
      mockFetch.mockResolvedValueOnce(
        mockResponse({ items: [], total: 0, hasMore: false })
      );

      // Start first fetch (do not await)
      useIdeasStore.getState().fetchIdeas();

      // Start second fetch - should abort the first
      const second = useIdeasStore.getState().fetchIdeas();

      // The abort should have been called once (aborting the first request)
      expect(abortSpy).toHaveBeenCalledTimes(1);

      await second;

      abortSpy.mockRestore();
    });

    it('should pass signal to fetch', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ items: [], total: 0, hasMore: false })
      );

      await act(async () => {
        await useIdeasStore.getState().fetchIdeas();
      });

      // Verify fetch was called with a signal option
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]).toBeDefined();
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it('should silently ignore AbortError', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      await act(async () => {
        await useIdeasStore.getState().fetchIdeas();
      });

      const state = useIdeasStore.getState();
      // AbortError should not set error state
      expect(state.error).toBeNull();
    });

    it('should still handle non-abort errors normally', async () => {
      const networkError = new Error('Network failure');
      mockFetch.mockRejectedValueOnce(networkError);

      await act(async () => {
        await useIdeasStore.getState().fetchIdeas();
      });

      const state = useIdeasStore.getState();
      expect(state.error).toBe('Network failure');
      expect(state.isLoading).toBe(false);
    });
  });
});
