import { useIdeasStore } from '../ideasStore';
import { act } from '@testing-library/react';

// Mock fetch globally
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

      await deletePromise;

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
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await act(async () => {
        await useIdeasStore.getState().deleteIdea('test-id');
      });

      const state = useIdeasStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
    });
  });
});
