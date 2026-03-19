import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canGeneratePack } from '@/lib/auth';
import { createPack, listPacks } from '@/lib/services/pack-service';
import { createPackSchema } from '@/lib/validations/pack-validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }
    const packs = await listPacks(user.teamId);

    return NextResponse.json({ items: packs }, {
      headers: { 'Cache-Control': 'no-store, private' },
    });
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
    if (!user.teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 403 });
    }

    // Rate limit: 10 pack creations per hour
    const rateLimit = checkRateLimit(`packs:${user.id}`, { maxRequests: 10, windowMs: 3600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Check subscription limits
    const canGenerate = await canGeneratePack(user.id);
    if (!canGenerate) {
      return NextResponse.json(
        { error: 'Pack limit reached. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createPackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pack = await createPack({
      ideaId: parsed.data.ideaId,
      userId: user.id,
      teamId: user.teamId,
      modules: parsed.data.modules,
      complexity: parsed.data.complexity,
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
