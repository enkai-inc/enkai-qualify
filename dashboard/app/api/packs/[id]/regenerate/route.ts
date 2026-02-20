import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canGeneratePack } from '@/lib/auth';
import { regeneratePack } from '@/lib/services/pack-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check subscription limits (regeneration counts towards limit)
    const canGenerate = await canGeneratePack(user.id);
    if (!canGenerate) {
      return NextResponse.json(
        { error: 'Pack limit reached. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    const pack = await regeneratePack(id, user.id);

    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    return NextResponse.json(pack);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Pack not found') {
        return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
      }
      if (error.message === 'Can only regenerate expired or failed packs') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Error regenerating pack:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate pack' },
      { status: 500 }
    );
  }
}
