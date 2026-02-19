import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { getIdea } from '@/lib/services/idea-service';
import { validateIdea } from '@/lib/services/ai-service';
import { prisma } from '@/lib/db';
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

    const rateLimit = checkRateLimit(`validate:${user.id}`, { maxRequests: 20, windowMs: 3600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    // Get current idea
    const result = await getIdea(id, user.id);
    if (!result) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { idea } = result;

    // Validate with AI
    const validation = await validateIdea({
      idea: {
        title: idea.title,
        description: idea.description,
        industry: idea.industry,
        targetMarket: idea.targetMarket,
        features: featuresSchema.parse(idea.features),
      },
    });

    // Store validation result
    const storedValidation = await prisma.validation.create({
      data: {
        ideaId: id,
        version: idea.currentVersion,
        keywordScore: validation.keywordScore,
        painPointScore: validation.painPointScore,
        competitionScore: validation.competitionScore,
        revenueEstimate: validation.revenueEstimate,
        overallScore: validation.overallScore,
        details: validation.details,
      },
    });

    // Update idea status if score is high enough
    if (validation.overallScore >= 60) {
      await prisma.idea.update({
        where: { id },
        data: { status: 'VALIDATED' },
      });
    }

    return NextResponse.json(storedValidation);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error validating idea:', error);
    return NextResponse.json(
      { error: 'Failed to validate idea' },
      { status: 500 }
    );
  }
}
