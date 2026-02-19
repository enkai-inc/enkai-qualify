import { getCurrentUser, canCreateIdea } from '@/lib/auth';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

// Mock the prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock @prisma/client for IdeaStatus enum
jest.mock('@prisma/client', () => ({
  IdeaStatus: {
    PENDING: 'PENDING',
    DRAFT: 'DRAFT',
    VALIDATED: 'VALIDATED',
    PACK_GENERATED: 'PACK_GENERATED',
    ARCHIVED: 'ARCHIVED',
  },
}));

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

const mockHeaders = headers as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;

// Helper to create a valid OIDC JWT with the given payload
function makeOidcJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = 'fakesig';
  return `${header}.${body}.${sig}`;
}

const testCognitoId = 'cognito-sub-123';
const testPayload = {
  sub: testCognitoId,
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
};

const testUser = {
  id: 'user-1',
  cognitoId: testCognitoId,
  email: 'test@example.com',
  name: 'Test User',
  subscription: { tier: 'FREE', periodEnd: new Date() },
};

describe('getCurrentUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when headers are missing', async () => {
    mockHeaders.mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
    });

    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('should return existing user without creating', async () => {
    mockHeaders.mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === 'x-amzn-oidc-data') return makeOidcJwt(testPayload);
        if (key === 'x-amzn-oidc-identity') return testCognitoId;
        return null;
      }),
    });
    mockFindUnique.mockResolvedValue(testUser);

    const result = await getCurrentUser();

    expect(result).toEqual(testUser);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should create user when not found', async () => {
    mockHeaders.mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === 'x-amzn-oidc-data') return makeOidcJwt(testPayload);
        if (key === 'x-amzn-oidc-identity') return testCognitoId;
        return null;
      }),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(testUser);

    const result = await getCurrentUser();

    expect(result).toEqual(testUser);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should handle P2002 race condition by re-fetching the user', async () => {
    mockHeaders.mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === 'x-amzn-oidc-data') return makeOidcJwt(testPayload);
        if (key === 'x-amzn-oidc-identity') return testCognitoId;
        return null;
      }),
    });

    // First findUnique returns null (user not found)
    // Then create throws P2002 (unique constraint violation)
    // Then second findUnique returns the user (created by another request)
    mockFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(testUser);

    const prismaError = new Error('Unique constraint failed');
    Object.assign(prismaError, { code: 'P2002' });
    mockCreate.mockRejectedValue(prismaError);

    const result = await getCurrentUser();

    expect(result).toEqual(testUser);
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should re-throw non-P2002 errors from create', async () => {
    mockHeaders.mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === 'x-amzn-oidc-data') return makeOidcJwt(testPayload);
        if (key === 'x-amzn-oidc-identity') return testCognitoId;
        return null;
      }),
    });

    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error('Database connection failed'));

    await expect(getCurrentUser()).rejects.toThrow('Database connection failed');
  });
});

describe('canCreateIdea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false when user has no subscription', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      subscription: null,
      _count: { ideas: 0 },
    });

    const result = await canCreateIdea('user-1');
    expect(result).toBe(false);
  });

  it('should return true when user is under the idea limit', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { tier: 'FREE' },
      _count: { ideas: 2 },
    });

    const result = await canCreateIdea('user-1');
    expect(result).toBe(true);
  });

  it('should return false when user is at the idea limit', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { tier: 'FREE' },
      _count: { ideas: 3 },
    });

    const result = await canCreateIdea('user-1');
    expect(result).toBe(false);
  });

  it('should return true for AGENCY tier (unlimited)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { tier: 'AGENCY' },
      _count: { ideas: 999 },
    });

    const result = await canCreateIdea('user-1');
    expect(result).toBe(true);
  });

  it('should exclude ARCHIVED ideas from the count query', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { tier: 'FREE' },
      _count: { ideas: 2 },
    });

    await canCreateIdea('user-1');

    // Verify the Prisma query filters out ARCHIVED ideas
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: {
            select: {
              ideas: {
                where: { status: { not: 'ARCHIVED' } },
              },
            },
          },
        }),
      })
    );
  });
});
