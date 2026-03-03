import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canCreateIdea } from '@/lib/auth';
import { listIdeas, createIdea } from '@/lib/services/idea-service';
import { IdeaStatus } from '@prisma/client';
import { createIdeaSchema } from '@/lib/validations/idea-validation';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as IdeaStatus | null;
    const search = searchParams.get('search') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10') || 10));
    const validSortBy = ['createdAt', 'updatedAt', 'title'] as const;
    const sortByParam = searchParams.get('sortBy') ?? '';
    const sortBy = validSortBy.includes(sortByParam as typeof validSortBy[number])
      ? (sortByParam as typeof validSortBy[number])
      : 'updatedAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const result = await listIdeas({
      status: status ?? undefined,
      search,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing ideas:', error);
    return NextResponse.json(
      { error: 'Failed to list ideas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check subscription limits
    const canCreate = await canCreateIdea(user.id);
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Idea limit reached. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const idea = await createIdea({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      industry: parsed.data.industry,
      targetMarket: parsed.data.targetMarket,
      technologies: parsed.data.technologies ?? [],
      features: (parsed.data.features ?? []).map((f) => ({
        id: uuidv4(),
        name: f.name,
        description: f.description ?? '',
        priority: f.priority ?? 'medium',
      })),
    });

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating idea:', error);
    return NextResponse.json(
      { error: 'Failed to create idea' },
      { status: 500 }
    );
  }
}
