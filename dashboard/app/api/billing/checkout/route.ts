import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createCheckoutSession, PRICE_IDS } from '@/lib/services/stripe-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { price_id } = body;

    if (!price_id) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Verify price ID is valid
    const validPriceIds = Object.values(PRICE_IDS).filter(Boolean);
    if (!validPriceIds.includes(price_id)) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    const ALLOWED_ORIGINS = [
      process.env.NEXT_PUBLIC_APP_URL,
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3001'] : []),
    ].filter(Boolean);

    const origin = request.headers.get('origin');
    const validOrigin = ALLOWED_ORIGINS.includes(origin ?? '') ? origin! : ALLOWED_ORIGINS[0];
    if (!validOrigin) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 });
    }
    const successUrl = `${validOrigin}/billing?success=true`;
    const cancelUrl = `${validOrigin}/billing?cancelled=true`;

    const session = await createCheckoutSession(
      user.id,
      user.email,
      price_id,
      successUrl,
      cancelUrl
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
