import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { GenerateStep } from '../GenerateStep';
import { useCreateIdeaStore } from '@/lib/stores/createIdeaStore';

// Mock the store
jest.mock('@/lib/stores/createIdeaStore');
const mockUseCreateIdeaStore = useCreateIdeaStore as jest.MockedFunction<
  typeof useCreateIdeaStore
>;

describe('GenerateStep', () => {
  const createMockStore = (overrides: Partial<ReturnType<typeof useCreateIdeaStore>> = {}) => ({
    isGenerating: true,
    generateIdea: jest.fn(),
    prevStep: jest.fn(),
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useCreateIdeaStore>);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds aria-hidden to the error X icon SVG', () => {
    mockUseCreateIdeaStore.mockReturnValue(
      createMockStore({ error: 'Something went wrong' })
    );

    const { container } = render(<GenerateStep />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds aria-hidden to the loading lightbulb SVG', () => {
    mockUseCreateIdeaStore.mockReturnValue(
      createMockStore({ isGenerating: true })
    );

    const { container } = render(<GenerateStep />);
    const svgs = container.querySelectorAll('svg');
    // When generating: lightbulb SVG + "Analyzing" checkmark = 2 SVGs
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    // All SVGs should have aria-hidden
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('adds aria-hidden to the green checkmark SVGs when not generating', () => {
    mockUseCreateIdeaStore.mockReturnValue(
      createMockStore({ isGenerating: false })
    );

    const { container } = render(<GenerateStep />);
    const svgs = container.querySelectorAll('svg');
    // When not generating: lightbulb + "Analyzing" checkmark + "Crafting" checkmark = 3 SVGs
    expect(svgs).toHaveLength(3);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('all decorative SVGs have aria-hidden in both states', () => {
    // Test generating state
    mockUseCreateIdeaStore.mockReturnValue(
      createMockStore({ isGenerating: true })
    );

    const { container: containerGenerating } = render(<GenerateStep />);
    const svgsGenerating = containerGenerating.querySelectorAll('svg');
    svgsGenerating.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Test not-generating state
    mockUseCreateIdeaStore.mockReturnValue(
      createMockStore({ isGenerating: false })
    );

    const { container: containerDone } = render(<GenerateStep />);
    const svgsDone = containerDone.querySelectorAll('svg');
    svgsDone.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Error state
    mockUseCreateIdeaStore.mockReturnValue(
      createMockStore({ error: 'Test error' })
    );

    const { container: containerError } = render(<GenerateStep />);
    const svgsError = containerError.querySelectorAll('svg');
    svgsError.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
