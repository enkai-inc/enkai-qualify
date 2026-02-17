import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createCustomerPortalSession } from '@/lib/services/stripe-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const origin = request.headers.get('origin') ?? 'http://localhost:3000';
    const returnUrl = `${origin}/billing`;

    const session = await createCustomerPortalSession(
      subscription.stripeCustomerId,
      returnUrl
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
