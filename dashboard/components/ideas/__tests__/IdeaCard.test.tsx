import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IdeaCard } from '../IdeaCard';
import { IdeaSummary } from '@/lib/stores/ideasStore';

// Mock next/link since we're in a test environment
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
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
  const mockOnDelete = jest.fn<Promise<void>, [string]>();

  beforeEach(() => {
    mockOnDelete.mockClear();
    mockOnDelete.mockResolvedValue(undefined);
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

  it('calls onDelete when confirmation Delete button is clicked', async () => {
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
    await act(async () => {
      fireEvent.click(confirmDeleteButton!);
    });
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

  it('shows "Deleting..." text and disables button while delete is in progress', async () => {
    let resolveDelete: () => void;
    mockOnDelete.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve; })
    );

    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));

    const confirmDeleteButton = screen.getAllByRole('button', { name: 'Delete' }).find(
      (btn) => btn.className.includes('bg-red-600')
    )!;

    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // While the promise is pending, the button should show "Deleting..." and be disabled
    expect(screen.getByText('Deleting...')).toBeInTheDocument();
    const deletingButton = screen.getByText('Deleting...').closest('button');
    expect(deletingButton).toBeDisabled();

    // Resolve the promise
    await act(async () => {
      resolveDelete!();
    });

    // After resolution, the confirmation dialog should be closed
    expect(screen.queryByText('Delete this idea?')).not.toBeInTheDocument();
  });

  it('shows error message when delete fails and keeps dialog open', async () => {
    mockOnDelete.mockRejectedValue(new Error('Network error'));

    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));

    const confirmDeleteButton = screen.getAllByRole('button', { name: 'Delete' }).find(
      (btn) => btn.className.includes('bg-red-600')
    )!;

    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // Error message should be displayed
    expect(screen.getByText('Failed to delete. Please try again.')).toBeInTheDocument();
    // Confirmation dialog should still be visible
    expect(screen.getByText('Delete this idea?')).toBeInTheDocument();
    // The button should be re-enabled (not in deleting state)
    const deleteBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('bg-red-600')
    );
    expect(deleteBtn).not.toBeDisabled();
  });

  it('closes confirmation dialog after successful delete', async () => {
    mockOnDelete.mockResolvedValue(undefined);

    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this idea?')).toBeInTheDocument();

    const confirmDeleteButton = screen.getAllByRole('button', { name: 'Delete' }).find(
      (btn) => btn.className.includes('bg-red-600')
    )!;

    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // Dialog should close on success
    expect(screen.queryByText('Delete this idea?')).not.toBeInTheDocument();
  });

  it('clears previous error when retrying delete', async () => {
    // First attempt fails
    mockOnDelete.mockRejectedValueOnce(new Error('Network error'));

    render(<IdeaCard idea={mockIdea} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete'));

    const getConfirmButton = () => screen.getAllByRole('button').find(
      (btn) => btn.className.includes('bg-red-600')
    )!;

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    expect(screen.getByText('Failed to delete. Please try again.')).toBeInTheDocument();

    // Second attempt succeeds
    mockOnDelete.mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    // Error should be cleared and dialog closed
    expect(screen.queryByText('Failed to delete. Please try again.')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete this idea?')).not.toBeInTheDocument();
  });
});
