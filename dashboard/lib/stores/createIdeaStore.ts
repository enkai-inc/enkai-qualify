import { create } from 'zustand';

export interface GeneratedIdea {
  title: string;
  description: string;
  features: Array<{
    id: string;
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  technologies: string[];
  marketAnalysis: string;
}

interface PendingIdea {
  id: string;
  status: 'PENDING';
  message: string;
  githubIssue: number;
  githubIssueUrl: string;
}

interface CreateIdeaState {
  step: number;
  // Step 1: Industry & Market
  industry: string;
  targetMarket: string;
  // Step 2: Problem
  problemDescription: string;
  // Step 3: Generated (or pending)
  generatedIdea: GeneratedIdea | null;
  pendingIdea: PendingIdea | null;
  isGenerating: boolean;
  // Step 4: Review & Edit
  editedIdea: GeneratedIdea | null;
  // Status
  error: string | null;
  isSaving: boolean;
}

interface CreateIdeaActions {
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setIndustry: (industry: string) => void;
  setTargetMarket: (market: string) => void;
  setProblemDescription: (description: string) => void;
  generateIdea: () => Promise<void>;
  setEditedIdea: (idea: GeneratedIdea) => void;
  updateEditedFeature: (
    featureId: string,
    updates: Partial<GeneratedIdea['features'][0]>
  ) => void;
  addFeature: (feature: Omit<GeneratedIdea['features'][0], 'id'>) => void;
  removeFeature: (featureId: string) => void;
  saveIdea: () => Promise<string | null>;
  reset: () => void;
  clearError: () => void;
}

const initialState: CreateIdeaState = {
  step: 1,
  industry: '',
  targetMarket: '',
  problemDescription: '',
  generatedIdea: null,
  pendingIdea: null,
  isGenerating: false,
  editedIdea: null,
  error: null,
  isSaving: false,
};

export const useCreateIdeaStore = create<CreateIdeaState & CreateIdeaActions>(
  (set, get) => ({
    ...initialState,

    setStep: (step) => set({ step }),

    nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 4) })),

    prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),

    setIndustry: (industry) => set({ industry }),

    setTargetMarket: (targetMarket) => set({ targetMarket }),

    setProblemDescription: (problemDescription) => set({ problemDescription }),

    generateIdea: async () => {
      if (get().isGenerating) return;
      const { industry, targetMarket, problemDescription } = get();

      set({ isGenerating: true, error: null, pendingIdea: null });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch('/api/ideas/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            industry,
            targetMarket,
            problemDescription,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate idea');
        }

        const data = await response.json();

        // Check if this is a pending (async) response or immediate generation
        if (data.idea?.status === 'PENDING') {
          // Async flow: idea is queued for processing
          set({
            pendingIdea: data.idea,
            isGenerating: false,
            step: 4, // Go to "queued" review step
          });
        } else if (data.generated) {
          // Immediate generation (legacy flow)
          set({
            generatedIdea: data.generated,
            editedIdea: data.generated,
            isGenerating: false,
            step: 4,
          });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof DOMException && error.name === 'AbortError') {
          set({ error: 'Request timed out. Please try again.', isGenerating: false });
          return;
        }
        if (error instanceof TypeError) {
          set({ error: 'Network error. Please check your connection.', isGenerating: false });
          return;
        }
        set({
          error:
            error instanceof Error ? error.message : 'Failed to generate idea',
          isGenerating: false,
        });
      }
    },

    setEditedIdea: (idea) => set({ editedIdea: idea }),

    updateEditedFeature: (featureId, updates) => {
      const { editedIdea } = get();
      if (!editedIdea) return;

      set({
        editedIdea: {
          ...editedIdea,
          features: editedIdea.features.map((f) =>
            f.id === featureId ? { ...f, ...updates } : f
          ),
        },
      });
    },

    addFeature: (feature) => {
      const { editedIdea } = get();
      if (!editedIdea) return;

      set({
        editedIdea: {
          ...editedIdea,
          features: [
            ...editedIdea.features,
            { ...feature, id: crypto.randomUUID() },
          ],
        },
      });
    },

    removeFeature: (featureId) => {
      const { editedIdea } = get();
      if (!editedIdea) return;

      set({
        editedIdea: {
          ...editedIdea,
          features: editedIdea.features.filter((f) => f.id !== featureId),
        },
      });
    },

    saveIdea: async () => {
      const { industry, targetMarket, editedIdea, pendingIdea } = get();

      // If we have a pending idea, just return its ID (it's already saved)
      if (pendingIdea) {
        return pendingIdea.id;
      }

      if (!editedIdea) return null;

      set({ isSaving: true, error: null });

      try {
        const response = await fetch('/api/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editedIdea.title,
            description: editedIdea.description,
            industry,
            targetMarket,
            technologies: editedIdea.technologies,
            features: editedIdea.features,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save idea');
        }

        const idea = await response.json();
        set({ isSaving: false });
        return idea.id;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to save idea',
          isSaving: false,
        });
        return null;
      }
    },

    reset: () => set(initialState),

    clearError: () => set({ error: null }),
  })
);
