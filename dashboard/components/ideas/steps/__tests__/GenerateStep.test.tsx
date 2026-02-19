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
  const baseStore = {
    isGenerating: true,
    generateIdea: jest.fn(),
    prevStep: jest.fn(),
    error: null,
  } as unknown as ReturnType<typeof useCreateIdeaStore>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds aria-hidden to the error X icon SVG', () => {
    mockUseCreateIdeaStore.mockReturnValue({
      ...baseStore,
      error: 'Something went wrong',
    } as unknown as ReturnType<typeof useCreateIdeaStore>);

    const { container } = render(<GenerateStep />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds aria-hidden to the loading lightbulb SVG', () => {
    mockUseCreateIdeaStore.mockReturnValue({
      ...baseStore,
      isGenerating: true,
    } as unknown as ReturnType<typeof useCreateIdeaStore>);

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
    mockUseCreateIdeaStore.mockReturnValue({
      ...baseStore,
      isGenerating: false,
    } as unknown as ReturnType<typeof useCreateIdeaStore>);

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
    mockUseCreateIdeaStore.mockReturnValue({
      ...baseStore,
      isGenerating: true,
    } as unknown as ReturnType<typeof useCreateIdeaStore>);

    const { container: containerGenerating } = render(<GenerateStep />);
    const svgsGenerating = containerGenerating.querySelectorAll('svg');
    svgsGenerating.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Test not-generating state
    mockUseCreateIdeaStore.mockReturnValue({
      ...baseStore,
      isGenerating: false,
    } as unknown as ReturnType<typeof useCreateIdeaStore>);

    const { container: containerDone } = render(<GenerateStep />);
    const svgsDone = containerDone.querySelectorAll('svg');
    svgsDone.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Error state
    mockUseCreateIdeaStore.mockReturnValue({
      ...baseStore,
      error: 'Test error',
    } as unknown as ReturnType<typeof useCreateIdeaStore>);

    const { container: containerError } = render(<GenerateStep />);
    const svgsError = containerError.querySelectorAll('svg');
    svgsError.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
