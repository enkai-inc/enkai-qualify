import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canCreateIdea } from '@/lib/auth';
import { branchFromVersion } from '@/lib/services/idea-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const user = await requireAuth();

    // Check subscription limits
    const canCreate = await canCreateIdea(user.id);
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Idea limit reached. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    const { id, versionId } = await params;

    const newIdea = await branchFromVersion(id, versionId, user.id);

    return NextResponse.json({
      idea: newIdea,
      versions: newIdea.versions,
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
    console.error('Error branching version:', error);
    return NextResponse.json(
      { error: 'Failed to branch version' },
      { status: 500 }
    );
  }
}
