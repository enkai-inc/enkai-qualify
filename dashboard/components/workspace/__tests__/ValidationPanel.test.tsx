import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ValidationPanel } from '../ValidationPanel';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

// Mock global fetch
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

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    useWorkspaceStore.getState().reset();
  });
});

describe('ValidationPanel - Run Validation button', () => {
  it('renders the Run Validation button when there is no validation data', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        validation: null,
        isLoading: false,
      });
    });

    render(<ValidationPanel />);

    const button = screen.getByRole('button', { name: /run validation/i });
    expect(button).toBeInTheDocument();
  });

  it('calls validate when the Run Validation button is clicked', async () => {
    const mockValidationResponse = {
      id: 'val-1',
      ideaId: 'idea-1',
      version: 1,
      keywordScore: 75,
      painPointScore: 80,
      competitionScore: 60,
      revenueEstimate: 70,
      overallScore: 72,
      details: {},
      createdAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockValidationResponse),
    });

    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        validation: null,
        isLoading: false,
      });
    });

    render(<ValidationPanel />);

    const button = screen.getByRole('button', { name: /run validation/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ideas/idea-1/validate',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('disables the button and shows loading text when isValidating is true', () => {
    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        validation: null,
        isLoading: false,
        isValidating: true,
      });
    });

    render(<ValidationPanel />);

    const button = screen.getByRole('button', { name: /validating/i });
    expect(button).toBeDisabled();
  });

  it('updates validation state on successful validate call', async () => {
    const mockValidationResponse = {
      id: 'val-1',
      ideaId: 'idea-1',
      version: 1,
      keywordScore: 75,
      painPointScore: 80,
      competitionScore: 60,
      revenueEstimate: 70,
      overallScore: 72,
      details: { marketSize: '$1B' },
      createdAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockValidationResponse),
    });

    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        validation: null,
        isLoading: false,
      });
    });

    render(<ValidationPanel />);

    const button = screen.getByRole('button', { name: /run validation/i });

    await act(async () => {
      fireEvent.click(button);
    });

    const state = useWorkspaceStore.getState();
    expect(state.validation).toEqual(mockValidationResponse);
    expect(state.isValidating).toBe(false);
  });

  it('sets error state when validate call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    act(() => {
      useWorkspaceStore.setState({
        idea: mockIdea,
        validation: null,
        isLoading: false,
      });
    });

    render(<ValidationPanel />);

    const button = screen.getByRole('button', { name: /run validation/i });

    await act(async () => {
      fireEvent.click(button);
    });

    const state = useWorkspaceStore.getState();
    expect(state.error).toBe('Failed to validate idea');
    expect(state.isValidating).toBe(false);
  });
});
