import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireInternalAuth } from '@/lib/internal-auth';
import { createPack } from '@/lib/services/pack-service';
import { logger } from '@/lib/logger';

const validationResultSchema = z.object({
  keywordScore: z.number().int().min(0).max(100),
  painPointScore: z.number().int().min(0).max(100),
  competitionScore: z.number().int().min(0).max(100),
  revenueEstimate: z.number().int().min(0),
  overallScore: z.number().int().min(0).max(100),
  details: z.record(z.string(), z.unknown()),
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
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
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
        details: result.details as Record<string, unknown> as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    // Update idea status to VALIDATED if score >= 60 and auto-trigger pack
    if (result.overallScore >= 60) {
      const updatedIdea = await prisma.idea.update({
        where: { id },
        data: { status: 'VALIDATED' },
        select: { id: true, userId: true, teamId: true },
      });

      // Auto-generate MVP pack with default modules
      const defaultModules = ['auth', 'database', 'api', 'dashboard', 'landing'];
      try {
        // Check if a pack is already pending/generating for this idea
        const existingPack = await prisma.pack.findFirst({
          where: { ideaId: id, status: { in: ['PENDING', 'GENERATING', 'READY'] } },
        });
        if (!existingPack) {
          await createPack({
            ideaId: id,
            userId: updatedIdea.userId,
            teamId: updatedIdea.teamId ?? undefined,
            modules: defaultModules,
            complexity: 'MVP',
          });
        }
      } catch (packError) {
        // Log but don't fail the validation callback
        logger.error('Auto pack generation failed to start', { error: packError instanceof Error ? packError.message : String(packError) });
      }
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
    logger.error('Error creating validation result', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
