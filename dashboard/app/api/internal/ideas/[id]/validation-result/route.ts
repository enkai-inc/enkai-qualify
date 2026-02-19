import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireInternalAuth } from '@/lib/internal-auth';

const validationResultSchema = z.object({
  keywordScore: z.number().int().min(0).max(100),
  painPointScore: z.number().int().min(0).max(100),
  competitionScore: z.number().int().min(0).max(100),
  revenueEstimate: z.number().int().min(0),
  overallScore: z.number().int().min(0).max(100),
  details: z.object({
    marketSize: z.string(),
    competitorCount: z.number(),
    feasibilityNotes: z.string(),
  }),
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
    const result = validationResultSchema.parse(body);

    // Get current idea version
    const idea = await prisma.idea.findUnique({
      where: { id },
      select: { id: true, currentVersion: true },
    });

    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    // Create validation record
    const validation = await prisma.validation.create({
      data: {
        ideaId: id,
        version: idea.currentVersion,
        keywordScore: result.keywordScore,
        painPointScore: result.painPointScore,
        competitionScore: result.competitionScore,
        revenueEstimate: result.revenueEstimate,
        overallScore: result.overallScore,
        details: result.details,
      },
    });

    // Update idea status to VALIDATED if score >= 60
    if (result.overallScore >= 60) {
      await prisma.idea.update({
        where: { id },
        data: { status: 'VALIDATED' },
      });
    }

    return NextResponse.json({
      id: validation.id,
      status: 'created',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating validation result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
