import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ExpertAnalysisPanel } from '../ExpertAnalysisPanel';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

const baseIdea = {
  id: 'test-id',
  title: 'Test Idea',
  description: 'Test Description',
  industry: 'technology',
  targetMarket: 'enterprise',
  technologies: ['React'],
  features: [],
  currentVersion: 1,
  status: 'DRAFT' as const,
};

beforeEach(() => {
  act(() => {
    useWorkspaceStore.getState().reset();
  });
});

describe('ExpertAnalysisPanel', () => {
  it('renders nothing when idea has no metadata', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: { ...baseIdea } });
    });

    const { container } = render(<ExpertAnalysisPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when metadata has no expertAnalysis', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: { ...baseIdea, metadata: { githubIssue: 42 } },
      });
    });

    const { container } = render(<ExpertAnalysisPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders expert buttons when expertAnalysis is present', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          metadata: {
            expertAnalysis: {
              problemFinder: {
                painClusters: [{ name: 'Auth Pain', severity: 'high', description: 'Login is hard' }],
              },
              opportunitySpotter: {
                concepts: [{ name: 'AuthEase', targetAudience: 'SMBs', differentiator: 'One-click' }],
              },
              solutionArchitect: {
                mvpFeatures: ['SSO', 'OAuth'],
              },
            },
          },
        },
      });
    });

    render(<ExpertAnalysisPanel />);

    expect(screen.getByText('Expert Analysis')).toBeInTheDocument();
    expect(screen.getByText('Problem Finder')).toBeInTheDocument();
    expect(screen.getByText('Opportunity Spotter')).toBeInTheDocument();
    expect(screen.getByText('Solution Architect')).toBeInTheDocument();
  });

  it('shows problemFinder pain clusters when clicked', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          metadata: {
            expertAnalysis: {
              problemFinder: {
                painClusters: [
                  { name: 'Auth Pain', severity: 'high', description: 'Login is hard' },
                  { name: 'Data Loss', severity: 'medium', description: 'No backups' },
                ],
              },
            },
          },
        },
      });
    });

    render(<ExpertAnalysisPanel />);

    // Content should not be visible initially
    expect(screen.queryByText('Pain Clusters')).not.toBeInTheDocument();

    // Click Problem Finder button
    fireEvent.click(screen.getByText('Problem Finder'));

    expect(screen.getByText('Pain Clusters')).toBeInTheDocument();
    expect(screen.getByText('Auth Pain')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Login is hard')).toBeInTheDocument();
    expect(screen.getByText('Data Loss')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('shows opportunitySpotter concepts when clicked', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          metadata: {
            expertAnalysis: {
              opportunitySpotter: {
                concepts: [
                  { name: 'AuthEase', targetAudience: 'SMBs', differentiator: 'One-click' },
                  { name: 'SecureFlow', targetAudience: 'Enterprise', differentiator: 'Zero-trust' },
                ],
                recommended: 'AuthEase',
              },
            },
          },
        },
      });
    });

    render(<ExpertAnalysisPanel />);

    fireEvent.click(screen.getByText('Opportunity Spotter'));

    expect(screen.getByText('Product Concepts')).toBeInTheDocument();
    expect(screen.getByText('AuthEase')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('SecureFlow')).toBeInTheDocument();
    expect(screen.getByText('Target: SMBs')).toBeInTheDocument();
    expect(screen.getByText('Differentiator: One-click')).toBeInTheDocument();
  });

  it('shows solutionArchitect details when clicked', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          metadata: {
            expertAnalysis: {
              solutionArchitect: {
                mvpFeatures: ['SSO Integration', 'OAuth Provider'],
                pricing: '$29/mo',
                timeToMvp: '6 weeks',
              },
            },
          },
        },
      });
    });

    render(<ExpertAnalysisPanel />);

    fireEvent.click(screen.getByText('Solution Architect'));

    expect(screen.getByText('MVP Features')).toBeInTheDocument();
    expect(screen.getByText('SSO Integration')).toBeInTheDocument();
    expect(screen.getByText('OAuth Provider')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('$29/mo')).toBeInTheDocument();
    expect(screen.getByText('Time to MVP')).toBeInTheDocument();
    expect(screen.getByText('6 weeks')).toBeInTheDocument();
  });

  it('toggles expert panel off when clicking the same button', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          metadata: {
            expertAnalysis: {
              problemFinder: {
                painClusters: [{ name: 'Auth Pain', severity: 'high', description: 'Login is hard' }],
              },
            },
          },
        },
      });
    });

    render(<ExpertAnalysisPanel />);

    // Click to open
    fireEvent.click(screen.getByText('Problem Finder'));
    expect(screen.getByText('Pain Clusters')).toBeInTheDocument();

    // Click again to close
    fireEvent.click(screen.getByText('Problem Finder'));
    expect(screen.queryByText('Pain Clusters')).not.toBeInTheDocument();
  });

  it('renders nothing when expertAnalysis has only empty/null entries', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          metadata: {
            expertAnalysis: {},
          },
        },
      });
    });

    const { container } = render(<ExpertAnalysisPanel />);
    expect(container.firstChild).toBeNull();
  });
});
