import { prisma } from '@/lib/db';
import { PackStatus } from '@prisma/client';

export interface CreatePackInput {
  ideaId: string;
  userId: string;
  modules: string[];
  complexity: 'MVP' | 'STANDARD' | 'FULL';
}

export async function createPack(input: CreatePackInput) {
  // Calculate work units based on complexity
  const workUnitMultiplier = {
    MVP: 1,
    STANDARD: 2,
    FULL: 3,
  };

  const pack = await prisma.pack.create({
    data: {
      ideaId: input.ideaId,
      userId: input.userId,
      modules: input.modules,
      complexity: input.complexity,
      workUnitCount: input.modules.length * workUnitMultiplier[input.complexity],
      status: 'PENDING',
    },
  });

  // In a real implementation, this would trigger a background job
  // For now, we simulate async pack generation
  generatePackAsync(pack.id).catch(console.error);

  return pack;
}

export async function getPack(id: string, userId: string) {
  const pack = await prisma.pack.findFirst({
    where: { id, userId },
    include: {
      idea: {
        select: {
          title: true,
          description: true,
        },
      },
    },
  });

  return pack;
}

export async function listPacks(userId: string) {
  const packs = await prisma.pack.findMany({
    where: { userId },
    include: {
      idea: {
        select: {
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return packs;
}

async function generatePackAsync(packId: string) {
  // Update status to GENERATING
  await prisma.pack.update({
    where: { id: packId },
    data: { status: 'GENERATING' },
  });

  // Simulate pack generation time (2-5 seconds)
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));

  // In production, this would:
  // 1. Load module templates from the module library
  // 2. Customize templates based on idea features
  // 3. Bundle into a downloadable package
  // 4. Upload to S3
  // 5. Generate signed download URL

  // For now, simulate success
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.pack.update({
    where: { id: packId },
    data: {
      status: 'READY',
      s3Key: `packs/${packId}/bundle.zip`,
      downloadUrl: `https://metis-packs.s3.amazonaws.com/packs/${packId}/bundle.zip`,
      expiresAt,
    },
  });

  // Update subscription usage
  const pack = await prisma.pack.findUnique({
    where: { id: packId },
    select: { userId: true },
  });

  if (pack) {
    await prisma.subscription.update({
      where: { userId: pack.userId },
      data: { packsUsed: { increment: 1 } },
    });
  }
}

export async function getPackProgress(id: string, userId: string): Promise<{
  status: PackStatus;
  progress: number;
  message: string;
}> {
  const pack = await prisma.pack.findFirst({
    where: { id, userId },
    select: { status: true },
  });

  if (!pack) {
    throw new Error('Pack not found');
  }

  const progressMap: Record<PackStatus, { progress: number; message: string }> = {
    PENDING: { progress: 0, message: 'Queued for generation...' },
    GENERATING: { progress: 50, message: 'Building your deployment pack...' },
    READY: { progress: 100, message: 'Pack ready for download!' },
    EXPIRED: { progress: 100, message: 'Download link has expired. Generate a new pack.' },
    FAILED: { progress: 0, message: 'Pack generation failed. Please try again.' },
  };

  return {
    status: pack.status,
    ...progressMap[pack.status],
  };
}
