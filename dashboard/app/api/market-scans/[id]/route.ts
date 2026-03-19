import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }
    const { id } = await params;

    const scan = await prisma.marketScan.findFirst({
      where: { id, teamId: user.teamId },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Market scan not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: scan.id,
      industry: scan.industry,
      niche: scan.niche,
      status: scan.status,
      opportunities: scan.opportunities || [],
      metadata: scan.metadata,
      githubIssue: scan.githubIssue,
      githubIssueUrl: scan.githubIssueUrl,
      errorMessage: scan.errorMessage,
      createdAt: scan.createdAt.toISOString(),
      updatedAt: scan.updatedAt.toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('Error fetching market scan', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch market scan' },
      { status: 500 }
    );
  }
}
