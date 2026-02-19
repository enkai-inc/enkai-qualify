/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock auth
const mockUser = { id: 'user-123', email: 'test@example.com' };
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ id: 'user-123', email: 'test@example.com' }),
  canCreateIdea: jest.fn().mockResolvedValue(true),
}));

// Mock idea service
const mockNewIdea = {
  id: 'new-idea-1',
  title: 'Branched Idea',
  versions: [{ id: 'v1', versionNumber: 1 }],
};
jest.mock('@/lib/services/idea-service', () => ({
  branchFromVersion: jest.fn().mockResolvedValue({
    id: 'new-idea-1',
    title: 'Branched Idea',
    versions: [{ id: 'v1', versionNumber: 1 }],
  }),
}));

function createRequest() {
  return new NextRequest('http://localhost/api/ideas/idea-1/versions/v1/branch', {
    method: 'POST',
  });
}

const params = Promise.resolve({ id: 'idea-1', versionId: 'v1' });

describe('POST /api/ideas/[id]/versions/[versionId]/branch', () => {
  const { requireAuth, canCreateIdea } = require('@/lib/auth');
  const { branchFromVersion } = require('@/lib/services/idea-service');

  beforeEach(() => {
    jest.clearAllMocks();
    requireAuth.mockResolvedValue(mockUser);
    canCreateIdea.mockResolvedValue(true);
    branchFromVersion.mockResolvedValue(mockNewIdea);
  });

  it('returns 403 when subscription idea limit is reached', async () => {
    canCreateIdea.mockResolvedValue(false);

    const response = await POST(createRequest(), { params });
    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toBe('Idea limit reached. Please upgrade your subscription.');
    expect(branchFromVersion).not.toHaveBeenCalled();
  });

  it('calls canCreateIdea with the user id', async () => {
    await POST(createRequest(), { params });
    expect(canCreateIdea).toHaveBeenCalledWith('user-123');
  });

  it('returns 200 with branched idea when within subscription limits', async () => {
    const response = await POST(createRequest(), { params });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.idea).toEqual(mockNewIdea);
    expect(branchFromVersion).toHaveBeenCalledWith('idea-1', 'v1', 'user-123');
  });

  it('returns 401 when user is not authenticated', async () => {
    requireAuth.mockRejectedValue(new Error('Unauthorized'));

    const response = await POST(createRequest(), { params });
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when idea is not found', async () => {
    branchFromVersion.mockRejectedValue(new Error('Idea not found'));

    const response = await POST(createRequest(), { params });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('Idea not found');
  });

  it('returns 404 when version is not found', async () => {
    branchFromVersion.mockRejectedValue(new Error('Version not found'));

    const response = await POST(createRequest(), { params });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('Version not found');
  });

  it('returns 500 for unexpected errors', async () => {
    branchFromVersion.mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(createRequest(), { params });
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe('Failed to branch version');
  });
});
