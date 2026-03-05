import { headers } from 'next/headers';
import { IdeaStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db';

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

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { cognitoId },
    include: {
      subscription: true,
    },
  });

  if (user) return user;

  // If user doesn't exist, create them (handle race condition)
  try {
    user = await prisma.user.create({
      data: {
        cognitoId,
        email: cognitoUser.email,
        name: cognitoUser.name || null,
        subscription: {
          create: {
            tier: 'FREE',
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        },
      },
      include: {
        subscription: true,
      },
    });
    return user;
  } catch (error) {
    // Handle race condition: another request created the user first
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return await prisma.user.findUnique({
        where: { cognitoId },
        include: { subscription: true },
      });
    }
    throw error;
  }
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
 * Check if user can create more ideas
 */
export async function canCreateIdea(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      _count: {
        select: {
          ideas: {
            where: { status: { not: IdeaStatus.ARCHIVED } },
          },
        },
      },
    },
  });

  if (!user?.subscription) return false;

  const limits = getSubscriptionLimits(user.subscription.tier);
  if (limits.ideas === -1) return true; // unlimited

  return user._count.ideas < limits.ideas;
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
