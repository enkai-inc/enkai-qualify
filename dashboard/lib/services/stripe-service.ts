import Stripe from 'stripe';

// Lazy-initialized Stripe client to avoid build-time errors
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// Export for backward compatibility
export const stripe = {
  checkout: {
    sessions: {
      create: (params: Stripe.Checkout.SessionCreateParams) =>
        getStripeClient().checkout.sessions.create(params),
    },
  },
  billingPortal: {
    sessions: {
      create: (params: Stripe.BillingPortal.SessionCreateParams) =>
        getStripeClient().billingPortal.sessions.create(params),
    },
  },
  subscriptions: {
    retrieve: (id: string) => getStripeClient().subscriptions.retrieve(id),
    cancel: (id: string) => getStripeClient().subscriptions.cancel(id),
  },
  webhooks: {
    constructEvent: (
      payload: string | Buffer,
      header: string,
      secret: string
    ) => getStripeClient().webhooks.constructEvent(payload, header, secret),
  },
};

// Price IDs for different subscription tiers
export const PRICE_IDS = {
  FREE: null,
  EXPLORER: process.env.STRIPE_EXPLORER_PRICE_ID,
  BUILDER: process.env.STRIPE_BUILDER_PRICE_ID,
  AGENCY: process.env.STRIPE_AGENCY_PRICE_ID,
};

// Subscription tier limits
export const TIER_LIMITS = {
  FREE: { ideas: 3, packs: 1, price: 0 },
  EXPLORER: { ideas: 10, packs: 5, price: 29 },
  BUILDER: { ideas: 50, packs: 25, price: 79 },
  AGENCY: { ideas: -1, packs: -1, price: 199 }, // unlimited
};

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return session;
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId);
}

export function getTierFromPriceId(priceId: string): keyof typeof TIER_LIMITS {
  for (const [tier, id] of Object.entries(PRICE_IDS)) {
    if (id === priceId) {
      return tier as keyof typeof TIER_LIMITS;
    }
  }
  return 'FREE';
}
