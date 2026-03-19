import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, getTierFromPriceId } from '@/lib/services/stripe-service';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Extended subscription type to include period fields from webhook events
// These fields exist in webhook payloads but may not be in SDK types
interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start?: number;
  current_period_end?: number;
}

// Extended invoice type to include subscription field from webhook events
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook configuration error' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (!userId) {
          logger.error('No userId in checkout session metadata', { sessionId: session.id, customer: String(session.customer) });
          return NextResponse.json({ error: 'Missing userId in session metadata' }, { status: 400 });
        }

        // Get subscription details
        const subscriptionResponse = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const subscription = subscriptionResponse as SubscriptionWithPeriod;

        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        // Use period from subscription or fallback to created date
        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : new Date(subscription.created * 1000);
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Update or create subscription in database
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            tier,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            periodStart,
            periodEnd,
          },
          update: {
            tier,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            periodStart,
            periodEnd,
          },
        });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as SubscriptionWithPeriod;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          logger.error('No userId in subscription metadata');
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        // Use period from subscription or fallback to calculated dates
        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : new Date(subscription.created * 1000);
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await prisma.subscription.update({
          where: { userId },
          data: {
            tier,
            periodStart,
            periodEnd,
          },
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as SubscriptionWithPeriod;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          logger.error('No userId in subscription metadata');
          break;
        }

        // Downgrade to free tier
        await prisma.subscription.update({
          where: { userId },
          data: {
            tier: 'FREE',
            stripeSubscriptionId: null,
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as InvoiceWithSubscription;
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : (invoice.subscription as Stripe.Subscription)?.id ?? null;

        if (subscriptionId) {
          const subscriptionResponse =
            await stripe.subscriptions.retrieve(subscriptionId);
          const subscription = subscriptionResponse as SubscriptionWithPeriod;

          const userId = subscription.metadata?.userId;
          if (userId) {
            // Use period from subscription or fallback
            const periodStart = subscription.current_period_start
              ? new Date(subscription.current_period_start * 1000)
              : new Date(subscription.created * 1000);
            const periodEnd = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            // Reset usage counts on successful payment
            await prisma.subscription.update({
              where: { userId },
              data: {
                ideasUsed: 0,
                packsUsed: 0,
                periodStart,
                periodEnd,
              },
            });
          }
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Could send notification email here
        logger.error('Payment failed for invoice', { invoiceId: invoice.id });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Error handling webhook', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
