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
      technologies: ['React'],
      features: [{ name: 'Feature 1', description: 'Desc' }],
    },
  }),
}));

// Mock GitHub service
jest.mock('@/lib/services/github-service', () => ({
  createRefinementIssue: jest.fn().mockResolvedValue({
    issueNumber: 42,
    issueUrl: 'https://github.com/enkai-inc/enkai-qualify/issues/42',
  }),
}));

function createPostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ideas/idea-1/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockParams = Promise.resolve({ id: 'idea-1' });

describe('POST /api/ideas/[id]/refine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { requireAuth } = require('@/lib/auth');
    requireAuth.mockResolvedValue(mockUser);
  });

  describe('max-length validation', () => {
    it('returns 400 when prompt exceeds 2000 characters', async () => {
      const response = await POST(
        createPostRequest({ prompt: 'a'.repeat(2001) }),
        { params: mockParams }
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Prompt must be a string of 2000 characters or less');
    });

    it('returns 400 when prompt is not a string', async () => {
      const response = await POST(
        createPostRequest({ prompt: 12345 }),
        { params: mockParams }
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Prompt must be a string of 2000 characters or less');
    });

    it('accepts prompt at exactly 2000 characters', async () => {
      const response = await POST(
        createPostRequest({ prompt: 'a'.repeat(2000) }),
        { params: mockParams }
      );
      expect(response.status).toBe(202);
    });

    it('returns 400 when prompt is missing', async () => {
      const response = await POST(
        createPostRequest({}),
        { params: mockParams }
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Prompt is required');
    });
  });

  describe('async flow', () => {
    it('returns 202 with pending status and GitHub issue info', async () => {
      const response = await POST(
        createPostRequest({ prompt: 'Make it more focused on mobile users' }),
        { params: mockParams }
      );
      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data.status).toBe('pending');
      expect(data.githubIssue).toBe(42);
      expect(data.githubIssueUrl).toBe('https://github.com/enkai-inc/enkai-qualify/issues/42');
    });

    it('calls createRefinementIssue with correct parameters', async () => {
      const { createRefinementIssue } = require('@/lib/services/github-service');

      await POST(
        createPostRequest({ prompt: 'Add mobile features' }),
        { params: mockParams }
      );

      expect(createRefinementIssue).toHaveBeenCalledWith({
        ideaId: 'idea-1',
        userId: 'user-123',
        title: 'Test Idea',
        description: 'A description',
        industry: 'tech',
        targetMarket: 'enterprise',
        technologies: ['React'],
        features: [{ name: 'Feature 1', description: 'Desc' }],
        prompt: 'Add mobile features',
      });
    });

    it('returns 404 when idea not found', async () => {
      const { getIdea } = require('@/lib/services/idea-service');
      getIdea.mockResolvedValueOnce(null);

      const response = await POST(
        createPostRequest({ prompt: 'Test' }),
        { params: mockParams }
      );
      expect(response.status).toBe(404);
    });
  });
});
