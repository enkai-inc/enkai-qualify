import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdeaCard } from '../IdeaCard';
import { IdeaSummary } from '@/lib/stores/ideasStore';

// Mock next/link since we're in a test environment
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockIdea: IdeaSummary = {
  id: 'test-idea-1',
  title: 'Test Idea',
  description: 'A test idea description',
  status: 'DRAFT' as IdeaSummary['status'],
  industry: 'technology',
  targetMarket: 'enterprise',
  currentVersion: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  latestValidation: null,
};

describe('IdeaCard', () => {
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    mockOnDelete.mockClear();
  });

  it('renders the idea title and description', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    expect(screen.getByText('Test Idea')).toBeInTheDocument();
    expect(screen.getByText('A test idea description')).toBeInTheDocument();
  });

  it('shows a Delete button', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not show confirmation dialog initially', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Delete this idea?')).not.toBeInTheDocument();
  });

  it('shows confirmation dialog when Delete button is clicked', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this idea?')).toBeInTheDocument();
  });

  it('shows Delete and Cancel buttons in the confirmation dialog', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    // After clicking, the confirmation overlay should show both buttons
    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onDelete when confirmation Delete button is clicked', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    // Both the original Delete button and the confirmation Delete button are present.
    // The confirmation Delete button is the one with the red background styling.
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    // Click the confirmation Delete button (the second one, inside the overlay)
    const confirmDeleteButton = deleteButtons.find(
      (btn) => btn.className.includes('bg-red-600')
    );
    expect(confirmDeleteButton).toBeDefined();
    fireEvent.click(confirmDeleteButton!);
    expect(mockOnDelete).toHaveBeenCalledWith('test-idea-1');
  });

  it('hides confirmation dialog when Cancel is clicked', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this idea?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete this idea?')).not.toBeInTheDocument();
  });

  it('does not call onDelete when Cancel is clicked', () => {
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('does not use browser confirm()', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
