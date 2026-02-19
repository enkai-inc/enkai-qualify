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

// Mock rate limit
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetAt: 0 }),
}));

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    idea: {
      create: jest.fn().mockResolvedValue({ id: 'mock-idea-id' }),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock github service
jest.mock('@/lib/services/github-service', () => ({
  createIdeaGenerationIssue: jest.fn().mockResolvedValue({ issueNumber: 1, issueUrl: 'https://github.com/test/1' }),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

function createPostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ideas/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ideas/generate', () => {
  const validBody = {
    industry: 'Technology',
    targetMarket: 'Enterprise',
    problemDescription: 'A valid problem description',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { requireAuth, canCreateIdea } = require('@/lib/auth');
    requireAuth.mockResolvedValue(mockUser);
    canCreateIdea.mockResolvedValue(true);
  });

  describe('max-length validation', () => {
    it('returns 400 when industry exceeds 100 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        industry: 'a'.repeat(101),
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Industry must be a string of 100 characters or less');
    });

    it('returns 400 when industry is not a string', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        industry: 12345,
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Industry must be a string of 100 characters or less');
    });

    it('accepts industry at exactly 100 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        industry: 'a'.repeat(100),
      }));
      expect(response.status).not.toBe(400);
    });

    it('returns 400 when targetMarket exceeds 100 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        targetMarket: 'a'.repeat(101),
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Target market must be a string of 100 characters or less');
    });

    it('returns 400 when targetMarket is not a string', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        targetMarket: ['not', 'a', 'string'],
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Target market must be a string of 100 characters or less');
    });

    it('accepts targetMarket at exactly 100 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        targetMarket: 'b'.repeat(100),
      }));
      expect(response.status).not.toBe(400);
    });

    it('returns 400 when problemDescription exceeds 2000 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        problemDescription: 'a'.repeat(2001),
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Problem description must be 2000 characters or less');
    });

    it('returns 400 when problemDescription is not a string', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        problemDescription: { nested: 'object' },
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Problem description must be 2000 characters or less');
    });

    it('accepts problemDescription at exactly 2000 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        problemDescription: 'c'.repeat(2000),
      }));
      expect(response.status).not.toBe(400);
    });

    it('accepts valid input with all fields within limits', async () => {
      const response = await POST(createPostRequest(validBody));
      expect(response.status).toBe(202);
    });
  });
});
