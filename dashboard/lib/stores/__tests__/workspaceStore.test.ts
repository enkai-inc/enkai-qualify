import { act } from '@testing-library/react';
import { useWorkspaceStore } from '../workspaceStore';

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
});
