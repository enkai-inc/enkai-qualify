import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createMarketScanIssue } from '@/lib/services/github-service';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const rateLimit = checkRateLimit(`market-scan:${user.id}`, { maxRequests: 3, windowMs: 3600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (typeof body.industry === 'string') body.industry = body.industry.trim();
    if (typeof body.niche === 'string') body.niche = body.niche.trim();

    if (!body.industry || typeof body.industry !== 'string') {
      return NextResponse.json(
        { error: 'Industry is required' },
        { status: 400 }
      );
    }

    if (body.industry.length > 100) {
      return NextResponse.json(
        { error: 'Industry must be 100 characters or less' },
        { status: 400 }
      );
    }

    if (body.niche && (typeof body.niche !== 'string' || body.niche.length > 200)) {
      return NextResponse.json(
        { error: 'Niche must be a string of 200 characters or less' },
        { status: 400 }
      );
    }

    const scan = await prisma.marketScan.create({
      data: {
        userId: user.id,
        industry: body.industry,
        niche: body.niche || null,
        status: 'PENDING',
      },
    });

    const { issueNumber, issueUrl } = await createMarketScanIssue({
      scanId: scan.id,
      userId: user.id,
      industry: body.industry,
      niche: body.niche || undefined,
    });

    await prisma.marketScan.update({
      where: { id: scan.id },
      data: {
        githubIssue: issueNumber,
        githubIssueUrl: issueUrl,
      },
    });

    return NextResponse.json({
      id: scan.id,
      status: 'pending',
      githubIssue: issueNumber,
      githubIssueUrl: issueUrl,
    }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('Error creating market scan', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create market scan' },
      { status: 500 }
    );
  }
}
