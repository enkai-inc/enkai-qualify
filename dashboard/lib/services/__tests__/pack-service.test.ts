import { getPack, getPackProgress } from '../pack-service';

// Mock the prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    pack: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('pack-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPackProgress', () => {
    it('should accept teamId parameter for access verification', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue({
        status: 'READY',
      });

      await getPackProgress('pack-123', 'team-456');

      // Verify findFirst is called with both id and teamId
      expect(mockPrisma.pack.findFirst).toHaveBeenCalledWith({
        where: { id: 'pack-123', teamId: 'team-456' },
        select: { status: true },
      });
    });

    it('should throw "Pack not found" when pack does not exist', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(getPackProgress('pack-123', 'team-456')).rejects.toThrow(
        'Pack not found'
      );
    });

    it('should throw "Pack not found" when teamId does not match', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        getPackProgress('pack-123', 'wrong-team')
      ).rejects.toThrow('Pack not found');
    });

    it('should return correct progress for PENDING status', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue({
        status: 'PENDING',
      });

      const result = await getPackProgress('pack-123', 'team-456');

      expect(result).toEqual({
        status: 'PENDING',
        progress: 0,
        message: 'Queued for generation...',
      });
    });

    it('should return correct progress for GENERATING status', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue({
        status: 'GENERATING',
      });

      const result = await getPackProgress('pack-123', 'team-456');

      expect(result).toEqual({
        status: 'GENERATING',
        progress: 50,
        message: 'Building your deployment pack...',
      });
    });

    it('should return correct progress for READY status', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue({
        status: 'READY',
      });

      const result = await getPackProgress('pack-123', 'team-456');

      expect(result).toEqual({
        status: 'READY',
        progress: 100,
        message: 'Pack ready for download!',
      });
    });
  });

  describe('getPack', () => {
    it('should filter by both id and teamId', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue({
        id: 'pack-123',
        teamId: 'team-456',
      });

      await getPack('pack-123', 'team-456');

      expect(mockPrisma.pack.findFirst).toHaveBeenCalledWith({
        where: { id: 'pack-123', teamId: 'team-456' },
        include: {
          idea: {
            select: {
              title: true,
              description: true,
            },
          },
        },
      });
    });

    it('should return null when pack does not belong to team', async () => {
      (mockPrisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getPack('pack-123', 'wrong-team');

      expect(result).toBeNull();
    });
  });
});
