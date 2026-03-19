import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getIdea, updateIdea, deleteIdea } from '@/lib/services/idea-service';
import { logger } from '@/lib/logger';

const updateIdeaSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  industry: z.string().max(100).optional(),
  targetMarket: z.string().max(100).optional(),
  technologies: z.array(z.string().max(100)).max(20).optional(),
  features: z.array(z.object({
    id: z.string(),
    name: z.string().max(100),
    description: z.string().max(500),
    priority: z.enum(['high', 'medium', 'low']),
  })).max(50).optional(),
  status: z.enum(['PENDING', 'DRAFT', 'VALIDATED', 'PACK_GENERATED', 'ARCHIVED']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }
    const { id } = await params;

    const result = await getIdea(id, user.teamId);

    if (!result) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('Error getting idea', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to get idea' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();

    const parsed = updateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: 'Invalid input fields' },
        { status: 400 }
      );
    }

    const idea = await updateIdea(id, user.teamId, parsed.data);

    return NextResponse.json(idea);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Idea not found') {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }
    logger.error('Error updating idea', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update idea' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }
    const { id } = await params;

    await deleteIdea(id, user.teamId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Idea not found') {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }
    logger.error('Error deleting idea', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete idea' },
      { status: 500 }
    );
  }
}
