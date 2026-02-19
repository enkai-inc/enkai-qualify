import { act } from '@testing-library/react';
import { useCreateIdeaStore } from '../createIdeaStore';

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

describe('createIdeaStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useCreateIdeaStore.getState().reset();
    });
  });

  describe('generateIdea - re-entrancy guard', () => {
    it('should not call fetch when isGenerating is already true', async () => {
      // Pre-set isGenerating to true to simulate an in-flight request
      act(() => {
        useCreateIdeaStore.setState({ isGenerating: true });
      });

      await act(async () => {
        await useCreateIdeaStore.getState().generateIdea();
      });

      // fetch should NOT have been called since isGenerating was already true
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should allow generateIdea when isGenerating is false', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          generated: {
            title: 'Test Idea',
            description: 'A test idea',
            features: [],
            technologies: ['TypeScript'],
            marketAnalysis: 'Good market',
          },
        })
      );

      act(() => {
        useCreateIdeaStore.setState({
          industry: 'tech',
          targetMarket: 'developers',
          problemDescription: 'testing problem',
          isGenerating: false,
        });
      });

      await act(async () => {
        await useCreateIdeaStore.getState().generateIdea();
      });

      // fetch SHOULD have been called since isGenerating was false
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should prevent double-fire from React StrictMode', async () => {
      // Simulate a slow response that takes time to resolve
      let resolveFirst: (value: unknown) => void;
      const firstResponse = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      mockFetch.mockReturnValueOnce(firstResponse);
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          generated: {
            title: 'Second Idea',
            description: 'Duplicate',
            features: [],
            technologies: [],
            marketAnalysis: '',
          },
        })
      );

      act(() => {
        useCreateIdeaStore.setState({
          industry: 'tech',
          targetMarket: 'developers',
          problemDescription: 'test problem',
          isGenerating: false,
        });
      });

      // Fire first call (do not await - simulates StrictMode double-fire)
      const first = useCreateIdeaStore.getState().generateIdea();

      // Fire second call immediately (StrictMode double-fire)
      const second = useCreateIdeaStore.getState().generateIdea();

      // Resolve the first response
      resolveFirst!(
        mockResponse({
          generated: {
            title: 'First Idea',
            description: 'Original',
            features: [],
            technologies: [],
            marketAnalysis: '',
          },
        })
      );

      await act(async () => {
        await first;
        await second;
      });

      // Only ONE fetch call should have been made due to the guard
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
