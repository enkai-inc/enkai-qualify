'use client';

import { useCreateIdeaStore } from '@/lib/stores/createIdeaStore';

const industries = [
  { value: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { value: 'finance', label: 'Finance', icon: '💰' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'ecommerce', label: 'E-Commerce', icon: '🛒' },
  { value: 'productivity', label: 'Productivity', icon: '⚡' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'hr', label: 'HR & Recruiting', icon: '👥' },
  { value: 'marketing', label: 'Marketing', icon: '📣' },
  { value: 'other', label: 'Other', icon: '🔧' },
];

const targetMarkets = [
  { value: 'b2b', label: 'B2B', description: 'Business to Business' },
  { value: 'b2c', label: 'B2C', description: 'Business to Consumer' },
  { value: 'freelancers', label: 'Freelancers', description: 'Independent workers' },
  { value: 'enterprise', label: 'Enterprise', description: 'Large corporations' },
  { value: 'startups', label: 'Startups', description: 'Early-stage companies' },
  { value: 'government', label: 'Government', description: 'Public sector' },
];

export function IndustryStep() {
  const { industry, targetMarket, setIndustry, setTargetMarket, nextStep } =
    useCreateIdeaStore();

  const canProceed = industry && targetMarket;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Select Industry & Target Market
      </h2>

      {/* Industry selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Industry
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {industries.map((ind) => (
            <button
              key={ind.value}
              onClick={() => setIndustry(ind.value)}
              aria-label={`Select ${ind.label} industry`}
              aria-pressed={industry === ind.value}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${
                  industry === ind.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className="text-2xl mb-2 block" aria-hidden="true">{ind.icon}</span>
              <span className="text-sm font-medium text-gray-900">
                {ind.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Target market selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Target Market
        </label>
        <div className="grid grid-cols-2 gap-3">
          {targetMarkets.map((market) => (
            <button
              key={market.value}
              onClick={() => setTargetMarket(market.value)}
              aria-label={`Select ${market.label} market`}
              aria-pressed={targetMarket === market.value}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${
                  targetMarket === market.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className="text-sm font-medium text-gray-900">
                {market.label}
              </span>
              <span className="text-xs text-gray-500 block mt-1">
                {market.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <button
          onClick={nextStep}
          disabled={!canProceed}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
