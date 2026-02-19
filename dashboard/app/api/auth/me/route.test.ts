/**
 * @jest-environment node
 */
import { GET } from './route';

// Mock auth module
const mockGetCurrentUser = jest.fn();
jest.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns user id, email, and name', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      subscription: {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'FREE',
        stripeCustomerId: 'cus_secret123',
        stripeSubscriptionId: 'sub_secret456',
        ideasUsed: 5,
        packsUsed: 2,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-02-01'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('user-123');
    expect(data.email).toBe('test@example.com');
    expect(data.name).toBe('Test User');
  });

  it('returns only safe subscription fields (tier, periodEnd, status)', async () => {
    const periodEnd = new Date('2025-02-01');
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      subscription: {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'EXPLORER',
        stripeCustomerId: 'cus_secret123',
        stripeSubscriptionId: 'sub_secret456',
        ideasUsed: 5,
        packsUsed: 2,
        periodStart: new Date('2025-01-01'),
        periodEnd,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.subscription).toEqual({
      tier: 'EXPLORER',
      periodEnd: periodEnd.toISOString(),
    });
  });

  it('does not expose stripeCustomerId', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      subscription: {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'FREE',
        stripeCustomerId: 'cus_secret123',
        stripeSubscriptionId: 'sub_secret456',
        ideasUsed: 0,
        packsUsed: 0,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-02-01'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.subscription.stripeCustomerId).toBeUndefined();
    expect(data.subscription.stripeSubscriptionId).toBeUndefined();
  });

  it('does not expose internal subscription fields', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      subscription: {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'BUILDER',
        stripeCustomerId: 'cus_secret123',
        stripeSubscriptionId: 'sub_secret456',
        ideasUsed: 10,
        packsUsed: 3,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-02-01'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    });

    const response = await GET();
    const data = await response.json();

    // These internal fields should not be exposed
    expect(data.subscription.id).toBeUndefined();
    expect(data.subscription.userId).toBeUndefined();
    expect(data.subscription.ideasUsed).toBeUndefined();
    expect(data.subscription.packsUsed).toBeUndefined();
    expect(data.subscription.periodStart).toBeUndefined();
    expect(data.subscription.createdAt).toBeUndefined();
    expect(data.subscription.updatedAt).toBeUndefined();
  });

  it('returns null subscription when user has no subscription', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      subscription: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.subscription).toBeNull();
  });

  it('includes status field when it exists on subscription', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      subscription: {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'EXPLORER',
        status: 'active',
        stripeCustomerId: 'cus_secret123',
        stripeSubscriptionId: 'sub_secret456',
        ideasUsed: 5,
        packsUsed: 2,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-02-01'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15'),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(data.subscription.status).toBe('active');
  });

  it('returns 500 on unexpected errors', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal error');
  });
});
