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
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={maxScore}
          aria-label={label}
        />
      </div>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
  );
}

interface KeywordEntry {
  term: string;
  monthlyVolume: number;
  competition?: string;
}

interface KeywordResearch {
  totalMonthlyVolume?: number;
  source?: string;
  keywords: KeywordEntry[];
}

interface TrendAnalysis {
  direction: string;
  stability?: string;
  fiveYearChange?: string;
}

function ValidationDetails({ details }: { details: Record<string, unknown> }) {
  const marketSize = details.marketSize as string | undefined;
  const competitorCount = details.competitorCount as number | undefined;
  const feasibilityNotes = details.feasibilityNotes as string | undefined;
  const keywordResearch = details.keywordResearch as KeywordResearch | undefined;
  const trendAnalysis = details.trendAnalysis as TrendAnalysis | undefined;
  const recommendation = details.recommendation as string | undefined;
  const mvpFeatures = details.mvpFeatures as string[] | undefined;

  return (
    <>
      {(marketSize || competitorCount !== undefined || feasibilityNotes) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Analysis Details</h3>
          {marketSize && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Market Size:</span> {marketSize}
            </p>
          )}
          {competitorCount !== undefined && (
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Competitors:</span> {competitorCount}
            </p>
          )}
          {feasibilityNotes && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Notes:</span> {feasibilityNotes}
            </p>
          )}
        </div>
      )}

      {keywordResearch && keywordResearch.keywords?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Keyword Research</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              Total Monthly Volume: {keywordResearch.totalMonthlyVolume?.toLocaleString() || 'N/A'}
            </span>
            <span className="text-xs text-gray-400">
              Source: {keywordResearch.source || 'AI Estimate'}
            </span>
          </div>
          <div className="space-y-2">
            {keywordResearch.keywords.slice(0, 6).map((kw, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate flex-1">{kw.term}</span>
                <div className="flex items-center gap-3 ml-2">
                  <span className="text-gray-900 font-medium tabular-nums">
                    {kw.monthlyVolume?.toLocaleString() || '\u2014'}
                  </span>
                  {kw.competition && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      kw.competition === 'low' ? 'bg-green-100 text-green-700'
                      : kw.competition === 'medium' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {kw.competition}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trendAnalysis && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Trend Analysis</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`text-lg ${
                trendAnalysis.direction === 'rising' ? 'text-green-500' :
                trendAnalysis.direction === 'stable' ? 'text-blue-500' :
                'text-red-500'
              }`}>
                {trendAnalysis.direction === 'rising' ? '\uD83D\uDCC8' :
                 trendAnalysis.direction === 'stable' ? '\uD83D\uDCCA' : '\uD83D\uDCC9'}
              </span>
              <div>
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {trendAnalysis.direction}
                </span>
                {trendAnalysis.stability && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({trendAnalysis.stability})
                  </span>
                )}
              </div>
            </div>
            {trendAnalysis.fiveYearChange && (
              <span className={`text-sm font-medium ${
                trendAnalysis.fiveYearChange.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {trendAnalysis.fiveYearChange} (5yr)
              </span>
            )}
          </div>
        </div>
      )}

      {recommendation && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Recommendation</h3>
          <p className="text-sm text-gray-600">{recommendation}</p>
        </div>
      )}

      {mvpFeatures && mvpFeatures.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recommended MVP Features</h3>
          <ul className="space-y-1">
            {mvpFeatures.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function ValidationPanel() {
  const { validation, idea, isLoading, isValidating, isValidationPending, validate, error } = useWorkspaceStore();

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
          {isValidationPending ? (
            <>
              <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-3" role="status" aria-label="Validation in progress" />
              <p className="text-gray-500">Validation in progress... This usually takes 30-60 seconds.</p>
            </>
          ) : (
            <>
              <p className="text-gray-500">No validation data yet</p>
              <button
                type="button"
                onClick={validate}
                disabled={isValidating}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? 'Submitting...' : 'Run Validation'}
              </button>
            </>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
          )}
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

      <div className="text-center mb-6" aria-live="polite" aria-atomic="true">
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
        <ValidationDetails details={validation.details} />
      )}
    </div>
  );
}
