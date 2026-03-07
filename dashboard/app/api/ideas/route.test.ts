/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

// Mock auth
const mockUser = { id: 'user-123', email: 'test@example.com', teamId: 'default-team' };
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ id: 'user-123', email: 'test@example.com', teamId: 'default-team' }),
  canCreateIdea: jest.fn().mockResolvedValue(true),
}));

// Mock idea service
jest.mock('@/lib/services/idea-service', () => ({
  listIdeas: jest.fn().mockResolvedValue({ ideas: [], total: 0, page: 1, pageSize: 10 }),
  createIdea: jest.fn().mockResolvedValue({
    id: 'idea-1',
    title: 'Test',
    description: 'Desc',
    industry: 'tech',
    targetMarket: 'enterprise',
    technologies: [],
    features: [],
    status: 'DRAFT',
  }),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

function createGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/ideas');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function createPostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/ideas', () => {
  const { listIdeas } = require('@/lib/services/idea-service');

  beforeEach(() => {
    jest.clearAllMocks();
    listIdeas.mockResolvedValue({ ideas: [], total: 0, page: 1, pageSize: 10 });
  });

  describe('pagination validation', () => {
    it('clamps page to minimum 1 for zero', async () => {
      await GET(createGetRequest({ page: '0' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ page: 1 })
      );
    });

    it('clamps page to minimum 1 for negative values', async () => {
      await GET(createGetRequest({ page: '-5' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ page: 1 })
      );
    });

    it('defaults page to 1 when not provided', async () => {
      await GET(createGetRequest());
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ page: 1 })
      );
    });

    it('defaults page to 1 for non-numeric input', async () => {
      await GET(createGetRequest({ page: 'abc' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ page: 1 })
      );
    });

    it('defaults pageSize for zero input (falsy value)', async () => {
      await GET(createGetRequest({ pageSize: '0' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ pageSize: 10 })
      );
    });

    it('clamps pageSize to minimum 1 for negative values', async () => {
      await GET(createGetRequest({ pageSize: '-5' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ pageSize: 1 })
      );
    });

    it('clamps pageSize to maximum 100', async () => {
      await GET(createGetRequest({ pageSize: '200' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ pageSize: 100 })
      );
    });

    it('defaults pageSize to 10 when not provided', async () => {
      await GET(createGetRequest());
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ pageSize: 10 })
      );
    });

    it('defaults pageSize to 10 for non-numeric input', async () => {
      await GET(createGetRequest({ pageSize: 'abc' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ pageSize: 10 })
      );
    });
  });

  describe('sortBy validation', () => {
    it('defaults to updatedAt when not provided', async () => {
      await GET(createGetRequest());
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortBy: 'updatedAt' })
      );
    });

    it('accepts createdAt', async () => {
      await GET(createGetRequest({ sortBy: 'createdAt' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortBy: 'createdAt' })
      );
    });

    it('accepts updatedAt', async () => {
      await GET(createGetRequest({ sortBy: 'updatedAt' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortBy: 'updatedAt' })
      );
    });

    it('accepts title', async () => {
      await GET(createGetRequest({ sortBy: 'title' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortBy: 'title' })
      );
    });

    it('falls back to updatedAt for invalid sortBy values', async () => {
      await GET(createGetRequest({ sortBy: 'malicious; DROP TABLE ideas' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortBy: 'updatedAt' })
      );
    });

    it('falls back to updatedAt for non-whitelisted column names', async () => {
      await GET(createGetRequest({ sortBy: 'email' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortBy: 'updatedAt' })
      );
    });
  });

  describe('sortOrder validation', () => {
    it('defaults to desc when not provided', async () => {
      await GET(createGetRequest());
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortOrder: 'desc' })
      );
    });

    it('accepts asc', async () => {
      await GET(createGetRequest({ sortOrder: 'asc' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortOrder: 'asc' })
      );
    });

    it('accepts desc', async () => {
      await GET(createGetRequest({ sortOrder: 'desc' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortOrder: 'desc' })
      );
    });

    it('falls back to desc for invalid sortOrder values', async () => {
      await GET(createGetRequest({ sortOrder: 'INVALID' }));
      expect(listIdeas).toHaveBeenCalledWith(
        'default-team',
        expect.objectContaining({ sortOrder: 'desc' })
      );
    });
  });
});

describe('POST /api/ideas', () => {
  const validBody = {
    title: 'Test Idea',
    description: 'A description of the test idea',
    industry: 'technology',
    targetMarket: 'enterprise',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { requireAuth, canCreateIdea } = require('@/lib/auth');
    requireAuth.mockResolvedValue(mockUser);
    canCreateIdea.mockResolvedValue(true);
  });

  describe('input validation', () => {
    it('returns 400 when title is missing', async () => {
      const { title, ...body } = validBody;
      const response = await POST(createPostRequest(body));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 when title exceeds 200 characters', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        title: 'a'.repeat(201),
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 when description is missing', async () => {
      const { description, ...body } = validBody;
      const response = await POST(createPostRequest(body));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 when industry is missing', async () => {
      const { industry, ...body } = validBody;
      const response = await POST(createPostRequest(body));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 when targetMarket is missing', async () => {
      const { targetMarket, ...body } = validBody;
      const response = await POST(createPostRequest(body));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 when technologies is not an array', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        technologies: 'not-an-array',
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 when features is not an array', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        features: 'not-an-array',
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('returns 400 with details for validation errors', async () => {
      const response = await POST(createPostRequest({}));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
      expect(data.details.fieldErrors).toBeDefined();
    });

    it('returns 201 for valid input with required fields only', async () => {
      const response = await POST(createPostRequest(validBody));
      expect(response.status).toBe(201);
    });

    it('returns 201 for valid input with all optional fields', async () => {
      const response = await POST(createPostRequest({
        ...validBody,
        technologies: ['React', 'Node.js'],
        features: [{ name: 'Feature 1', description: 'Desc', priority: 'high' }],
      }));
      expect(response.status).toBe(201);
    });
  });
});
