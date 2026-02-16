'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PricingTable } from '@/components/billing/PricingTable';

interface Subscription {
  plan: string;
  status: string;
  ideas_used: number;
  ideas_limit: number;
  packs_used: number;
  packs_limit: number;
  current_period_end: string;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check for success/cancelled query params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  // Fetch subscription data
  useEffect(() => {
    async function fetchSubscription() {
      try {
        // In production, get user_id from auth context
        const userId = 'current-user';
        const response = await fetch(`/api/billing/subscription/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch subscription');
        const data = await response.json();
        setSubscription(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchSubscription();
  }, []);

  const handleSelectPlan = async (priceId: string) => {
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          user_id: 'current-user', // In production, get from auth
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: 'customer-id', // In production, get from subscription
        }),
      });

      if (!response.ok) throw new Error('Failed to create portal session');

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open portal');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Success Banner */}
      {showSuccess && (
        <div className="mb-8 rounded-lg bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Subscription updated successfully!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-8 rounded-lg bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-2 text-gray-600">
          Manage your subscription and usage
        </p>
      </div>

      {/* Current Plan Section */}
      {subscription && (
        <div className="mb-12 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-bold capitalize text-blue-600">
                  {subscription.plan}
                </span>
                <span className={`
                  rounded-full px-2 py-0.5 text-xs font-medium
                  ${subscription.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                  }
                `}>
                  {subscription.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>

            {subscription.plan !== 'free' && (
              <button
                onClick={handleManageSubscription}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Manage Subscription
              </button>
            )}
          </div>

          {/* Usage Stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <UsageCard
              label="Ideas Used"
              used={subscription.ideas_used}
              limit={subscription.ideas_limit}
            />
            <UsageCard
              label="Packs Used"
              used={subscription.packs_used}
              limit={subscription.packs_limit}
            />
          </div>
        </div>
      )}

      {/* Pricing Table */}
      <div className="mb-8">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
          Choose Your Plan
        </h2>
        <PricingTable
          currentPlan={subscription?.plan}
          onSelectPlan={handleSelectPlan}
        />
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-12 text-center text-sm text-gray-500">
        <p>
          Questions about billing?{' '}
          <a href="/support" className="text-blue-600 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

interface UsageCardProps {
  label: string;
  used: number;
  limit: number;
}

function UsageCard({ label, used, limit }: UsageCardProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="text-sm text-gray-900">
          {used} / {isUnlimited ? 'Unlimited' : limit}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? 'bg-yellow-500' : 'bg-blue-600'
          }`}
          style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="mt-1 text-xs text-yellow-600">
          Approaching limit
        </p>
      )}
    </div>
  );
}
