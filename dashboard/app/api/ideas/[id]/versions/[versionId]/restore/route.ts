import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { restoreVersion } from '@/lib/services/idea-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, versionId } = await params;

    const idea = await restoreVersion(id, versionId, user.teamId!);

    return NextResponse.json({
      idea,
      versions: idea.versions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Idea not found') {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'Version not found') {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    console.error('Error restoring version:', error);
    return NextResponse.json(
      { error: 'Failed to restore version' },
      { status: 500 }
    );
  }
}
