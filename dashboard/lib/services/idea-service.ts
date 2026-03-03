import { prisma } from '@/lib/db';
import { IdeaStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const snapshotSchema = z.object({
  title: z.string(),
  description: z.string(),
  industry: z.string(),
  targetMarket: z.string(),
  technologies: z.array(z.string()),
  features: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
});

export interface CreateIdeaInput {
  userId: string;
  title: string;
  description: string;
  industry: string;
  targetMarket: string;
  technologies: string[];
  features: Array<{
    id: string;
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface UpdateIdeaInput {
  title?: string;
  description?: string;
  industry?: string;
  targetMarket?: string;
  technologies?: string[];
  features?: Array<{
    id: string;
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  status?: IdeaStatus;
}

export async function listIdeas(
  options: {
    status?: IdeaStatus;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'title';
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  const {
    status,
    search,
    page = 1,
    pageSize = 10,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = options;

  const where = {
    ...(status ? { status } : { status: { not: IdeaStatus.ARCHIVED } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [ideas, total] = await Promise.all([
    prisma.idea.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        validations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.idea.count({ where }),
  ]);

  return {
    items: ideas.map((idea) => ({
      ...idea,
      latestValidation: idea.validations[0] ?? null,
      validations: undefined,
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export async function getIdea(id: string) {
  const idea = await prisma.idea.findFirst({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
      validations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!idea) {
    return null;
  }

  return {
    idea: {
      ...idea,
      validations: undefined,
    },
    versions: idea.versions,
    validation: idea.validations[0] ?? null,
  };
}

export async function createIdea(input: CreateIdeaInput) {
  const idea = await prisma.idea.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description,
      industry: input.industry,
      targetMarket: input.targetMarket,
      technologies: input.technologies,
      features: input.features,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          snapshot: {
            title: input.title,
            description: input.description,
            industry: input.industry,
            targetMarket: input.targetMarket,
            technologies: input.technologies,
            features: input.features,
          },
          summary: 'Initial version',
        },
      },
    },
  });

  return idea;
}

export async function updateIdea(
  id: string,
  userId: string,
  input: UpdateIdeaInput,
  createVersion = true
) {
  // Verify ownership
  const existing = await prisma.idea.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error('Idea not found');
  }

  const nextVersion = existing.currentVersion + 1;

  const idea = await prisma.idea.update({
    where: { id },
    data: {
      ...input,
      ...(createVersion && {
        currentVersion: nextVersion,
        versions: {
          create: {
            version: nextVersion,
            snapshot: {
              title: input.title ?? existing.title,
              description: input.description ?? existing.description,
              industry: input.industry ?? existing.industry,
              targetMarket: input.targetMarket ?? existing.targetMarket,
              technologies: input.technologies ?? existing.technologies,
              features: input.features ?? existing.features,
            },
            summary: 'Updated idea',
            parentId: (
              await prisma.ideaVersion.findFirst({
                where: { ideaId: id, version: existing.currentVersion },
              })
            )?.id,
          },
        },
      }),
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });

  return idea;
}

export async function deleteIdea(id: string, userId: string) {
  // Verify ownership
  const existing = await prisma.idea.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error('Idea not found');
  }

  // Soft delete by archiving
  await prisma.idea.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });
}

export async function restoreVersion(
  ideaId: string,
  versionId: string,
  userId: string
) {
  // Verify ownership
  const idea = await prisma.idea.findFirst({
    where: { id: ideaId, userId },
  });

  if (!idea) {
    throw new Error('Idea not found');
  }

  const version = await prisma.ideaVersion.findFirst({
    where: { id: versionId, ideaId },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  const snapshot = snapshotSchema.parse(version.snapshot);
  const nextVersion = idea.currentVersion + 1;

  const updatedIdea = await prisma.idea.update({
    where: { id: ideaId },
    data: {
      title: snapshot.title,
      description: snapshot.description,
      industry: snapshot.industry,
      targetMarket: snapshot.targetMarket,
      technologies: snapshot.technologies,
      features: snapshot.features,
      currentVersion: nextVersion,
      versions: {
        create: {
          version: nextVersion,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          summary: `Restored from v${version.version}`,
          parentId: versionId,
        },
      },
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });

  return updatedIdea;
}

export async function branchFromVersion(
  ideaId: string,
  versionId: string,
  userId: string
) {
  // Verify ownership
  const idea = await prisma.idea.findFirst({
    where: { id: ideaId, userId },
  });

  if (!idea) {
    throw new Error('Idea not found');
  }

  const version = await prisma.ideaVersion.findFirst({
    where: { id: versionId, ideaId },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  const snapshot = snapshotSchema.parse(version.snapshot);

  // Create a new idea as a branch
  const newIdea = await prisma.idea.create({
    data: {
      userId,
      title: `${snapshot.title} (Branch)`,
      description: snapshot.description,
      industry: snapshot.industry,
      targetMarket: snapshot.targetMarket,
      technologies: snapshot.technologies,
      features: snapshot.features,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          summary: `Branched from ${idea.title} v${version.version}`,
          parentId: versionId,
        },
      },
    },
    include: {
      versions: true,
    },
  });

  return newIdea;
}
