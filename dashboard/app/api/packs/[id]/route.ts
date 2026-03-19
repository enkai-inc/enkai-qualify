import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPack, getPackProgress } from '@/lib/services/pack-service';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }
    const { id } = await params;

    const pack = await getPack(id, user.teamId);

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    // Get progress info (teamId enforces access at the data layer)
    const progress = await getPackProgress(id, user.teamId);

    return NextResponse.json({
      ...pack,
      progress: progress.progress,
      progressMessage: progress.message,
    }, {
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('Error getting pack', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to get pack' },
      { status: 500 }
    );
  }
}
