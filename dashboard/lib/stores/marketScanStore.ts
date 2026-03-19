import { create } from 'zustand';

export interface MarketOpportunity {
  rank: number;
  title: string;
  description: string;
  problemStatement: string;
  demandSignals: string[];
  score: number;
  keywords: string[];
  monthlySearchVolume: number;
  competition: 'low' | 'medium' | 'high';
  trendDirection: 'rising' | 'stable' | 'declining';
  estimatedRevenue: string;
  sources: string[];
}

export interface MarketScanSummary {
  id: string;
  industry: string;
  niche: string | null;
  status: string;
  opportunityCount: number;
  createdAt: string;
}

export interface MarketScanDetail {
  id: string;
  industry: string;
  niche: string | null;
  status: string;
  opportunities: MarketOpportunity[];
  metadata: Record<string, unknown> | null;
  githubIssue: number | null;
  githubIssueUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_INTERVAL_MS = 60_000;

interface MarketScanState {
  scans: MarketScanSummary[];
  currentScan: MarketScanDetail | null;
  isCreating: boolean;
  isLoading: boolean;
  error: string | null;
  pollIntervalId: ReturnType<typeof setTimeout> | null;
  pollErrorCount: number;
}

interface MarketScanActions {
  fetchScans: () => Promise<void>;
  startScan: (industry: string, niche?: string) => Promise<string | null>;
  loadScan: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
  reset: () => void;
}

const initialState: MarketScanState = {
  scans: [],
  currentScan: null,
  isCreating: false,
  isLoading: false,
  error: null,
  pollIntervalId: null,
  pollErrorCount: 0,
};

export const useMarketScanStore = create<MarketScanState & MarketScanActions>((set, get) => ({
  ...initialState,

  fetchScans: async () => {
    set({ isLoading: true, error: null });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/market-scans', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Failed to fetch market scans');
      const data = await response.json();
      set({ scans: data.scans, isLoading: false });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isLoading: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch market scans',
        isLoading: false,
      });
    }
  },

  startScan: async (industry: string, niche?: string) => {
    set({ isCreating: true, error: null });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('/api/ideas/market-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, niche: niche || undefined }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = 'Failed to start market scan';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response wasn't JSON — use default message
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      set({ isCreating: false });
      return data.id;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isCreating: false });
        return null;
      }
      if (error instanceof TypeError) {
        set({ error: 'Network error. Please check your connection.', isCreating: false });
        return null;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to start market scan',
        isCreating: false,
      });
      return null;
    }
  },

  loadScan: async (id: string) => {
    set({ isLoading: true, error: null });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`/api/market-scans/${id}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Failed to load market scan');
      const data = await response.json();
      set({ currentScan: data, isLoading: false });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ error: 'Request timed out. Please try again.', isLoading: false });
        return;
      }
      set({
        error: error instanceof Error ? error.message : 'Failed to load market scan',
        isLoading: false,
      });
    }
  },

  startPolling: (id: string) => {
    const { pollIntervalId } = get();
    if (pollIntervalId) return;

    const schedulePoll = () => {
      const errorCount = get().pollErrorCount;
      const interval = errorCount >= 3
        ? Math.min(POLL_INTERVAL_MS * Math.pow(2, errorCount - 2), MAX_POLL_INTERVAL_MS)
        : POLL_INTERVAL_MS;

      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/market-scans/${id}`);
          if (!response.ok) {
            const ec = get().pollErrorCount + 1;
            set({ pollErrorCount: ec });
            if (get().pollIntervalId) schedulePoll();
            return;
          }
          const data = await response.json();
          set({ currentScan: data, pollErrorCount: 0 });

          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            get().stopPolling();
            return;
          }
        } catch {
          const ec = get().pollErrorCount + 1;
          set({ pollErrorCount: ec });
        }

        if (get().pollIntervalId) schedulePoll();
      }, interval);

      set({ pollIntervalId: timeoutId });
    };

    schedulePoll();
  },

  stopPolling: () => {
    const { pollIntervalId } = get();
    if (pollIntervalId) {
      clearTimeout(pollIntervalId);
      set({ pollIntervalId: null, pollErrorCount: 0 });
    }
  },

  reset: () => {
    get().stopPolling();
    set(initialState);
  },
}));
