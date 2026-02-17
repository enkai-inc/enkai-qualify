import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './db';

/**
 * Get the current authenticated user from Clerk and sync with database
 */
export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      subscription: true,
    },
  });

  // If user doesn't exist, create them
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return null;
    }

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
        name: clerkUser.firstName
          ? `${clerkUser.firstName} ${clerkUser.lastName ?? ''}`.trim()
          : null,
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
  }

  return user;
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
        select: { ideas: true },
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
