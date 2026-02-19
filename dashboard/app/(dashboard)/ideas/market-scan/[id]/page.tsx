'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMarketScanStore } from '@/lib/stores/marketScanStore';
import { OpportunityCard } from '@/components/market-scan/OpportunityCard';

export default function MarketScanDetailPage() {
  const params = useParams<{ id: string }>();
  const { currentScan, isLoading, error, loadScan, startPolling, stopPolling } = useMarketScanStore();

  useEffect(() => {
    if (params.id) {
      loadScan(params.id);
    }
    return () => stopPolling();
  }, [params.id, loadScan, stopPolling]);

  // Start polling when scan is pending/processing
  useEffect(() => {
    if (currentScan && (currentScan.status === 'PENDING' || currentScan.status === 'PROCESSING')) {
      startPolling(currentScan.id);
    }
  }, [currentScan?.id, currentScan?.status, startPolling]);

  if (isLoading && !currentScan) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/ideas" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
          &larr; Back to Ideas
        </Link>
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentScan) return null;

  const isPending = currentScan.status === 'PENDING' || currentScan.status === 'PROCESSING';
  const isFailed = currentScan.status === 'FAILED';
  const opportunities = currentScan.opportunities || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/ideas" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
          &larr; Back to Ideas
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            Market Scan: {currentScan.industry}
            {currentScan.niche && ` - ${currentScan.niche}`}
          </h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPending ? 'bg-yellow-100 text-yellow-800' :
            isFailed ? 'bg-red-100 text-red-800' :
            'bg-green-100 text-green-800'
          }`}>
            {currentScan.status}
          </span>
        </div>
      </div>

      {/* Pending state */}
      {isPending && (
        <div className="text-center py-16">
          <div className="h-12 w-12 mx-auto mb-4 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Scanning market data...
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Analyzing search trends, market gaps, and demand signals.
            This usually takes 1-2 minutes.
          </p>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div role="alert" className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <h2 className="text-lg font-medium text-red-800 mb-2">Scan Failed</h2>
          <p className="text-sm text-red-600">
            {currentScan.errorMessage || 'An error occurred while scanning. Please try again.'}
          </p>
          <Link
            href="/ideas/market-scan"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Try Again
          </Link>
        </div>
      )}

      {/* Completed: Opportunity cards */}
      {currentScan.status === 'COMPLETED' && (
        <>
          <p className="text-sm text-gray-600 mb-6">
            Found {opportunities.length} opportunities ranked by market demand score.
            Click &ldquo;Generate Idea&rdquo; to develop any opportunity into a full SaaS concept.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {opportunities
              .sort((a, b) => b.score - a.score)
              .map((opportunity) => (
                <OpportunityCard
                  key={opportunity.rank}
                  opportunity={opportunity}
                  industry={currentScan.industry}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
