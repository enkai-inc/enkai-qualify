import { create } from 'zustand';

let loadAbortController: AbortController | null = null;

export interface IdeaFeature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface IdeaData {
  id: string;
  title: string;
  description: string;
  industry: string;
  targetMarket: string;
  technologies: string[];
  features: IdeaFeature[];
  currentVersion: number;
  status: 'PENDING' | 'DRAFT' | 'VALIDATED' | 'PACK_GENERATED' | 'ARCHIVED';
  metadata?: {
    githubIssue?: number;
    githubIssueUrl?: string;
    expertAnalysis?: {
      problemFinder?: {
        painClusters: Array<{ name: string; severity: string; description: string }>;
      };
      opportunitySpotter?: {
        concepts: Array<{ name: string; targetAudience: string; differentiator: string }>;
        recommended?: string;
      };
      solutionArchitect?: {
        mvpFeatures: string[];
        pricing?: string;
        timeToMvp?: string;
      };
    };
    nicheTree?: {
      levels: Array<{ level: number; name: string; estimatedTAM?: string }>;
      selectedLevel?: number;
    };
    landingPage?: {
      headline: string;
      subheadline: string;
      sections: Array<{ type: string; content: string }>;
      generatedAt?: string;
    };
  };
}

export interface IdeaVersion {
  id: string;
  ideaId: string;
  version: number;
  snapshot: IdeaData;
  summary: string;
  parentId: string | null;
  createdAt: string;
}

export interface ValidationData {
  id: string;
  ideaId: string;
  version: number;
  keywordScore: number;
  painPointScore: number;
  competitionScore: number;
  revenueEstimate: number;
  overallScore: number;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const POLL_INTERVAL_MS = 10_000;

interface WorkspaceState {
  idea: IdeaData | null;
  versions: IdeaVersion[];
  validation: ValidationData | null;
  isRefining: boolean;
  isValidating: boolean;
  isLoading: boolean;
  error: string | null;
  conversation: ConversationMessage[];
  isValidationPending: boolean;
  isRefinementPending: boolean;
  pollIntervalId: ReturnType<typeof setInterval> | null;
  pollErrorCount: number;
  hasConnectionError: boolean;
}

interface WorkspaceActions {
  loadIdea: (ideaId: string) => Promise<void>;
  refine: (prompt: string) => Promise<void>;
  validate: () => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  branchFromVersion: (versionId: string) => Promise<void>;
  updateFeature: (featureId: string, updates: Partial<IdeaFeature>) => void;
  addFeature: (feature: Omit<IdeaFeature, 'id'>) => void;
  removeFeature: (featureId: string) => void;
  clearError: () => void;
  reset: () => void;
  startPolling: (ideaId: string) => void;
  stopPolling: () => void;
}

const initialState: WorkspaceState = {
  idea: null,
  versions: [],
  validation: null,
  isRefining: false,
  isValidating: false,
  isLoading: false,
  error: null,
  conversation: [],
  isValidationPending: false,
  isRefinementPending: false,
  pollIntervalId: null,
  pollErrorCount: 0,
  hasConnectionError: false,
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, get) => ({
  ...initialState,

  startPolling: (ideaId: string) => {
    const { pollIntervalId } = get();
    if (pollIntervalId) return; // Already polling

    const id = setInterval(async () => {
      try {
        const response = await fetch(`/api/ideas/${ideaId}`);
        if (!response.ok) return;
        const data = await response.json();
        set({ pollErrorCount: 0, hasConnectionError: false });

        const state = get();
        const newValidation = data.validation || null;
        const newIdea = data.idea;

        // Detect validation completion: new validation record appeared
        if (state.isValidationPending && newValidation && !state.validation) {
          set({
            validation: newValidation,
            idea: newIdea,
            versions: data.versions || state.versions,
            isValidationPending: false,
            isValidating: false,
          });
          // Stop polling if refinement is also not pending
          if (!state.isRefinementPending) {
            get().stopPolling();
          }
          return;
        }

        // Detect refinement completion: version number increased
        if (state.isRefinementPending && newIdea && state.idea && newIdea.currentVersion > state.idea.currentVersion) {
          const assistantMessage: ConversationMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Idea refined successfully. The changes have been applied.',
            timestamp: new Date().toISOString(),
          };

          set({
            idea: newIdea,
            versions: data.versions || state.versions,
            validation: newValidation,
            isRefinementPending: false,
            isRefining: false,
            conversation: [...state.conversation, assistantMessage],
          });
          // Stop polling if validation is also not pending
          if (!state.isValidationPending) {
            get().stopPolling();
          }
          return;
        }
      } catch {
        const errorCount = get().pollErrorCount + 1;
        set({ pollErrorCount: errorCount, hasConnectionError: errorCount >= 3 });
      }
    }, POLL_INTERVAL_MS);

    set({ pollIntervalId: id });
  },

  stopPolling: () => {
    const { pollIntervalId } = get();
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      set({ pollIntervalId: null });
    }
  },

