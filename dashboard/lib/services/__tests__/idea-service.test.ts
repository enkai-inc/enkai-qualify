import { listIdeas } from '../idea-service';

// Mock the prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    idea: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('idea-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listIdeas', () => {
    const teamId = 'default-team';

    it('should exclude ARCHIVED ideas when no status filter is provided', async () => {
      (mockPrisma.idea.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.idea.count as jest.Mock).mockResolvedValue(0);

      await listIdeas(teamId);

      const expectedWhere = {
        teamId,
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

      await listIdeas(teamId, { status: 'DRAFT' as any });

      const expectedWhere = {
        teamId,
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

      await listIdeas(teamId, { status: 'ARCHIVED' as any });

      const expectedWhere = {
        teamId,
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
});
