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
  details: {
    marketSize?: string;
    competitorCount?: number;
    feasibilityNotes?: string;
  };
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface WorkspaceState {
  idea: IdeaData | null;
  versions: IdeaVersion[];
  validation: ValidationData | null;
  isRefining: boolean;
  isLoading: boolean;
  error: string | null;
  conversation: ConversationMessage[];
}

interface WorkspaceActions {
  loadIdea: (ideaId: string) => Promise<void>;
  refine: (prompt: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  branchFromVersion: (versionId: string) => Promise<void>;
  updateFeature: (featureId: string, updates: Partial<IdeaFeature>) => void;
  addFeature: (feature: Omit<IdeaFeature, 'id'>) => void;
  removeFeature: (featureId: string) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState: WorkspaceState = {
  idea: null,
  versions: [],
  validation: null,
  isRefining: false,
  isLoading: false,
  error: null,
  conversation: [],
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, get) => ({
  ...initialState,

  loadIdea: async (ideaId: string) => {
    loadAbortController?.abort();
    loadAbortController = new AbortController();
    const signal = loadAbortController.signal;

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/ideas/${ideaId}`, { signal });
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
      if (error instanceof DOMException && error.name === 'AbortError') return;
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

    try {
      const response = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`RATE_LIMITED:${retryAfter || '60'}`);
        }
        throw new Error('Failed to refine idea');
      }

      const data = await response.json();

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
      set({
        error: error instanceof Error ? error.message : 'Failed to refine idea',
        isRefining: false,
      });
    }
  },

  restoreVersion: async (versionId: string) => {
    const { idea, versions } = get();
    if (!idea) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/ideas/${idea.id}/versions/${versionId}/restore`, {
        method: 'POST',
      });

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

    try {
      const response = await fetch(`/api/ideas/${idea.id}/versions/${versionId}/branch`, {
        method: 'POST',
      });

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

  reset: () => set(initialState),
}));
