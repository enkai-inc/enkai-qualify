import { create } from 'zustand';
import { IdeaStatus } from '@prisma/client';

export interface IdeaSummary {
  id: string;
  title: string;
  description: string;
  industry: string;
  targetMarket: string;
  status: IdeaStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  latestValidation: {
    overallScore: number;
  } | null;
}

interface IdeasState {
  ideas: IdeaSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: IdeaStatus;
    search?: string;
    sortBy: 'createdAt' | 'updatedAt' | 'title';
    sortOrder: 'asc' | 'desc';
  };
}

interface IdeasActions {
  fetchIdeas: () => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: Partial<IdeasState['filters']>) => void;
  deleteIdea: (id: string) => Promise<void>;
  reset: () => void;
}

const initialState: IdeasState = {
  ideas: [],
  total: 0,
  page: 1,
  pageSize: 12,
  hasMore: false,
  isLoading: false,
  error: null,
  filters: {
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  },
};

let fetchAbortController: AbortController | null = null;

export const useIdeasStore = create<IdeasState & IdeasActions>((set, get) => ({
  ...initialState,

  fetchIdeas: async () => {
    // Cancel any in-flight request
    if (fetchAbortController) {
      fetchAbortController.abort();
    }
    fetchAbortController = new AbortController();
    const currentController = fetchAbortController;

    const { page, pageSize, filters } = get();
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      if (filters.status) {
        params.set('status', filters.status);
      }
      if (filters.search) {
        params.set('search', filters.search);
      }

      const response = await fetch(`/api/ideas?${params}`, {
        signal: currentController.signal,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch ideas');
      }

      const data = await response.json();

      // Only apply if this is still the current request
      if (currentController === fetchAbortController) {
        set({
          ideas: data.items,
          total: data.total,
          hasMore: data.hasMore,
          isLoading: false,
        });
      }
    } catch (error) {
      // Ignore aborted requests
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      if (currentController === fetchAbortController) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch ideas',
          isLoading: false,
        });
      }
    }
  },

  setPage: (page: number) => {
    set({ page });
    get().fetchIdeas();
  },

  setFilters: (filters: Partial<IdeasState['filters']>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      page: 1, // Reset to first page on filter change
    }));
    get().fetchIdeas();
  },

  deleteIdea: async (id: string) => {
    try {
      const response = await fetch(`/api/ideas/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete idea');
      }

      // Remove from local state
      set((state) => ({
        ideas: state.ideas.filter((idea) => idea.id !== id),
        total: state.total - 1,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete idea',
      });
    }
  },

  reset: () => set(initialState),
}));
