import { NextRequest, NextResponse } from 'next/server';
import { requireInternalAuth } from '@/lib/internal-auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/internal/merge-users
 * Finds duplicate users (same email, different IDs) and merges their ideas
 * into the user with the real (non-internal) cognitoId.
 * Requires internal auth and wraps all mutations in a transaction.
 */
export async function POST(request: NextRequest) {
  try {
    requireInternalAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find users with synthetic internal- cognitoIds
  const internalUsers = await prisma.user.findMany({
    where: {
      cognitoId: { startsWith: 'internal-' },
    },
    include: {
      ideas: { select: { id: true } },
      subscription: true,
    },
  });

  const results = [];

  for (const internalUser of internalUsers) {
    // Check if there's a "real" user with the same email
    const realUser = await prisma.user.findFirst({
      where: {
        email: internalUser.email,
        NOT: { cognitoId: { startsWith: 'internal-' } },
      },
    });

    if (realUser && realUser.id !== internalUser.id) {
      // Wrap all mutations in a transaction for atomicity
      const mergeResult = await prisma.$transaction(async (tx) => {
        const moveResult = await tx.idea.updateMany({
          where: { userId: internalUser.id },
          data: { userId: realUser.id },
        });

        const scanResult = await tx.marketScan.updateMany({
          where: { userId: internalUser.id },
          data: { userId: realUser.id },
        });

        await tx.user.delete({
          where: { id: internalUser.id },
        });

        return { ideasMoved: moveResult.count, scansMoved: scanResult.count };
      });

      results.push({
        email: internalUser.email,
        internalUserId: internalUser.id,
        realUserId: realUser.id,
        ideasMoved: mergeResult.ideasMoved,
        scansMoved: mergeResult.scansMoved,
        action: 'merged',
      });
    } else if (!realUser) {
      // No real user exists — this internal user IS the primary
      results.push({
        email: internalUser.email,
        internalUserId: internalUser.id,
        ideasCount: internalUser.ideas.length,
        action: 'skipped_no_real_user',
      });
    }
  }

  return NextResponse.json({
    processed: internalUsers.length,
    results,
  });
}

export async function GET(request: NextRequest) {
  try {
    requireInternalAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Preview mode: show what would be merged without actually doing it
  const internalUsers = await prisma.user.findMany({
    where: {
      cognitoId: { startsWith: 'internal-' },
    },
    include: {
      ideas: { select: { id: true, title: true } },
    },
  });

  const preview = [];

  for (const internalUser of internalUsers) {
    const realUser = await prisma.user.findFirst({
      where: {
        email: internalUser.email,
        NOT: { cognitoId: { startsWith: 'internal-' } },
      },
      include: {
        ideas: { select: { id: true, title: true } },
      },
    });

    preview.push({
      email: internalUser.email,
      internalUser: {
        id: internalUser.id,
        cognitoId: internalUser.cognitoId,
        ideas: internalUser.ideas,
      },
      realUser: realUser
        ? {
            id: realUser.id,
            cognitoId: realUser.cognitoId,
            ideas: realUser.ideas,
          }
        : null,
      wouldMerge: !!realUser && realUser.id !== internalUser.id,
    });
  }

  return NextResponse.json({ preview });
}
