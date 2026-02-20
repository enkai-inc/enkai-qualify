import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ProblemStep } from '../ProblemStep';
import { useCreateIdeaStore } from '@/lib/stores/createIdeaStore';

// Mock the store
jest.mock('@/lib/stores/createIdeaStore');
const mockUseCreateIdeaStore = useCreateIdeaStore as jest.MockedFunction<
  typeof useCreateIdeaStore
>;

describe('ProblemStep', () => {
  beforeEach(() => {
    mockUseCreateIdeaStore.mockReturnValue({
      industry: 'healthcare',
      targetMarket: 'B2B',
      problemDescription: 'This is a test problem description that is long enough',
      setProblemDescription: jest.fn(),
      prevStep: jest.fn(),
      nextStep: jest.fn(),
    } as unknown as ReturnType<typeof useCreateIdeaStore>);
  });

  it('renders the character counter with aria-live="polite"', () => {
    render(<ProblemStep />);
    const counter = screen.getByText(/\d+\/2000/);
    expect(counter).toHaveAttribute('aria-live', 'polite');
  });
});
