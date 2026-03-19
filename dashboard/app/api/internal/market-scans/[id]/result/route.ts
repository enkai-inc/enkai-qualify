import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireInternalAuth } from '@/lib/internal-auth';

const opportunitySchema = z.object({
  rank: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  problemStatement: z.string().min(1),
  demandSignals: z.array(z.string()),
  score: z.number().min(0).max(100),
  keywords: z.array(z.string()),
  monthlySearchVolume: z.number().int().min(0),
  competition: z.enum(['low', 'medium', 'high']),
  trendDirection: z.enum(['rising', 'stable', 'declining']),
  estimatedRevenue: z.string(),
  sources: z.array(z.string()),
});

const resultSchema = z.object({
  opportunities: z.array(opportunitySchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
    const result = resultSchema.parse(body);

    const scan = await prisma.marketScan.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Market scan not found' }, { status: 404 });
    }

    await prisma.marketScan.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        opportunities: result.opportunities as any,
        metadata: result.metadata as any ?? undefined,
      },
    });

    return NextResponse.json({
      id,
      status: 'updated',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating market scan result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
