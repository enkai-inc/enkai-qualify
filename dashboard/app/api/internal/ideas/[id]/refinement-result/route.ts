import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireInternalAuth } from '@/lib/internal-auth';

const refinementResultSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  features: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
  })),
  technologies: z.array(z.string()),
  summary: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireInternalAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = refinementResultSchema.parse(body);

    // Get current idea
    const idea = await prisma.idea.findUnique({
      where: { id },
      select: { id: true, currentVersion: true },
    });

    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const nextVersion = idea.currentVersion + 1;

    // Find parent version for version chain
    const parentVersion = await prisma.ideaVersion.findUnique({
      where: {
        ideaId_version: {
          ideaId: id,
          version: idea.currentVersion,
        },
      },
      select: { id: true },
    });

    // Update idea and create version in a transaction
    const [updatedIdea, version] = await prisma.$transaction([
      prisma.idea.update({
        where: { id },
        data: {
          title: result.title,
          description: result.description,
          features: result.features,
          technologies: result.technologies,
          currentVersion: nextVersion,
        },
      }),
      prisma.ideaVersion.create({
        data: {
          ideaId: id,
          version: nextVersion,
          snapshot: {
            title: result.title,
            description: result.description,
            features: result.features,
            technologies: result.technologies,
          },
          summary: result.summary || 'AI-refined idea',
          parentId: parentVersion?.id ?? null,
        },
      }),
    ]);

    return NextResponse.json({
      id: updatedIdea.id,
      version: version.version,
      status: 'updated',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating refinement result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
