import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canGeneratePack } from '@/lib/auth';
import { createPack, listPacks } from '@/lib/services/pack-service';

export async function GET() {
  try {
    const user = await requireAuth();
    const packs = await listPacks(user.id);

    return NextResponse.json({ items: packs });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing packs:', error);
    return NextResponse.json(
      { error: 'Failed to list packs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check subscription limits
    const canGenerate = await canGeneratePack(user.id);
    if (!canGenerate) {
      return NextResponse.json(
        { error: 'Pack limit reached. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.ideaId || !body.modules || !body.complexity) {
      return NextResponse.json(
        { error: 'Missing required fields: ideaId, modules, complexity' },
        { status: 400 }
      );
    }

    const pack = await createPack({
      ideaId: body.ideaId,
      userId: user.id,
      modules: body.modules,
      complexity: body.complexity,
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating pack:', error);
    return NextResponse.json(
      { error: 'Failed to create pack' },
      { status: 500 }
    );
  }
}
