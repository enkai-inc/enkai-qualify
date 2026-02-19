import { create } from 'zustand';
import { IdeaStatus } from '@prisma/client';

let fetchAbortController: AbortController | null = null;

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

export const useIdeasStore = create<IdeasState & IdeasActions>((set, get) => ({
  ...initialState,

  fetchIdeas: async () => {
    // Assign new controller BEFORE aborting old one to close race window
    const previousController = fetchAbortController;
    const controller = new AbortController();
    fetchAbortController = controller;
    previousController?.abort();
    const signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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

      const response = await fetch(`/api/ideas?${params}`, { signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error('Failed to fetch ideas');
      }

      const data = await response.json();

      // Only apply if this is still the current request
      if (controller === fetchAbortController) {
        set({
          ideas: data.items,
          total: data.total,
          hasMore: data.hasMore,
          isLoading: false,
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        // If the signal is still the current one, it was a timeout (not superseded by a new call)
        if (controller === fetchAbortController) {
          set({ error: 'Request timed out. Please try again.', isLoading: false });
        }
        return;
      }
      if (controller === fetchAbortController) {
        if (error instanceof TypeError) {
          set({ error: 'Network error. Please check your connection.', isLoading: false });
          return;
        }
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`/api/ideas/${id}`, {
        method: 'DELETE',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to delete idea');
      }

      // Remove from local state
      set((state) => ({
        ideas: state.ideas.filter((idea) => idea.id !== id),
        total: state.total - 1,
      }));
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.' });
        return;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.' });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to delete idea',
      });
    }
  },

  reset: () => set(initialState),
}));
