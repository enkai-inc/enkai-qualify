import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { IdeaDisplay } from '../IdeaDisplay';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { act } from '@testing-library/react';

// Mock crypto.randomUUID for feature ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
});

const baseIdea = {
  id: 'test-id',
  title: 'Test Idea',
  description: 'Test Description',
  industry: 'technology',
  targetMarket: 'enterprise',
  technologies: ['React', 'Node.js'],
  features: [] as Array<{ id: string; name: string; description: string; priority: 'high' | 'medium' | 'low' }>,
  currentVersion: 1,
  status: 'DRAFT' as const,
};

describe('IdeaDisplay empty features state', () => {
  beforeEach(() => {
    act(() => {
      useWorkspaceStore.getState().reset();
    });
  });

  it('shows empty state message when features array is empty', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: { ...baseIdea, features: [] },
      });
    });

    render(<IdeaDisplay />);

    expect(screen.getByText('No features added yet')).toBeInTheDocument();
    expect(screen.getByText(/Click .+ to get started/)).toBeInTheDocument();
  });

  it('does not show empty state message when features exist', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: {
          ...baseIdea,
          features: [
            { id: 'f1', name: 'Feature One', description: 'Desc one', priority: 'high' },
          ],
        },
      });
    });

    render(<IdeaDisplay />);

    expect(screen.queryByText('No features added yet')).not.toBeInTheDocument();
    expect(screen.getByText('Feature One')).toBeInTheDocument();
  });

  it('does not show empty state message when add feature form is open', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: { ...baseIdea, features: [] },
      });
    });

    render(<IdeaDisplay />);

    // Click "+ Add Feature" to open the form
    const addButton = screen.getByText('+ Add Feature');
    act(() => {
      addButton.click();
    });

    // Empty state should be hidden when add feature form is visible
    expect(screen.queryByText('No features added yet')).not.toBeInTheDocument();
  });
});
