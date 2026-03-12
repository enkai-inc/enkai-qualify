import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PainPointsPanel } from '../PainPointsPanel';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

beforeEach(() => {
  act(() => {
    useWorkspaceStore.getState().reset();
  });
});

const mockValidationWithPainPoints = {
  id: 'val-1',
  ideaId: 'idea-1',
  version: 1,
  keywordScore: 75,
  painPointScore: 80,
  competitionScore: 60,
  revenueEstimate: 70,
  overallScore: 72,
  details: {
    painPoints: [
      {
        category: 'Slow onboarding',
        quotes: ['It took me 3 hours to set up', 'The docs are terrible'],
        source: 'r/webdev',
        engagement: 142,
      },
      {
        category: 'Missing integrations',
        quotes: ['No Slack integration is a dealbreaker'],
        source: 'r/SaaS',
        engagement: 87,
      },
    ],
    redditThreadsAnalyzed: 45,
    totalQuotesCollected: 12,
  },
  createdAt: new Date().toISOString(),
};

const mockValidationWithoutPainPoints = {
  id: 'val-2',
  ideaId: 'idea-1',
  version: 1,
  keywordScore: 75,
  painPointScore: 80,
  competitionScore: 60,
  revenueEstimate: 70,
  overallScore: 72,
  details: {
    marketSize: '$5B',
    competitorCount: 12,
    feasibilityNotes: 'Feasible',
  },
  createdAt: new Date().toISOString(),
};

describe('PainPointsPanel', () => {
  it('renders nothing when validation is null', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: null });
    });

    const { container } = render(<PainPointsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when validation has no pain points', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithoutPainPoints });
    });

    const { container } = render(<PainPointsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel heading and summary when pain points exist', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithPainPoints });
    });

    render(<PainPointsPanel />);

    expect(screen.getByText('Customer Pain Points')).toBeInTheDocument();
    expect(screen.getByText(/12 quotes from 45 Reddit threads/)).toBeInTheDocument();
  });

  it('renders all pain point categories', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithPainPoints });
    });

    render(<PainPointsPanel />);

    expect(screen.getByText('Slow onboarding')).toBeInTheDocument();
    expect(screen.getByText('Missing integrations')).toBeInTheDocument();
  });

  it('shows quote count per category', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithPainPoints });
    });

    render(<PainPointsPanel />);

    expect(screen.getByText('2 quotes')).toBeInTheDocument();
    expect(screen.getByText('1 quotes')).toBeInTheDocument();
  });

  it('does not show quotes by default (collapsed)', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithPainPoints });
    });

    render(<PainPointsPanel />);

    expect(screen.queryByText(/It took me 3 hours/)).not.toBeInTheDocument();
  });

  it('expands a category to show quotes when clicked', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithPainPoints });
    });

    render(<PainPointsPanel />);

    const slowOnboardingButton = screen.getByText('Slow onboarding').closest('button')!;
    fireEvent.click(slowOnboardingButton);

    expect(screen.getByText(/It took me 3 hours to set up/)).toBeInTheDocument();
    expect(screen.getByText(/The docs are terrible/)).toBeInTheDocument();
  });

  it('collapses the category when clicked again', () => {
    act(() => {
      useWorkspaceStore.setState({ validation: mockValidationWithPainPoints });
    });

    render(<PainPointsPanel />);

    const slowOnboardingButton = screen.getByText('Slow onboarding').closest('button')!;

    // Expand
    fireEvent.click(slowOnboardingButton);
    expect(screen.getByText(/It took me 3 hours to set up/)).toBeInTheDocument();

    // Collapse
    fireEvent.click(slowOnboardingButton);
    expect(screen.queryByText(/It took me 3 hours to set up/)).not.toBeInTheDocument();
  });

  it('renders with zero counts gracefully', () => {
    act(() => {
      useWorkspaceStore.setState({
        validation: {
          ...mockValidationWithPainPoints,
          details: {
            painPoints: [
              { category: 'Empty category', quotes: [] },
            ],
            redditThreadsAnalyzed: 0,
            totalQuotesCollected: 0,
          },
        },
      });
    });

    render(<PainPointsPanel />);

    expect(screen.getByText(/0 quotes from 0 Reddit threads/)).toBeInTheDocument();
    expect(screen.getByText('0 quotes')).toBeInTheDocument();
  });
});
