import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canCreateIdea } from '@/lib/auth';
import { listIdeas, createIdea } from '@/lib/services/idea-service';
import { IdeaStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as IdeaStatus | null;
    const search = searchParams.get('search') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const pageSize = parseInt(searchParams.get('pageSize') ?? '10');
    const sortBy = (searchParams.get('sortBy') ?? 'updatedAt') as
      | 'createdAt'
      | 'updatedAt'
      | 'title';
    const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as
      | 'asc'
      | 'desc';

    const result = await listIdeas(user.id, {
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

    const idea = await createIdea({
      userId: user.id,
      title: body.title,
      description: body.description,
      industry: body.industry,
      targetMarket: body.targetMarket,
      technologies: body.technologies ?? [],
      features: body.features ?? [],
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
