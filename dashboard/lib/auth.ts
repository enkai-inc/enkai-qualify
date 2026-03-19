import { headers } from 'next/headers';
import { IdeaStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db';
import { logger } from './logger';

const oidcPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
}).passthrough();

/**
 * Cognito user info extracted from ALB headers
 */
export interface CognitoUser {
  sub: string; // Cognito user ID
  email: string;
  name?: string;
  emailVerified?: boolean;
}

/**
 * Parse the x-amzn-oidc-data JWT payload (base64 encoded)
 * ALB passes this header with user claims from Cognito
 */
function parseOidcData(oidcData: string): CognitoUser | null {
  try {
    // JWT format: header.payload.signature
    const parts = oidcData.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    const validated = oidcPayloadSchema.safeParse(payload);
    if (!validated.success) {
      return null;
    }

    return {
      sub: validated.data.sub,
      email: validated.data.email,
      name: payload.name || payload.given_name,
      emailVerified: payload.email_verified,
    };
  } catch {
    return null;
  }
}

/**
 * Get the current authenticated user from Cognito (via ALB headers) and sync with database
 */
export async function getCurrentUser() {
  const headersList = await headers();

  // ALB passes Cognito user info in these headers
  const oidcData = headersList.get('x-amzn-oidc-data');
  const cognitoId = headersList.get('x-amzn-oidc-identity');

  if (!cognitoId || !oidcData) {
    return null;
  }

  const cognitoUser = parseOidcData(oidcData);
  if (!cognitoUser) {
    return null;
  }

  const DEFAULT_TEAM_ID = 'default-team';

  // Try to find existing user by real cognitoId
  let user = await prisma.user.findUnique({
    where: { cognitoId },
    include: {
      subscription: true,
      team: true,
    },
  });

  if (user) {
    // Check if there's also an old internal-* user with the same email that has ideas
    // This handles the case where ideas were created via internal API with a synthetic cognitoId
    const internalUser = await prisma.user.findFirst({
      where: {
        email: user.email,
        cognitoId: { startsWith: 'internal-' },
        NOT: { id: user.id },
      },
      include: { _count: { select: { ideas: true } } },
    });

    if (internalUser && internalUser._count.ideas > 0) {
      // Merge: move ideas and scans from internal user to real user, then delete internal user
      await prisma.idea.updateMany({
        where: { userId: internalUser.id },
        data: { userId: user.id },
      });
      await prisma.marketScan.updateMany({
        where: { userId: internalUser.id },
        data: { userId: user.id },
      });
      await prisma.user.delete({ where: { id: internalUser.id } });
    } else if (internalUser) {
      // No ideas, just clean up the duplicate
      await prisma.user.delete({ where: { id: internalUser.id } });
    }

    // Auto-assign to default team if no team
    if (!user.teamId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { teamId: DEFAULT_TEAM_ID },
        include: { subscription: true, team: true },
      });
    }

    return user;
  }

  // Check if user exists by email (e.g., created via internal API with synthetic cognitoId)
  const existingByEmail = await prisma.user.findUnique({
    where: { email: cognitoUser.email },
    include: { subscription: true, team: true },
  });

  if (existingByEmail) {
    // Update the cognitoId to the real one so future lookups work directly
    // Also auto-assign to default team if no team
    return await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        cognitoId,
        ...(existingByEmail.teamId ? {} : { teamId: DEFAULT_TEAM_ID }),
      },
      include: { subscription: true, team: true },
    });
  }

  // If user doesn't exist at all, create them (handle race condition with retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      user = await prisma.user.create({
        data: {
          cognitoId,
          email: cognitoUser.email,
          name: cognitoUser.name || null,
          teamId: DEFAULT_TEAM_ID,
          subscription: {
            create: {
              tier: 'FREE',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          },
        },
        include: {
          subscription: true,
          team: true,
        },
      });
      return user;
    } catch (error) {
      // Handle race condition: another request created the user first
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Could be cognitoId or email conflict — try both lookups
        const found = await prisma.user.findUnique({
          where: { cognitoId },
          include: { subscription: true, team: true },
        }) ?? await prisma.user.findUnique({
          where: { email: cognitoUser.email },
          include: { subscription: true, team: true },
        });
        if (found) return found;
        // If neither lookup found the user, retry the create (transient race)
        continue;
      }
      throw error;
    }
  }
  // Final fallback: should not reach here, but return null safely
  logger.warn('User creation failed after retries', { cognitoId, email: cognitoUser.email });
  return null;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Get subscription limits based on tier
 */
export function getSubscriptionLimits(tier: string) {
  const limits = {
    FREE: { ideas: 3, packs: 1 },
    EXPLORER: { ideas: 10, packs: 5 },
    BUILDER: { ideas: 50, packs: 25 },
    AGENCY: { ideas: -1, packs: -1 }, // unlimited
  };

  return limits[tier as keyof typeof limits] ?? limits.FREE;
}

/**
 * Check if user's team can create more ideas (team-scoped limit)
 */
export async function canCreateIdea(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user?.subscription) return false;

  const limits = getSubscriptionLimits(user.subscription.tier);
  if (limits.ideas === -1) return true; // unlimited

  // Count non-archived ideas across the team
  const teamIdeaCount = user.teamId
    ? await prisma.idea.count({
        where: { teamId: user.teamId, status: { not: IdeaStatus.ARCHIVED } },
      })
    : await prisma.idea.count({
        where: { userId, status: { not: IdeaStatus.ARCHIVED } },
      });

  return teamIdeaCount < limits.ideas;
}

/**
 * Check if user can generate more packs
 */
export async function canGeneratePack(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
    },
  });

  if (!user?.subscription) return false;

  const limits = getSubscriptionLimits(user.subscription.tier);
  if (limits.packs === -1) return true; // unlimited

  return user.subscription.packsUsed < limits.packs;
}
