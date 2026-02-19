'use client';

import Link from 'next/link';
import type { MarketOpportunity } from '@/lib/stores/marketScanStore';

interface OpportunityCardProps {
  opportunity: MarketOpportunity;
  industry: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getTrendIcon(direction: 'rising' | 'stable' | 'declining'): string {
  switch (direction) {
    case 'rising': return '\u2197';
    case 'stable': return '\u2192';
    case 'declining': return '\u2198';
  }
}

function getCompetitionBadge(competition: 'low' | 'medium' | 'high'): { label: string; className: string } {
  switch (competition) {
    case 'low': return { label: 'Low Competition', className: 'bg-green-50 text-green-700' };
    case 'medium': return { label: 'Medium Competition', className: 'bg-yellow-50 text-yellow-700' };
    case 'high': return { label: 'High Competition', className: 'bg-red-50 text-red-700' };
  }
}

export function OpportunityCard({ opportunity, industry }: OpportunityCardProps) {
  const competitionBadge = getCompetitionBadge(opportunity.competition);
  const prefillParams = new URLSearchParams({
    industry,
    problemDescription: opportunity.problemStatement,
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900 flex-1 pr-3">
          {opportunity.title}
        </h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getScoreColor(opportunity.score)}`}>
          {opportunity.score}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4 flex-1">
        {opportunity.description}
      </p>

      <div className="space-y-3">
        {/* Trend and competition */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
            {getTrendIcon(opportunity.trendDirection)} {opportunity.trendDirection}
          </span>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${competitionBadge.className}`}>
            {competitionBadge.label}
          </span>
        </div>

        {/* Search volume and revenue */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{opportunity.monthlySearchVolume.toLocaleString()} monthly searches</span>
          <span className="font-medium text-gray-700">{opportunity.estimatedRevenue}</span>
        </div>

        {/* Keywords */}
        {opportunity.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opportunity.keywords.slice(0, 4).map((keyword) => (
              <span key={keyword} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                {keyword}
              </span>
            ))}
            {opportunity.keywords.length > 4 && (
              <span className="px-2 py-0.5 text-gray-400 text-xs">
                +{opportunity.keywords.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/ideas/new?${prefillParams.toString()}`}
          className="mt-2 block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Generate Idea
        </Link>
      </div>
    </div>
  );
}