  loadIdea: async (ideaId: string) => {
    loadAbortController?.abort();
    loadAbortController = new AbortController();
    const signal = loadAbortController.signal;
    const timeoutId = setTimeout(() => loadAbortController?.abort(), 30000);

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/ideas/${ideaId}`, { signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error('Failed to load idea');
      }
      const data = await response.json();
      set({
        idea: data.idea,
        versions: data.versions || [],
        validation: data.validation || null,
        isLoading: false,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        // If the signal is still the current one, it was a timeout (not superseded by a new call)
        if (loadAbortController?.signal === signal) {
          set({ error: 'Request timed out. Please try again.', isLoading: false });
        }
        return;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.', isLoading: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to load idea',
        isLoading: false,
      });
    }
  },

  refine: async (prompt: string) => {
    const { idea, conversation } = get();
    if (!idea) return;

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    set({
      isRefining: true,
      conversation: [...conversation, userMessage],
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`RATE_LIMITED:${retryAfter || '60'}`);
        }
        throw new Error('Failed to refine idea');
      }

      const data = await response.json();

      if (data.status === 'pending') {
        // Async mode: add pending message, start polling
        const pendingMessage: ConversationMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Refinement submitted. Processing in the background...',
          timestamp: new Date().toISOString(),
        };
        set({
          isRefinementPending: true,
          conversation: [...get().conversation, pendingMessage],
        });
        get().startPolling(idea.id);
        return;
      }

      // Synchronous fallback (should not happen with new routes, but kept for safety)
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.summary || 'Idea refined successfully',
        timestamp: new Date().toISOString(),
      };

      set({
        idea: data.idea,
        versions: data.versions || get().versions,
        validation: data.validation || get().validation,
        isRefining: false,
        conversation: [...get().conversation, assistantMessage],
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isRefining: false });
        return;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.', isRefining: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to refine idea',
        isRefining: false,
      });
    }
  },

  validate: async () => {
    const { idea } = get();
    if (!idea) return;

    set({ isValidating: true, error: null });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`/api/ideas/${idea.id}/validate`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to validate idea');
      }

      const data = await response.json();

      if (data.status === 'pending') {
        // Async mode: start polling
        set({ isValidationPending: true });
        get().startPolling(idea.id);
        return;
      }

      // Synchronous fallback
      set({
        validation: data,
        isValidating: false,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isValidating: false });
        return;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.', isValidating: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to validate idea',
        isValidating: false,
      });
    }
  },

  restoreVersion: async (versionId: string) => {
    const { idea, versions } = get();
    if (!idea) return;

    set({ isLoading: true, error: null });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`/api/ideas/${idea.id}/versions/${versionId}/restore`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to restore version');
      }

      const data = await response.json();
      set({
        idea: data.idea,
        versions: data.versions || versions,
        validation: data.validation || null,
        isLoading: false,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isLoading: false });
        return;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.', isLoading: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to restore version',
        isLoading: false,
      });
    }
  },

  branchFromVersion: async (versionId: string) => {
    const { idea } = get();
    if (!idea) return;

    set({ isLoading: true, error: null });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`/api/ideas/${idea.id}/versions/${versionId}/branch`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to branch from version');
      }

      const data = await response.json();
      set({
        idea: data.idea,
        versions: data.versions,
        validation: data.validation || null,
        isLoading: false,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isLoading: false });
        return;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.', isLoading: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to branch from version',
        isLoading: false,
      });
    }
  },

  updateFeature: (featureId: string, updates: Partial<IdeaFeature>) => {
    const { idea } = get();
    if (!idea) return;

    const updatedFeatures = idea.features.map((f) =>
      f.id === featureId ? { ...f, ...updates } : f
    );

    set({
      idea: { ...idea, features: updatedFeatures },
    });
  },

  addFeature: (feature: Omit<IdeaFeature, 'id'>) => {
    const { idea } = get();
    if (!idea) return;

    const newFeature: IdeaFeature = {
      ...feature,
      id: crypto.randomUUID(),
    };

    set({
      idea: { ...idea, features: [...idea.features, newFeature] },
    });
  },

  removeFeature: (featureId: string) => {
    const { idea } = get();
    if (!idea) return;

    set({
      idea: {
        ...idea,
        features: idea.features.filter((f) => f.id !== featureId),
      },
    });
  },

  clearError: () => set({ error: null }),

  reset: () => {
    get().stopPolling();
    set(initialState);
  },
}));
