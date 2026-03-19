import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getIdea } from '@/lib/services/idea-service';
import { generateIdeaSummaryPdf } from '@/lib/pdf/idea-summary';
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

    const result = await getIdea(id, user.teamId);

    if (!result) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { idea, validation } = result;

    const features = Array.isArray(idea.features)
      ? (idea.features as Array<{ id: string; name: string; description: string; priority: 'high' | 'medium' | 'low' }>)
      : [];

    const pdf = await generateIdeaSummaryPdf(
      {
        title: idea.title,
        description: idea.description,
        industry: idea.industry,
        targetMarket: idea.targetMarket,
        technologies: idea.technologies,
        features,
        status: idea.status,
        createdAt: idea.createdAt,
      },
      validation
    );

    const sanitizedTitle = idea.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase() || 'idea';
    const filename = `${sanitizedTitle}-summary.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('Error generating PDF', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
