import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getIdea } from '@/lib/services/idea-service';
import { createValidationIssue } from '@/lib/services/github-service';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

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
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }

    const rateLimit = checkRateLimit(`validate:${user.id}`, { maxRequests: 20, windowMs: 3600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    // Get current idea
    const result = await getIdea(id, user.teamId);
    if (!result) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { idea } = result;

    // Create GitHub issue for async processing
    const { issueNumber, issueUrl } = await createValidationIssue({
      ideaId: id,
      userId: user.id,
      title: idea.title,
      description: idea.description,
      industry: idea.industry,
      targetMarket: idea.targetMarket,
      features: featuresSchema.parse(idea.features),
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
    logger.error('Error creating validation issue', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to submit validation request' },
      { status: 500 }
    );
  }
}
