import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getIdea, updateIdea } from '@/lib/services/idea-service';
import { refineIdea } from '@/lib/services/ai-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Get current idea
    const result = await getIdea(id, user.id);
    if (!result) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { idea } = result;

    // Refine with AI
    const refined = await refineIdea({
      idea: {
        title: idea.title,
        description: idea.description,
        industry: idea.industry,
        targetMarket: idea.targetMarket,
        technologies: idea.technologies,
        features: (idea.features as Array<{ name: string; description: string }>),
      },
      prompt: body.prompt,
    });

    // Update idea with refined version
    const updated = await updateIdea(id, user.id, {
      title: refined.title,
      description: refined.description,
      features: refined.features,
      technologies: refined.technologies,
    });

    return NextResponse.json({
      idea: updated,
      summary: refined.summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error refining idea:', error);
    return NextResponse.json(
      { error: 'Failed to refine idea' },
      { status: 500 }
    );
  }
}
