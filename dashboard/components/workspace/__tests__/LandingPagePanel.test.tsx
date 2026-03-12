import '@testing-library/jest-dom';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { LandingPagePanel } from '../LandingPagePanel';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

const mockIdea = {
  id: 'idea-1',
  title: 'Test Idea',
  description: 'A test idea',
  industry: 'tech',
  targetMarket: 'developers',
  technologies: [],
  features: [],
  currentVersion: 1,
  status: 'VALIDATED' as const,
};

const mockLandingPage = {
  headline: 'Build Better Products',
  subheadline: 'AI-powered validation for your next big idea',
  generatedAt: '2026-03-10T12:00:00.000Z',
  sections: [
    { type: 'Features', content: 'Instant validation\nMarket analysis\nCompetitor tracking' },
    { type: 'Social Proof', content: 'Trusted by 1000+ founders worldwide' },
  ],
};

const writeTextMock = jest.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  writeTextMock.mockResolvedValue(undefined);
  act(() => {
    useWorkspaceStore.getState().reset();
  });
});

describe('LandingPagePanel', () => {
  it('renders nothing when idea has no landing page metadata', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        isLoading: false,
      });
    });

    const { container } = render(<LandingPagePanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when idea is null', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: null,
        isLoading: false,
      });
    });

    const { container } = render(<LandingPagePanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the headline and subheadline from landing page data', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: mockLandingPage },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByText('Build Better Products')).toBeInTheDocument();
    expect(screen.getByText('AI-powered validation for your next big idea')).toBeInTheDocument();
  });

  it('renders the panel title', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: mockLandingPage },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByText('Landing Page Blueprint')).toBeInTheDocument();
  });

  it('renders the generated date', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: mockLandingPage },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByText(/Generated/)).toBeInTheDocument();
  });

  it('renders all sections with type badges and content', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: mockLandingPage },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Social Proof')).toBeInTheDocument();
    expect(screen.getByText(/Instant validation/)).toBeInTheDocument();
    expect(screen.getByText('Trusted by 1000+ founders worldwide')).toBeInTheDocument();
  });

  it('renders the Copy to Clipboard button', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: mockLandingPage },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
  });

  it('copies formatted text and shows Copied! on button click', async () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: mockLandingPage },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    const button = screen.getByRole('button', { name: /copy to clipboard/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('# Build Better Products');
    expect(copiedText).toContain('## AI-powered validation for your next big idea');
    expect(copiedText).toContain('### Features');
    expect(copiedText).toContain('### Social Proof');

    expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument();
  });

  it('handles landing page without generatedAt gracefully', () => {
    const lpWithoutDate = { ...mockLandingPage, generatedAt: undefined };

    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: lpWithoutDate },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByText('Build Better Products')).toBeInTheDocument();
    expect(screen.queryByText(/Generated/)).not.toBeInTheDocument();
  });

  it('handles landing page without sections gracefully', () => {
    const lpWithoutSections = {
      headline: 'No Sections',
      subheadline: 'Just a headline',
      sections: [],
    };

    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...mockIdea,
          metadata: { landingPage: lpWithoutSections },
        },
        isLoading: false,
      });
    });

    render(<LandingPagePanel />);

    expect(screen.getByText('No Sections')).toBeInTheDocument();
    expect(screen.getByText('Just a headline')).toBeInTheDocument();
  });
});
