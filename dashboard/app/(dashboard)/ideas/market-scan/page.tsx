'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMarketScanStore } from '@/lib/stores/marketScanStore';

const industries = [
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'legal', label: 'Legal' },
  { value: 'hr', label: 'HR & Recruiting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

export default function MarketScanPage() {
  const router = useRouter();
  const { isCreating, error, startScan } = useMarketScanStore();
  const [industry, setIndustry] = useState('');
  const [niche, setNiche] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry) return;

    const scanId = await startScan(industry, niche || undefined);
    if (scanId) {
      router.push(`/ideas/market-scan/${scanId}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/ideas"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to Ideas
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Market Scan</h1>
        <p className="mt-1 text-sm text-gray-600">
          Discover high-demand SaaS opportunities based on real-time market data
        </p>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Industry */}
          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
              Industry
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">Select an industry...</option>
              {industries.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>

          {/* Niche */}
          <div>
            <label htmlFor="niche" className="block text-sm font-medium text-gray-700 mb-2">
              Niche / Focus Area
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              id="niche"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder='e.g. "invoicing", "HR onboarding", "telemedicine"'
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Narrow the scan to a specific sub-market for more targeted results
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!industry || isCreating}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Starting scan...
              </>
            ) : (
              'Start Market Scan'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
