import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TIER_LIMITS } from '@/lib/services/stripe-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireAuth();
    const { userId } = await params;

    // Users can only access their own subscription
    if (user.id !== userId && userId !== 'current-user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription) {
      // Return default free tier
      return NextResponse.json({
        plan: 'free',
        status: 'active',
        ideas_used: 0,
        ideas_limit: TIER_LIMITS.FREE.ideas,
        packs_used: 0,
        packs_limit: TIER_LIMITS.FREE.packs,
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    }

    const limits = TIER_LIMITS[subscription.tier as keyof typeof TIER_LIMITS];

    return NextResponse.json({
      plan: subscription.tier.toLowerCase(),
      status: 'active',
      ideas_used: subscription.ideasUsed,
      ideas_limit: limits.ideas,
      packs_used: subscription.packsUsed,
      packs_limit: limits.packs,
      current_period_end: subscription.periodEnd.toISOString(),
      stripe_customer_id: subscription.stripeCustomerId,
      stripe_subscription_id: subscription.stripeSubscriptionId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting subscription:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}
