import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import IdeasPage from '../page';
import { useIdeasStore } from '@/lib/stores/ideasStore';

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock IdeaCard component
jest.mock('@/components/ideas/IdeaCard', () => ({
  IdeaCard: ({ idea }: { idea: { title: string } }) => (
    <div data-testid="idea-card">{idea.title}</div>
  ),
}));

// Mock IdeaFilters component
jest.mock('@/components/ideas/IdeaFilters', () => ({
  IdeaFilters: () => <div data-testid="idea-filters" />,
}));

// Mock the ideas store
jest.mock('@/lib/stores/ideasStore');
const mockUseIdeasStore = useIdeasStore as unknown as jest.Mock;

const mockIdeas = [
  {
    id: '1',
    title: 'Idea One',
    description: 'Desc 1',
    status: 'DRAFT',
    industry: 'tech',
    targetMarket: 'enterprise',
    currentVersion: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    latestValidation: null,
  },
  {
    id: '2',
    title: 'Idea Two',
    description: 'Desc 2',
    status: 'DRAFT',
    industry: 'tech',
    targetMarket: 'enterprise',
    currentVersion: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    latestValidation: null,
  },
];

const defaultStoreState = {
  ideas: mockIdeas,
  total: 25,
  page: 2,
  pageSize: 12,
  hasMore: true,
  isLoading: false,
  error: null,
  filters: { sortBy: 'updatedAt', sortOrder: 'desc' },
  fetchIdeas: jest.fn(),
  setPage: jest.fn(),
  setFilters: jest.fn(),
  deleteIdea: jest.fn(),
};

describe('IdeasPage pagination loading states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enables both pagination buttons when not loading', () => {
    mockUseIdeasStore.mockReturnValue({ ...defaultStoreState });
    render(<IdeasPage />);

    const prevButton = screen.getByRole('button', { name: 'Previous' });
    const nextButton = screen.getByRole('button', { name: 'Next' });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('disables Previous button when loading', () => {
    mockUseIdeasStore.mockReturnValue({
      ...defaultStoreState,
      isLoading: true,
    });
    render(<IdeasPage />);

    const prevButton = screen.getByRole('button', { name: 'Previous' });
    expect(prevButton).toBeDisabled();
  });

  it('disables Next button when loading', () => {
    mockUseIdeasStore.mockReturnValue({
      ...defaultStoreState,
      isLoading: true,
    });
    render(<IdeasPage />);

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('disables Previous button when on first page even without loading', () => {
    mockUseIdeasStore.mockReturnValue({
      ...defaultStoreState,
      page: 1,
    });
    render(<IdeasPage />);

    const prevButton = screen.getByRole('button', { name: 'Previous' });
    expect(prevButton).toBeDisabled();
  });

  it('disables Next button when hasMore is false even without loading', () => {
    mockUseIdeasStore.mockReturnValue({
      ...defaultStoreState,
      hasMore: false,
    });
    render(<IdeasPage />);

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('shows loading overlay on ideas grid when loading with existing ideas', () => {
    mockUseIdeasStore.mockReturnValue({
      ...defaultStoreState,
      isLoading: true,
    });
    const { container } = render(<IdeasPage />);

    // The loading spinner should be present
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('does not show loading overlay when not loading', () => {
    mockUseIdeasStore.mockReturnValue({
      ...defaultStoreState,
      isLoading: false,
    });
    const { container } = render(<IdeasPage />);

    // There should be no spinner overlay in the ideas grid
    const overlay = container.querySelector('.bg-white\\/50');
    expect(overlay).not.toBeInTheDocument();
  });
});
