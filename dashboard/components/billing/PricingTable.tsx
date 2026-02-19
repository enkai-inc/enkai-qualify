'use client';

import { useState } from 'react';

interface PricingTier {
  name: string;
  price: number;
  priceId: string;
  description: string;
  features: string[];
  ideas: string;
  packs: string;
  overage: string | null;
  highlighted?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    price: 0,
    priceId: '',
    description: 'Get started with basic features',
    features: ['Basic idea generation', 'Community support', 'Standard response time'],
    ideas: '3 ideas/month',
    packs: '0 packs',
    overage: null,
  },
  {
    name: 'Explorer',
    price: 29,
    priceId: 'price_explorer',
    description: 'Perfect for indie hackers',
    features: [
      'Priority idea generation',
      'Email support',
      'Faster response time',
      'Export to PDF',
    ],
    ideas: '15 ideas/month',
    packs: '3 packs/month',
    overage: '$9/pack overage',
  },
  {
    name: 'Builder',
    price: 99,
    priceId: 'price_builder',
    description: 'For serious builders',
    features: [
      'Unlimited ideas',
      'Priority support',
      'API access',
      'Custom exports',
      'Team sharing',
    ],
    ideas: 'Unlimited ideas',
    packs: '15 packs/month',
    overage: '$7/pack overage',
    highlighted: true,
  },
  {
    name: 'Agency',
    price: 299,
    priceId: 'price_agency',
    description: 'For teams and agencies',
    features: [
      'Everything in Builder',
      'Dedicated support',
      'Custom integrations',
      'White-label options',
      'SLA guarantee',
    ],
    ideas: 'Unlimited ideas',
    packs: 'Unlimited packs',
    overage: null,
  },
];

interface PricingTableProps {
  currentPlan?: string;
  onSelectPlan?: (priceId: string) => void;
}

export function PricingTable({ currentPlan = 'free', onSelectPlan }: PricingTableProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSelectPlan = async (tier: PricingTier) => {
    if (!tier.priceId || tier.name.toLowerCase() === currentPlan) return;

    setIsLoading(tier.priceId);
    try {
      if (onSelectPlan) {
        onSelectPlan(tier.priceId);
      }
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {pricingTiers.map((tier) => {
        const isCurrent = tier.name.toLowerCase() === currentPlan;
        const isHighlighted = tier.highlighted;

        return (
          <div
            key={tier.name}
            className={`
              relative flex flex-col rounded-2xl p-6 shadow-sm
              ${isHighlighted
                ? 'border-2 border-blue-600 bg-white ring-2 ring-blue-600'
                : 'border border-gray-200 bg-white'
              }
            `}
          >
            {isHighlighted && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{tier.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">
                ${tier.price}
              </span>
              {tier.price > 0 && (
                <span className="text-gray-500">/month</span>
              )}
            </div>

            <div className="mb-6 space-y-2 text-sm">
              <div className="flex items-center text-gray-700">
                <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
                {tier.ideas}
              </div>
              <div className="flex items-center text-gray-700">
                <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
                {tier.packs}
              </div>
              {tier.overage && (
                <div className="flex items-center text-gray-500">
                  <InfoIcon className="mr-2 h-4 w-4" />
                  {tier.overage}
                </div>
              )}
            </div>

            <ul className="mb-6 flex-1 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start text-sm text-gray-600">
                  <CheckIcon className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan(tier)}
              disabled={isCurrent || isLoading === tier.priceId}
              className={`
                w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors
                ${isCurrent
                  ? 'cursor-default bg-gray-100 text-gray-500'
                  : isHighlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }
                disabled:opacity-50
              `}
            >
              {isLoading === tier.priceId
                ? 'Loading...'
                : isCurrent
                  ? 'Current Plan'
                  : tier.price === 0
                    ? 'Downgrade'
                    : 'Upgrade'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default PricingTable;
