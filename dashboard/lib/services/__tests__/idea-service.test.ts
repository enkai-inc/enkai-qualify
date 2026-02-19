import { listIdeas, restoreVersion, branchFromVersion } from '../idea-service';

// Mock the prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    idea: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    ideaVersion: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const validSnapshot = {
  title: 'Test Idea',
  description: 'A test description',
  industry: 'Technology',
  targetMarket: 'Startups',
  technologies: ['React', 'Node.js'],
  features: [
    {
      id: 'feat-1',
      name: 'Feature 1',
      description: 'A feature',
      priority: 'high',
    },
  ],
};

describe('idea-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listIdeas', () => {
    it('should exclude ARCHIVED ideas when no status filter is provided', async () => {
      (mockPrisma.idea.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.idea.count as jest.Mock).mockResolvedValue(0);

      await listIdeas('user-123');

      const expectedWhere = {
        userId: 'user-123',
        status: { not: 'ARCHIVED' },
      };

      expect(mockPrisma.idea.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mockPrisma.idea.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('should use explicit status filter when provided', async () => {
      (mockPrisma.idea.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.idea.count as jest.Mock).mockResolvedValue(0);

      await listIdeas('user-123', { status: 'DRAFT' as any });

      const expectedWhere = {
        userId: 'user-123',
        status: 'DRAFT',
      };

      expect(mockPrisma.idea.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mockPrisma.idea.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('should allow explicit ARCHIVED status filter', async () => {
      (mockPrisma.idea.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.idea.count as jest.Mock).mockResolvedValue(0);

      await listIdeas('user-123', { status: 'ARCHIVED' as any });

      const expectedWhere = {
        userId: 'user-123',
        status: 'ARCHIVED',
      };

      expect(mockPrisma.idea.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(mockPrisma.idea.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });
  });

  describe('restoreVersion', () => {
    it('should successfully restore from a valid snapshot', async () => {
      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: validSnapshot,
      });
      (mockPrisma.idea.update as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        ...validSnapshot,
        currentVersion: 3,
        versions: [],
      });

      const result = await restoreVersion('idea-1', 'ver-1', 'user-1');

      expect(mockPrisma.idea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'idea-1' },
          data: expect.objectContaining({
            title: 'Test Idea',
            description: 'A test description',
            industry: 'Technology',
            targetMarket: 'Startups',
            technologies: ['React', 'Node.js'],
            currentVersion: 3,
          }),
        })
      );

      expect(result).toBeDefined();
    });

    it('should throw on invalid snapshot data (missing title)', async () => {
      const invalidSnapshot = { ...validSnapshot, title: undefined };

      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: invalidSnapshot,
      });

      await expect(
        restoreVersion('idea-1', 'ver-1', 'user-1')
      ).rejects.toThrow();
    });

    it('should throw on invalid snapshot data (technologies is not an array)', async () => {
      const invalidSnapshot = { ...validSnapshot, technologies: 'not-an-array' };

      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: invalidSnapshot,
      });

      await expect(
        restoreVersion('idea-1', 'ver-1', 'user-1')
      ).rejects.toThrow();
    });

    it('should throw on invalid snapshot data (features missing required fields)', async () => {
      const invalidSnapshot = {
        ...validSnapshot,
        features: [{ name: 'No id or description or priority' }],
      };

      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: invalidSnapshot,
      });

      await expect(
        restoreVersion('idea-1', 'ver-1', 'user-1')
      ).rejects.toThrow();
    });

    it('should throw on invalid snapshot data (feature priority is invalid enum value)', async () => {
      const invalidSnapshot = {
        ...validSnapshot,
        features: [
          {
            id: 'feat-1',
            name: 'Feature 1',
            description: 'A feature',
            priority: 'invalid-priority',
          },
        ],
      };

      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: invalidSnapshot,
      });

      await expect(
        restoreVersion('idea-1', 'ver-1', 'user-1')
      ).rejects.toThrow();
    });
  });

  describe('branchFromVersion', () => {
    it('should successfully branch from a valid snapshot', async () => {
      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        title: 'Original Idea',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: validSnapshot,
      });
      (mockPrisma.idea.create as jest.Mock).mockResolvedValue({
        id: 'idea-2',
        ...validSnapshot,
        title: 'Test Idea (Branch)',
        currentVersion: 1,
        versions: [],
      });

      const result = await branchFromVersion('idea-1', 'ver-1', 'user-1');

      expect(mockPrisma.idea.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            title: 'Test Idea (Branch)',
            description: 'A test description',
            industry: 'Technology',
            targetMarket: 'Startups',
            technologies: ['React', 'Node.js'],
            currentVersion: 1,
          }),
        })
      );

      expect(result).toBeDefined();
    });

    it('should throw on invalid snapshot data (missing description)', async () => {
      const invalidSnapshot = { ...validSnapshot, description: 42 };

      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        title: 'Original Idea',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: invalidSnapshot,
      });

      await expect(
        branchFromVersion('idea-1', 'ver-1', 'user-1')
      ).rejects.toThrow();
    });

    it('should throw on completely invalid snapshot (null)', async () => {
      (mockPrisma.idea.findFirst as jest.Mock).mockResolvedValue({
        id: 'idea-1',
        userId: 'user-1',
        title: 'Original Idea',
        currentVersion: 2,
      });
      (mockPrisma.ideaVersion.findFirst as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        ideaId: 'idea-1',
        version: 1,
        snapshot: null,
      });

      await expect(
        branchFromVersion('idea-1', 'ver-1', 'user-1')
      ).rejects.toThrow();
    });
  });
});
