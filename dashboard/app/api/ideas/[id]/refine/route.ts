import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getIdea } from '@/lib/services/idea-service';
import { createRefinementIssue } from '@/lib/services/github-service';
import { checkRateLimit } from '@/lib/rate-limit';

const featuresSchema = z.array(z.object({
  name: z.string(),
  description: z.string(),
})).catch([]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    const rateLimit = checkRateLimit(`refine:${user.id}`, { maxRequests: 20, windowMs: 3600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (typeof body.prompt !== 'string' || body.prompt.length > 2000) {
      return NextResponse.json(
        { error: 'Prompt must be a string of 2000 characters or less' },
        { status: 400 }
      );
    }

    // Get current idea
    const result = await getIdea(id);
    if (!result) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { idea } = result;

    // Create GitHub issue for async processing
    const { issueNumber, issueUrl } = await createRefinementIssue({
      ideaId: id,
      userId: user.id,
      title: idea.title,
      description: idea.description,
      industry: idea.industry,
      targetMarket: idea.targetMarket,
      technologies: idea.technologies,
      features: featuresSchema.parse(idea.features),
      prompt: body.prompt,
    });

    return NextResponse.json(
      {
        status: 'pending',
        githubIssue: issueNumber,
        githubIssueUrl: issueUrl,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating refinement issue:', error);
    return NextResponse.json(
      { error: 'Failed to submit refinement request' },
      { status: 500 }
    );
  }
}
