import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPack, getPackProgress } from '@/lib/services/pack-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const pack = await getPack(id, user.teamId!);

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    // Get progress info (teamId enforces access at the data layer)
    const progress = await getPackProgress(id, user.teamId!);

    return NextResponse.json({
      ...pack,
      progress: progress.progress,
      progressMessage: progress.message,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting pack:', error);
    return NextResponse.json(
      { error: 'Failed to get pack' },
      { status: 500 }
    );
  }
}
