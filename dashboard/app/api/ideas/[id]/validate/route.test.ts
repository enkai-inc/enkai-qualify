/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock auth
const mockUser = { id: 'user-123', email: 'test@example.com' };
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ id: 'user-123', email: 'test@example.com' }),
}));

// Mock rate limit
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetAt: 0 }),
}));

// Mock idea service
jest.mock('@/lib/services/idea-service', () => ({
  getIdea: jest.fn().mockResolvedValue({
    idea: {
      id: 'idea-1',
      title: 'Test Idea',
      description: 'A description',
      industry: 'tech',
      targetMarket: 'enterprise',
      features: [{ name: 'Feature 1', description: 'Desc' }],
    },
  }),
}));

// Mock GitHub service
jest.mock('@/lib/services/github-service', () => ({
  createValidationIssue: jest.fn().mockResolvedValue({
    issueNumber: 99,
    issueUrl: 'https://github.com/enkai-inc/enkai-qualify/issues/99',
  }),
}));

const mockParams = Promise.resolve({ id: 'idea-1' });

describe('POST /api/ideas/[id]/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { requireAuth } = require('@/lib/auth');
    requireAuth.mockResolvedValue(mockUser);
  });

  it('returns 202 with pending status and GitHub issue info', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ideas/idea-1/validate', { method: 'POST' }),
      { params: mockParams }
    );
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.status).toBe('pending');
    expect(data.githubIssue).toBe(99);
    expect(data.githubIssueUrl).toBe('https://github.com/enkai-inc/enkai-qualify/issues/99');
  });

  it('calls createValidationIssue with correct parameters', async () => {
    const { createValidationIssue } = require('@/lib/services/github-service');

    await POST(
      new NextRequest('http://localhost/api/ideas/idea-1/validate', { method: 'POST' }),
      { params: mockParams }
    );

    expect(createValidationIssue).toHaveBeenCalledWith({
      ideaId: 'idea-1',
      userId: 'user-123',
      title: 'Test Idea',
      description: 'A description',
      industry: 'tech',
      targetMarket: 'enterprise',
      features: [{ name: 'Feature 1', description: 'Desc' }],
    });
  });

  it('returns 404 when idea not found', async () => {
    const { getIdea } = require('@/lib/services/idea-service');
    getIdea.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest('http://localhost/api/ideas/idea-1/validate', { method: 'POST' }),
      { params: mockParams }
    );
    expect(response.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAuth } = require('@/lib/auth');
    requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await POST(
      new NextRequest('http://localhost/api/ideas/idea-1/validate', { method: 'POST' }),
      { params: mockParams }
    );
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 60000 });

    const response = await POST(
      new NextRequest('http://localhost/api/ideas/idea-1/validate', { method: 'POST' }),
      { params: mockParams }
    );
    expect(response.status).toBe(429);
  });
});
