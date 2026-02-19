import { useWorkspaceStore } from '../workspaceStore';
import { act } from '@testing-library/react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
});

describe('workspaceStore fetch timeouts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    act(() => {
      useWorkspaceStore.getState().reset();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('loadIdea', () => {
    it('should abort fetch after 30s timeout', async () => {
      // Create a fetch that never resolves
      mockFetch.mockImplementation(
        (_url: string, options?: RequestInit) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      const loadPromise = useWorkspaceStore.getState().loadIdea('test-id');

      // Advance timer past the 30s timeout
      jest.advanceTimersByTime(30000);

      await loadPromise;

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Request timed out. Please try again.');
      expect(state.isLoading).toBe(false);
    });

    it('should pass signal to fetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ idea: { id: 'test-id' }, versions: [], validation: null }),
      });

      await act(async () => {
        await useWorkspaceStore.getState().loadIdea('test-id');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ideas/test-id',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle network errors with specific message', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await act(async () => {
        await useWorkspaceStore.getState().loadIdea('test-id');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
      expect(state.isLoading).toBe(false);
    });

    it('should clear timeout on successful fetch', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ idea: { id: 'test-id' }, versions: [], validation: null }),
      });

      await act(async () => {
        await useWorkspaceStore.getState().loadIdea('test-id');
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('refine', () => {
    beforeEach(() => {
      // Set up initial idea state
      act(() => {
        useWorkspaceStore.setState({
          idea: {
            id: 'test-id',
            title: 'Test Idea',
            description: 'Test Description',
            industry: 'tech',
            targetMarket: 'developers',
            technologies: [],
            features: [],
            currentVersion: 1,
            status: 'DRAFT',
          },
          conversation: [],
        });
      });
    });

    it('should abort fetch after 60s timeout (AI operations)', async () => {
      mockFetch.mockImplementation(
        (_url: string, options?: RequestInit) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      const refinePromise = useWorkspaceStore.getState().refine('make it better');

      // 30s should NOT trigger the timeout for refine
      jest.advanceTimersByTime(30000);
      expect(useWorkspaceStore.getState().error).toBeNull();

      // 60s should trigger the timeout
      jest.advanceTimersByTime(30000);

      await refinePromise;

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Request timed out. Please try again.');
      expect(state.isRefining).toBe(false);
    });

    it('should pass signal to fetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ idea: { id: 'test-id' }, summary: 'Refined' }),
      });

      await act(async () => {
        await useWorkspaceStore.getState().refine('make it better');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ideas/test-id/refine',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle network errors with specific message', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await act(async () => {
        await useWorkspaceStore.getState().refine('make it better');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
      expect(state.isRefining).toBe(false);
    });
  });

  describe('restoreVersion', () => {
    beforeEach(() => {
      act(() => {
        useWorkspaceStore.setState({
          idea: {
            id: 'test-id',
            title: 'Test Idea',
            description: 'Test Description',
            industry: 'tech',
            targetMarket: 'developers',
            technologies: [],
            features: [],
            currentVersion: 1,
            status: 'DRAFT',
          },
          versions: [],
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

      const promise = useWorkspaceStore.getState().restoreVersion('version-1');

      jest.advanceTimersByTime(30000);

      await promise;

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Request timed out. Please try again.');
      expect(state.isLoading).toBe(false);
    });

    it('should handle network errors with specific message', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await act(async () => {
        await useWorkspaceStore.getState().restoreVersion('version-1');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('branchFromVersion', () => {
    beforeEach(() => {
      act(() => {
        useWorkspaceStore.setState({
          idea: {
            id: 'test-id',
            title: 'Test Idea',
            description: 'Test Description',
            industry: 'tech',
            targetMarket: 'developers',
            technologies: [],
            features: [],
            currentVersion: 1,
            status: 'DRAFT',
          },
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

      const promise = useWorkspaceStore.getState().branchFromVersion('version-1');

      jest.advanceTimersByTime(30000);

      await promise;

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Request timed out. Please try again.');
      expect(state.isLoading).toBe(false);
    });

    it('should handle network errors with specific message', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await act(async () => {
        await useWorkspaceStore.getState().branchFromVersion('version-1');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Network error. Please check your connection.');
      expect(state.isLoading).toBe(false);
    });
  });
});
