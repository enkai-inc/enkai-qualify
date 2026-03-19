import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canCreateIdea } from '@/lib/auth';
import { createIdeaGenerationIssue } from '@/lib/services/github-service';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const rateLimit = checkRateLimit(`generate:${user.id}`, { maxRequests: 5, windowMs: 3600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Check subscription limits
    const canCreate = await canCreateIdea(user.id);
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Idea limit reached. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Trim whitespace from string inputs
    if (typeof body.industry === 'string') body.industry = body.industry.trim();
    if (typeof body.targetMarket === 'string') body.targetMarket = body.targetMarket.trim();
    if (typeof body.problemDescription === 'string') body.problemDescription = body.problemDescription.trim();

    if (!body.industry || !body.targetMarket || !body.problemDescription) {
      return NextResponse.json(
        { error: 'Industry, target market, and problem description are required' },
        { status: 400 }
      );
    }

    if (typeof body.industry !== 'string' || body.industry.length > 100) {
      return NextResponse.json(
        { error: 'Industry must be a string of 100 characters or less' },
        { status: 400 }
      );
    }
    if (typeof body.targetMarket !== 'string' || body.targetMarket.length > 100) {
      return NextResponse.json(
        { error: 'Target market must be a string of 100 characters or less' },
        { status: 400 }
      );
    }
    if (typeof body.problemDescription !== 'string' || body.problemDescription.length > 2000) {
      return NextResponse.json(
        { error: 'Problem description must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Create a pending idea record in the database
    const ideaId = uuidv4();
    const idea = await prisma.idea.create({
      data: {
        id: ideaId,
        userId: user.id,
        teamId: user.teamId,
        title: `Generating: ${body.industry} opportunity...`,
        description: body.problemDescription,
        industry: body.industry,
        targetMarket: body.targetMarket,
        status: 'PENDING',
        technologies: [],
        features: [],
      },
    });

    // Create GitHub issue for processing by Frank container
    const { issueNumber, issueUrl } = await createIdeaGenerationIssue({
      ideaId: idea.id,
      userId: user.id,
      industry: body.industry,
      targetMarket: body.targetMarket,
      problemDescription: body.problemDescription,
      preferences: body.preferences,
    });

    // Update idea with issue reference
    await prisma.idea.update({
      where: { id: idea.id },
      data: {
        metadata: {
          githubIssue: issueNumber,
          githubIssueUrl: issueUrl,
        },
      },
    });

    return NextResponse.json({
      idea: {
        id: idea.id,
        status: 'PENDING',
        message: 'Your idea is being generated. Check back in a few minutes.',
        githubIssue: issueNumber,
        githubIssueUrl: issueUrl,
      },
    }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'GITHUB_TOKEN environment variable is not set') {
      return NextResponse.json(
        { error: 'GitHub integration not configured. Please contact support.' },
        { status: 503 }
      );
    }
    logger.error('Error generating idea', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to generate idea' },
      { status: 500 }
    );
  }
}
