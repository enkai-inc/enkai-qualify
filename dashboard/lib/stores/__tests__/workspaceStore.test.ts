import { act } from '@testing-library/react';
import { useWorkspaceStore } from '../workspaceStore';

// Polyfill crypto.randomUUID for jsdom
if (!global.crypto?.randomUUID) {
  Object.defineProperty(global, 'crypto', {
    value: {
      ...global.crypto,
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
    },
  });
}

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

const mockIdeaResponse = {
  idea: {
    id: 'idea-1',
    title: 'Test',
    description: '',
    industry: '',
    targetMarket: '',
    technologies: [],
    features: [],
    currentVersion: 1,
    status: 'DRAFT',
  },
  versions: [],
  validation: null,
};

describe('workspaceStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useWorkspaceStore.getState().reset();
    });
  });

  describe('loadIdea - AbortController', () => {
    it('should abort previous loadIdea when a new one is called', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      // First call: never resolves
      const firstPromise = new Promise(() => {
        // intentionally never resolves
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Second call: resolves immediately
      mockFetch.mockResolvedValueOnce(mockResponse(mockIdeaResponse));

      // Start first load (do not await)
      useWorkspaceStore.getState().loadIdea('idea-1');

      // Start second load - should abort the first
      const second = useWorkspaceStore.getState().loadIdea('idea-2');

      expect(abortSpy).toHaveBeenCalledTimes(1);

      await second;

      abortSpy.mockRestore();
    });

    it('should pass signal to fetch in loadIdea', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(mockIdeaResponse));

      await act(async () => {
        await useWorkspaceStore.getState().loadIdea('idea-1');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]).toBeDefined();
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it('should silently ignore AbortError in loadIdea', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      await act(async () => {
        await useWorkspaceStore.getState().loadIdea('idea-1');
      });

      const state = useWorkspaceStore.getState();
      // AbortError should not set error state
      expect(state.error).toBeNull();
    });

    it('should still handle non-abort errors normally in loadIdea', async () => {
      const networkError = new Error('Network failure');
      mockFetch.mockRejectedValueOnce(networkError);

      await act(async () => {
        await useWorkspaceStore.getState().loadIdea('idea-1');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Network failure');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('refine - rate limiting', () => {
    it('throws RATE_LIMITED error with Retry-After value on 429 response', async () => {
      // Set up store with an idea so refine doesn't bail early
      act(() => {
        useWorkspaceStore.setState({
          idea: {
            id: 'test-idea',
            title: 'Test',
            description: 'Test desc',
            industry: 'tech',
            targetMarket: 'enterprise',
            technologies: [],
            features: [],
            currentVersion: 1,
            status: 'DRAFT',
          },
        });
      });

      // Mock fetch to return 429 with Retry-After header
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '30' : null),
        },
      });

      await act(async () => {
        await useWorkspaceStore.getState().refine('test prompt');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('RATE_LIMITED:30');
      expect(state.isRefining).toBe(false);
    });

    it('uses default 60 seconds when Retry-After header is absent on 429', async () => {
      act(() => {
        useWorkspaceStore.setState({
          idea: {
            id: 'test-idea',
            title: 'Test',
            description: 'Test desc',
            industry: 'tech',
            targetMarket: 'enterprise',
            technologies: [],
            features: [],
            currentVersion: 1,
            status: 'DRAFT',
          },
        });
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: () => null,
        },
      });

      await act(async () => {
        await useWorkspaceStore.getState().refine('test prompt');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('RATE_LIMITED:60');
      expect(state.isRefining).toBe(false);
    });

    it('throws generic error for non-429 failures', async () => {
      act(() => {
        useWorkspaceStore.setState({
          idea: {
            id: 'test-idea',
            title: 'Test',
            description: 'Test desc',
            industry: 'tech',
            targetMarket: 'enterprise',
            technologies: [],
            features: [],
            currentVersion: 1,
            status: 'DRAFT',
          },
        });
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => null,
        },
      });

      await act(async () => {
        await useWorkspaceStore.getState().refine('test prompt');
      });

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Failed to refine idea');
      expect(state.isRefining).toBe(false);
    });
  });
});
