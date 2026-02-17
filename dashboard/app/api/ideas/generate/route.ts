import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canCreateIdea } from '@/lib/auth';
import { generateIdea } from '@/lib/services/ai-service';
import { createIdea } from '@/lib/services/idea-service';

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

    if (!body.industry || !body.targetMarket || !body.problemDescription) {
      return NextResponse.json(
        { error: 'Industry, target market, and problem description are required' },
        { status: 400 }
      );
    }

    // Generate idea with AI
    const generated = await generateIdea({
      industry: body.industry,
      targetMarket: body.targetMarket,
      problemDescription: body.problemDescription,
      preferences: body.preferences,
    });

    // If saveImmediately is true, create the idea
    if (body.saveImmediately) {
      const idea = await createIdea({
        userId: user.id,
        title: generated.title,
        description: generated.description,
        industry: body.industry,
        targetMarket: body.targetMarket,
        technologies: generated.technologies,
        features: generated.features,
      });

      return NextResponse.json({
        idea,
        generated,
      }, { status: 201 });
    }

    // Just return the generated idea for review
    return NextResponse.json({
      generated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error generating idea:', error);
    return NextResponse.json(
      { error: 'Failed to generate idea' },
      { status: 500 }
    );
  }
}
