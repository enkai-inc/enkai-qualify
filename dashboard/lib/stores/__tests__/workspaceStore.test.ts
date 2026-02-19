import { useWorkspaceStore } from '../workspaceStore';
import { act } from '@testing-library/react';

// Polyfill crypto.randomUUID for jsdom
if (!global.crypto?.randomUUID) {
  Object.defineProperty(global, 'crypto', {
    value: {
      ...global.crypto,
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
    },
  });
}

// Reset the store before each test
beforeEach(() => {
  act(() => {
    useWorkspaceStore.getState().reset();
  });
});

describe('workspaceStore refine', () => {
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
    global.fetch = jest.fn().mockResolvedValue({
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

    global.fetch = jest.fn().mockResolvedValue({
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

    global.fetch = jest.fn().mockResolvedValue({
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
