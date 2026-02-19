'use client';

import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
  description?: string;
}

function ScoreCard({ label, score, maxScore = 100, description }: ScoreCardProps) {
  const percentage = (score / maxScore) * 100;
  const getColorClass = (pct: number) => {
    if (pct >= 70) return 'bg-green-500';
    if (pct >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-lg font-bold text-gray-900">{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full ${getColorClass(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
  );
}

export function ValidationPanel() {
  const { validation, idea, isLoading, isValidating, validate } = useWorkspaceStore();

  if (isLoading || !idea) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
          <div className="h-24 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded" />
            <div className="h-16 bg-gray-200 rounded" />
            <div className="h-16 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Score</h2>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">--</div>
          <p className="text-gray-500">No validation data yet</p>
          <button
            onClick={validate}
            disabled={isValidating}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? 'Validating...' : 'Run Validation'}
          </button>
        </div>
      </div>
    );
  }

  const getOverallScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Score</h2>

      <div className="text-center mb-6">
        <div className={`text-6xl font-bold ${getOverallScoreColor(validation.overallScore)}`}>
          {validation.overallScore}
        </div>
        <p className="text-sm text-gray-500 mt-1">Overall Score</p>
        <p className="text-xs text-gray-400">Version {validation.version}</p>
      </div>

      <div className="space-y-4">
        <ScoreCard
          label="Keyword Strength"
          score={validation.keywordScore}
          description="Search volume and trend analysis"
        />
        <ScoreCard
          label="Pain Point Match"
          score={validation.painPointScore}
          description="Problem-solution fit score"
        />
        <ScoreCard
          label="Competition Level"
          score={validation.competitionScore}
          description="Market saturation analysis"
        />
        <ScoreCard
          label="Revenue Potential"
          score={validation.revenueEstimate}
          description="Estimated monthly opportunity"
        />
      </div>

      {validation.details && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Analysis Details</h3>
          {validation.details.marketSize && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Market Size:</span> {validation.details.marketSize}
            </p>
          )}
          {validation.details.competitorCount !== undefined && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Competitors:</span> {validation.details.competitorCount}
            </p>
          )}
          {validation.details.feasibilityNotes && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Notes:</span> {validation.details.feasibilityNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
