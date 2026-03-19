import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }

    const scans = await prisma.marketScan.findMany({
      where: { teamId: user.teamId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        industry: true,
        niche: true,
        status: true,
        opportunities: true,
        createdAt: true,
      },
    });

    const results = scans.map((scan) => ({
      id: scan.id,
      industry: scan.industry,
      niche: scan.niche,
      status: scan.status,
      opportunityCount: Array.isArray(scan.opportunities) ? scan.opportunities.length : 0,
      createdAt: scan.createdAt.toISOString(),
    }));

    return NextResponse.json({ scans: results }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing market scans:', error);
    return NextResponse.json(
      { error: 'Failed to list market scans' },
      { status: 500 }
    );
  }
}
