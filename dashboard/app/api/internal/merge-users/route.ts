import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/internal/merge-users
 * Finds duplicate users (same email, different IDs) and merges their ideas
 * into the user with the real (non-internal) cognitoId.
 */
export async function POST() {
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
      // Move all ideas from internal user to real user
      const moveResult = await prisma.idea.updateMany({
        where: { userId: internalUser.id },
        data: { userId: realUser.id },
      });

      // Move market scans too
      const scanResult = await prisma.marketScan.updateMany({
        where: { userId: internalUser.id },
        data: { userId: realUser.id },
      });

      // Delete the internal user (subscription cascades)
      await prisma.user.delete({
        where: { id: internalUser.id },
      });

      results.push({
        email: internalUser.email,
        internalUserId: internalUser.id,
        realUserId: realUser.id,
        ideasMoved: moveResult.count,
        scansMoved: scanResult.count,
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

export async function GET() {
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
