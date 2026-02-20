import { act } from '@testing-library/react';
import { useIdeasStore } from '../ideasStore';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock @prisma/client to avoid import issues in test environment
jest.mock('@prisma/client', () => ({
  IdeaStatus: {
    PENDING: 'PENDING',
    DRAFT: 'DRAFT',
    VALIDATED: 'VALIDATED',
    PACK_GENERATED: 'PACK_GENERATED',
    ARCHIVED: 'ARCHIVED',
  },
}));

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

describe('ideasStore fetch timeouts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    act(() => {
      useIdeasStore.getState().reset();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fetchIdeas', () => {
    it('should abort fetch after 30s timeout', async () => {
      mockFetch.mockImplementation(
        (_url: string, options?: RequestInit) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      const fetchPromise = useIdeasStore.getState().fetchIdeas();

      jest.advanceTimersByTime(30000);

      await fetchPromise;

      const state = useIdeasStore.getState();
      expect(state.error).toBe('Request timed out. Please try again.');
      expect(state.isLoading).toBe(false);
    });

    it('should pass signal to fetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total: 0, hasMore: false }),
      });

      await act(async () => {
        await useIdeasStore.getState().fetchIdeas();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ideas?'),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle network errors with specific message', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await act(async () => {
        await useIdeasStore.getState().fetchIdeas();
      });

      const state = useIdeasStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
      expect(state.isLoading).toBe(false);
    });

    it('should clear timeout on successful fetch', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total: 0, hasMore: false }),
      });

      await act(async () => {
        await useIdeasStore.getState().fetchIdeas();
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('deleteIdea', () => {
    beforeEach(() => {
      act(() => {
        useIdeasStore.setState({
          ideas: [
            {
              id: 'test-id',
              title: 'Test Idea',
              description: 'Test',
              industry: 'tech',
              targetMarket: 'developers',
              status: 'DRAFT' as const,
              currentVersion: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              latestValidation: null,
            },
          ],
          total: 1,
        });
      });
    });

    it('should abort fetch after 30s timeout', async () => {
      mockFetch.mockImplementation(
        (_url: string, options?: RequestInit) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      const deletePromise = useIdeasStore.getState().deleteIdea('test-id');

      jest.advanceTimersByTime(30000);

      // The store re-throws the error after setting state
      await expect(deletePromise).rejects.toThrow();

      const state = useIdeasStore.getState();
      expect(state.error).toBe('Request timed out. Please try again.');
    });

    it('should pass signal to fetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await act(async () => {
        await useIdeasStore.getState().deleteIdea('test-id');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ideas/test-id',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          method: 'DELETE',
        })
      );
    });

    it('should handle network errors with specific message', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      // The store re-throws the error after setting state
      await expect(
        useIdeasStore.getState().deleteIdea('test-id')
      ).rejects.toThrow('Failed to fetch');

      const state = useIdeasStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
    });
  });
});
