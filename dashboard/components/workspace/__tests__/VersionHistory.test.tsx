import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VersionHistory } from '../VersionHistory';
import { useWorkspaceStore, IdeaVersion } from '@/lib/stores/workspaceStore';

const baseIdea = {
  id: 'test-id',
  title: 'Test Idea',
  description: 'Test Description',
  industry: 'technology',
  targetMarket: 'enterprise',
  technologies: ['React'],
  features: [],
  currentVersion: 2,
  status: 'DRAFT' as const,
};

const snapshotV1 = {
  id: 'test-id',
  title: 'Test Idea',
  description: 'Test Description',
  industry: 'technology',
  targetMarket: 'enterprise',
  technologies: ['React'],
  features: [],
  currentVersion: 1,
  status: 'DRAFT' as const,
};

const snapshotV2 = {
  ...snapshotV1,
  currentVersion: 2,
};

const mockVersions: IdeaVersion[] = [
  {
    id: 'v1',
    ideaId: 'test-id',
    version: 1,
    summary: 'Initial version',
    createdAt: '2025-01-01T00:00:00Z',
    snapshot: snapshotV1,
    parentId: null,
  },
  {
    id: 'v2',
    ideaId: 'test-id',
    version: 2,
    summary: 'Second version',
    createdAt: '2025-01-02T00:00:00Z',
    snapshot: snapshotV2,
    parentId: 'v1',
  },
];

describe('VersionHistory', () => {
  beforeEach(() => {
    act(() => {
      useWorkspaceStore.getState().reset();
    });
  });

  it('renders version history heading', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    render(<VersionHistory />);

    expect(screen.getByText('Version History')).toBeInTheDocument();
  });

  it('does not render a Compare button', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    render(<VersionHistory />);

    expect(screen.queryByText('Compare')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel Compare')).not.toBeInTheDocument();
  });

  it('does not render "Diff view coming soon" text', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    render(<VersionHistory />);

    expect(screen.queryByText('Diff view coming soon')).not.toBeInTheDocument();
  });

  it('does not render checkboxes in version cards', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    const { container } = render(<VersionHistory />);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('shows expand/collapse chevron for all versions', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    const { container } = render(<VersionHistory />);

    // Each version card should have a chevron SVG
    const svgs = container.querySelectorAll('svg.w-4.h-4.text-gray-400');
    expect(svgs.length).toBe(mockVersions.length);
  });

  it('expands a version card on click to show Restore and Branch buttons', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    render(<VersionHistory />);

    // Click first version (not current, so should show both Restore and Branch)
    const v1Summary = screen.getByText('Initial version');
    act(() => {
      fireEvent.click(v1Summary);
    });

    expect(screen.getByText('Restore')).toBeInTheDocument();
    expect(screen.getByText('Branch')).toBeInTheDocument();
  });

  it('shows only Branch button for current version', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: mockVersions });
    });

    render(<VersionHistory />);

    // Click current version (v2)
    const v2Summary = screen.getByText('Second version');
    act(() => {
      fireEvent.click(v2Summary);
    });

    expect(screen.queryByText('Restore')).not.toBeInTheDocument();
    expect(screen.getByText('Branch')).toBeInTheDocument();
  });

  it('shows empty state when no versions exist', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: baseIdea, versions: [] });
    });

    render(<VersionHistory />);

    expect(screen.getByText('No version history yet')).toBeInTheDocument();
  });

  it('returns null when idea is not set', () => {
    act(() => {
      useWorkspaceStore.setState({ idea: null, versions: [] });
    });

    const { container } = render(<VersionHistory />);

    expect(container.firstChild).toBeNull();
  });
});
