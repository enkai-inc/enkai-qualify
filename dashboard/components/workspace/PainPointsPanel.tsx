'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

interface PainPoint {
  category: string;
  quotes: string[];
  source?: string;
  engagement?: number;
}

export function PainPointsPanel() {
  const { validation } = useWorkspaceStore();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const details = validation?.details as Record<string, unknown> | undefined;
  const painPoints = details?.painPoints as PainPoint[] | undefined;
  if (!painPoints?.length) return null;

  const threadCount = (details?.redditThreadsAnalyzed as number) ?? 0;
  const quoteCount = (details?.totalQuotesCollected as number) ?? 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Customer Pain Points</h2>
      <p className="text-xs text-gray-500 mb-4">
        {quoteCount} quotes from {threadCount} Reddit threads
      </p>

      <div className="space-y-2">
        {painPoints.map((pp, idx) => {
          const isExpanded = expandedIdx === idx;
          return (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{pp.category}</span>
                  {pp.source && (
                    <span className="text-xs text-gray-400">{pp.source}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{pp.quotes.length} quotes</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && pp.quotes.length > 0 && (
                <div className="px-4 pb-3 space-y-2 border-t border-gray-100">
                  {pp.quotes.map((quote, qi) => (
                    <blockquote key={qi} className="text-sm text-gray-600 italic border-l-2 border-gray-300 pl-3 mt-2">
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  ))}
                  {pp.engagement !== undefined && (
                    <p className="text-xs text-gray-400 mt-1">{pp.engagement} engagements</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
