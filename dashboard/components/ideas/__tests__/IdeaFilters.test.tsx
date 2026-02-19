import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { IdeaFilters } from '../IdeaFilters';

describe('IdeaFilters', () => {
  const defaultFilters = {
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
  };
  const mockOnFilterChange = jest.fn();

  it('renders the search input with aria-label', () => {
    render(
      <IdeaFilters filters={defaultFilters} onFilterChange={mockOnFilterChange} />
    );
    const searchInput = screen.getByRole('textbox', { name: 'Search ideas' });
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('aria-label', 'Search ideas');
  });
});
