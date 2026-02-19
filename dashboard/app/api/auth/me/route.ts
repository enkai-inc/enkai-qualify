import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Returns only safe subscription fields to the client.
 * Sensitive fields like stripeCustomerId, stripeSubscriptionId,
 * and internal tracking fields are excluded.
 */
function sanitizeSubscription(
  subscription: Record<string, unknown> | null | undefined
): { tier: string; periodEnd: unknown; status?: string } | null {
  if (!subscription) return null;

  const safe: { tier: string; periodEnd: unknown; status?: string } = {
    tier: subscription.tier as string,
    periodEnd: subscription.periodEnd,
  };

  if (subscription.status !== undefined) {
    safe.status = subscription.status as string;
  }

  return safe;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      subscription: sanitizeSubscription(
        user.subscription as Record<string, unknown> | null
      ),
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
