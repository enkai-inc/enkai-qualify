import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireInternalAuth } from '@/lib/internal-auth';
import { v4 as uuidv4 } from 'uuid';

const generationResultSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  features: z.array(z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
  })).max(50),
  technologies: z.array(z.string().max(50)).max(20),
  summary: z.string().optional(),
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
    const result = generationResultSchema.parse(body);

    const idea = await prisma.idea.findUnique({
      where: { id },
      select: { id: true, status: true, currentVersion: true },
    });

    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    if (idea.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Idea is not pending (status: ${idea.status})` },
        { status: 409 }
      );
    }

    const features = result.features.map((f) => ({
      id: uuidv4(),
      name: f.name,
      description: f.description ?? '',
      priority: f.priority ?? 'medium',
    }));

    const [updatedIdea, version] = await prisma.$transaction([
      prisma.idea.update({
        where: { id },
        data: {
          title: result.title,
          description: result.description,
          features,
          technologies: result.technologies,
          status: 'DRAFT',
          currentVersion: 1,
        },
      }),
      prisma.ideaVersion.create({
        data: {
          ideaId: id,
          version: 1,
          snapshot: {
            title: result.title,
            description: result.description,
            features,
            technologies: result.technologies,
          },
          summary: result.summary || 'AI-generated idea',
        },
      }),
    ]);

    return NextResponse.json({
      id: updatedIdea.id,
      version: version.version,
      status: 'DRAFT',
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error storing generation result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
