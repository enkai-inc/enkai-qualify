import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { ValidationPanel } from '../ValidationPanel';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { act } from '@testing-library/react';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockIdea = {
  id: 'idea-1',
  title: 'Test Idea',
  description: 'A test idea',
  industry: 'tech',
  targetMarket: 'developers',
  technologies: [],
  features: [],
  currentVersion: 1,
  status: 'DRAFT' as const,
};

const baseValidation = {
  id: 'val-1',
  ideaId: 'idea-1',
  version: 1,
  keywordScore: 75,
  painPointScore: 80,
  competitionScore: 60,
  revenueEstimate: 70,
  overallScore: 72,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    useWorkspaceStore.getState().reset();
  });
});

describe('ValidationPanel - Keyword Research section', () => {
  it('renders keyword research section when keywords are present', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            keywordResearch: {
              totalMonthlyVolume: 45000,
              source: 'Google Keyword Planner',
              keywords: [
                { term: 'saas analytics', monthlyVolume: 12000, competition: 'medium' },
                { term: 'business intelligence tool', monthlyVolume: 8000, competition: 'high' },
                { term: 'startup metrics', monthlyVolume: 5000, competition: 'low' },
              ],
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText('Keyword Research')).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
    expect(screen.getByText(/Google Keyword Planner/)).toBeInTheDocument();
    expect(screen.getByText('saas analytics')).toBeInTheDocument();
    expect(screen.getByText('12,000')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('business intelligence tool')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('does not render keyword section when keywords array is empty', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            keywordResearch: {
              totalMonthlyVolume: 0,
              keywords: [],
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.queryByText('Keyword Research')).not.toBeInTheDocument();
  });

  it('limits keywords display to 6 items', () => {
    const keywords = Array.from({ length: 10 }, (_, i) => ({
      term: `keyword-${i}`,
      monthlyVolume: 1000 * (10 - i),
    }));

    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            keywordResearch: {
              totalMonthlyVolume: 55000,
              keywords,
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    // First 6 should be present
    for (let i = 0; i < 6; i++) {
      expect(screen.getByText(`keyword-${i}`)).toBeInTheDocument();
    }
    // 7th+ should not
    expect(screen.queryByText('keyword-6')).not.toBeInTheDocument();
    expect(screen.queryByText('keyword-9')).not.toBeInTheDocument();
  });

  it('shows default source when source is not provided', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            keywordResearch: {
              totalMonthlyVolume: 10000,
              keywords: [{ term: 'test keyword', monthlyVolume: 5000 }],
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText(/AI Estimate/)).toBeInTheDocument();
  });

  it('applies correct color classes to competition badges', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            keywordResearch: {
              totalMonthlyVolume: 25000,
              keywords: [
                { term: 'low comp', monthlyVolume: 5000, competition: 'low' },
                { term: 'med comp', monthlyVolume: 5000, competition: 'medium' },
                { term: 'high comp', monthlyVolume: 5000, competition: 'high' },
              ],
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    const lowBadge = screen.getByText('low');
    expect(lowBadge.className).toContain('bg-green-100');
    expect(lowBadge.className).toContain('text-green-700');

    const medBadge = screen.getByText('medium');
    expect(medBadge.className).toContain('bg-yellow-100');
    expect(medBadge.className).toContain('text-yellow-700');

    const highBadge = screen.getByText('high');
    expect(highBadge.className).toContain('bg-red-100');
    expect(highBadge.className).toContain('text-red-700');
  });
});

describe('ValidationPanel - Trend Analysis section', () => {
  it('renders trend analysis with rising direction', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            trendAnalysis: {
              direction: 'rising',
              stability: 'consistent',
              fiveYearChange: '+45%',
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
    expect(screen.getByText('rising')).toBeInTheDocument();
    expect(screen.getByText('(consistent)')).toBeInTheDocument();
    expect(screen.getByText('+45% (5yr)')).toBeInTheDocument();
  });

  it('renders trend analysis with declining direction', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            trendAnalysis: {
              direction: 'declining',
              fiveYearChange: '-20%',
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText('declining')).toBeInTheDocument();
    expect(screen.getByText('-20% (5yr)')).toBeInTheDocument();
  });

  it('renders stable trend with correct emoji', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            trendAnalysis: {
              direction: 'stable',
            },
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText('stable')).toBeInTheDocument();
  });

  it('does not render trend section when trendAnalysis is absent', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: { marketSize: '$1B' },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.queryByText('Trend Analysis')).not.toBeInTheDocument();
  });
});

describe('ValidationPanel - Recommendation section', () => {
  it('renders recommendation when present', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            recommendation: 'Strong market opportunity with growing demand. Consider focusing on the enterprise segment.',
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(screen.getByText(/Strong market opportunity/)).toBeInTheDocument();
  });

  it('does not render recommendation when absent', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {},
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.queryByText('Recommendation')).not.toBeInTheDocument();
  });
});

describe('ValidationPanel - MVP Features section', () => {
  it('renders MVP features list when present', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            mvpFeatures: [
              'User authentication and onboarding',
              'Dashboard with key metrics',
              'Data export functionality',
            ],
          },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.getByText('Recommended MVP Features')).toBeInTheDocument();
    expect(screen.getByText('User authentication and onboarding')).toBeInTheDocument();
    expect(screen.getByText('Dashboard with key metrics')).toBeInTheDocument();
    expect(screen.getByText('Data export functionality')).toBeInTheDocument();
  });

  it('does not render MVP features when array is empty', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: { mvpFeatures: [] },
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.queryByText('Recommended MVP Features')).not.toBeInTheDocument();
  });

  it('does not render MVP features when absent', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {},
        },
      });
    });

    render(<ValidationPanel />);

    expect(screen.queryByText('Recommended MVP Features')).not.toBeInTheDocument();
  });
});

describe('ValidationPanel - existing functionality preserved', () => {
  it('still renders score cards and analysis details alongside new sections', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
        validation: {
          ...baseValidation,
          details: {
            marketSize: '$5B',
            competitorCount: 12,
            feasibilityNotes: 'Technically feasible',
            keywordResearch: {
              totalMonthlyVolume: 30000,
              keywords: [{ term: 'test kw', monthlyVolume: 10000, competition: 'low' }],
            },
            trendAnalysis: { direction: 'rising', fiveYearChange: '+30%' },
            recommendation: 'Go for it',
            mvpFeatures: ['Feature 1'],
          },
        },
      });
    });

    render(<ValidationPanel />);

    // Existing content
    expect(screen.getByText('Validation Score')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Analysis Details')).toBeInTheDocument();
    expect(screen.getByText(/\$5B/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/Technically feasible/)).toBeInTheDocument();

    // New content
    expect(screen.getByText('Keyword Research')).toBeInTheDocument();
    expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(screen.getByText('Recommended MVP Features')).toBeInTheDocument();
  });
});
