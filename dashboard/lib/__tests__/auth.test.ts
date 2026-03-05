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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    idea: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    marketScan: {
      updateMany: jest.fn(),
    },
  },
}));

// Mock @prisma/client for IdeaStatus enum and Prisma namespace
jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string; clientVersion?: string }) {
      super(message);
      this.code = opts.code;
      this.name = 'PrismaClientKnownRequestError';
    }
  }
  return {
    IdeaStatus: {
      PENDING: 'PENDING',
      DRAFT: 'DRAFT',
      VALIDATED: 'VALIDATED',
      PACK_GENERATED: 'PACK_GENERATED',
      ARCHIVED: 'ARCHIVED',
    },
    Prisma: {
      PrismaClientKnownRequestError,
    },
  };
});

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

const mockHeaders = headers as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockFindFirst = (prisma.user as any).findFirst as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;
const mockUpdate = (prisma.user as any).update as jest.Mock;
const mockIdeaCount = (prisma as any).idea.count as jest.Mock;

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
  teamId: 'default-team',
  team: { id: 'default-team', name: 'Default Team' },
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
    mockFindFirst.mockResolvedValue(null);

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

    // 1st findUnique (cognitoId lookup) → null
    // 2nd findUnique (email lookup) → null
    // create throws P2002
    // 3rd findUnique (re-fetch by cognitoId) → testUser
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(testUser);

    const { Prisma } = require('@prisma/client');
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002' }
    );
    mockCreate.mockRejectedValue(prismaError);

    const result = await getCurrentUser();

    expect(result).toEqual(testUser);
    expect(mockFindUnique).toHaveBeenCalledTimes(3);
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

    // Both cognitoId and email lookups return null
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
      teamId: 'default-team',
      subscription: null,
    });

    const result = await canCreateIdea('user-1');
    expect(result).toBe(false);
  });

  it('should return true when team is under the idea limit', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      teamId: 'default-team',
      subscription: { tier: 'FREE' },
    });
    mockIdeaCount.mockResolvedValue(2);

    const result = await canCreateIdea('user-1');
    expect(result).toBe(true);
  });

  it('should return false when team is at the idea limit', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      teamId: 'default-team',
      subscription: { tier: 'FREE' },
    });
    mockIdeaCount.mockResolvedValue(3);

    const result = await canCreateIdea('user-1');
    expect(result).toBe(false);
  });

  it('should return true for AGENCY tier (unlimited)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      teamId: 'default-team',
      subscription: { tier: 'AGENCY' },
    });

    const result = await canCreateIdea('user-1');
    expect(result).toBe(true);
  });

  it('should count non-archived ideas by teamId', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      teamId: 'default-team',
      subscription: { tier: 'FREE' },
    });
    mockIdeaCount.mockResolvedValue(2);

    await canCreateIdea('user-1');

    // Verify the count query uses teamId and excludes ARCHIVED
    expect(mockIdeaCount).toHaveBeenCalledWith({
      where: { teamId: 'default-team', status: { not: 'ARCHIVED' } },
    });
  });
});
