import { prisma } from '@/lib/db';
import { PackStatus } from '@prisma/client';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generatePackZip, PackFeature, PackValidation } from './pack-generator';

const s3Client = new S3Client({});
const PACK_BUCKET = process.env.PACK_STORAGE_BUCKET || 'enkai-qualify-packs';
const PRESIGNED_URL_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

export interface CreatePackInput {
  ideaId: string;
  userId: string;
  teamId?: string;
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
      teamId: input.teamId,
      modules: input.modules,
      complexity: input.complexity,
      workUnitCount: input.modules.length * workUnitMultiplier[input.complexity],
      status: 'PENDING',
    },
  });

  generatePackAsync(pack.id).catch(console.error);

  return pack;
}

export async function getPack(id: string, teamId: string) {
  const pack = await prisma.pack.findFirst({
    where: { id, teamId },
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

export async function listPacks(teamId: string) {
  const packs = await prisma.pack.findMany({
    where: { teamId },
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
  try {
    // Update status to GENERATING
    await prisma.pack.update({
      where: { id: packId },
      data: { status: 'GENERATING' },
    });

    // Load full pack with idea data and latest validation
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
      include: {
        idea: {
          include: {
            validations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!pack || !pack.idea) {
      throw new Error(`Pack ${packId} or associated idea not found`);
    }

    const idea = pack.idea;
    const validation = idea.validations[0] ?? null;

    // Generate the ZIP buffer
    const zipBuffer = await generatePackZip({
      ideaTitle: idea.title,
      ideaDescription: idea.description,
      industry: idea.industry,
      targetMarket: idea.targetMarket,
      technologies: idea.technologies,
      features: (idea.features as unknown as PackFeature[]) || [],
      modules: pack.modules,
      complexity: pack.complexity as 'MVP' | 'STANDARD' | 'FULL',
      validation: validation
        ? ({
            keywordScore: validation.keywordScore,
            painPointScore: validation.painPointScore,
            competitionScore: validation.competitionScore,
            revenueEstimate: validation.revenueEstimate,
            overallScore: validation.overallScore,
          } as PackValidation)
        : null,
    });

    // Upload to S3
    const s3Key = `packs/${packId}/bundle.zip`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: PACK_BUCKET,
        Key: s3Key,
        Body: zipBuffer,
        ContentType: 'application/zip',
        ContentDisposition: `attachment; filename="${packId}.zip"`,
      })
    );

    // Generate presigned download URL
    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000);
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: PACK_BUCKET, Key: s3Key }),
      { expiresIn: PRESIGNED_URL_EXPIRY }
    );

    await prisma.pack.update({
      where: { id: packId },
      data: {
        status: 'READY',
        s3Key,
        downloadUrl,
        expiresAt,
      },
    });

    // Update subscription usage
    await prisma.subscription.update({
      where: { userId: pack.userId },
      data: { packsUsed: { increment: 1 } },
    });
  } catch (error) {
    console.error(`Pack generation failed for ${packId}:`, error);
    await prisma.pack.update({
      where: { id: packId },
      data: { status: 'FAILED' },
    });
  }
}

export async function regeneratePack(id: string, teamId: string) {
  // Find the existing pack
  const pack = await prisma.pack.findFirst({
    where: { id, teamId },
  });

  if (!pack) {
    throw new Error('Pack not found');
  }

  // Only allow regeneration for EXPIRED or FAILED packs
  if (!['EXPIRED', 'FAILED'].includes(pack.status)) {
    throw new Error('Can only regenerate expired or failed packs');
  }

  // Reset pack status and clear download info
  await prisma.pack.update({
    where: { id },
    data: {
      status: 'PENDING',
      s3Key: null,
      downloadUrl: null,
      expiresAt: null,
    },
  });

  // Trigger async generation
  generatePackAsync(id).catch(console.error);

  return prisma.pack.findUnique({
    where: { id },
    include: {
      idea: {
        select: {
          title: true,
        },
      },
    },
  });
}

export async function getPackProgress(id: string, teamId: string): Promise<{
  status: PackStatus;
  progress: number;
  message: string;
}> {
  const pack = await prisma.pack.findFirst({
    where: { id, teamId },
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
