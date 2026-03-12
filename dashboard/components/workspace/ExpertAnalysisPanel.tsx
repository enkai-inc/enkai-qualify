'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

const EXPERT_ICONS: Record<string, string> = {
  problemFinder: '\uD83D\uDD0D',
  opportunitySpotter: '\uD83D\uDCA1',
  solutionArchitect: '\uD83C\uDFD7\uFE0F',
};

const EXPERT_LABELS: Record<string, string> = {
  problemFinder: 'Problem Finder',
  opportunitySpotter: 'Opportunity Spotter',
  solutionArchitect: 'Solution Architect',
};

export function ExpertAnalysisPanel() {
  const { idea } = useWorkspaceStore();
  const [activeExpert, setActiveExpert] = useState<string | null>(null);

  const expertAnalysis = idea?.metadata?.expertAnalysis;
  if (!expertAnalysis) return null;

  const experts = Object.keys(expertAnalysis).filter(
    (key) => expertAnalysis[key as keyof typeof expertAnalysis]
  );

  if (experts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Expert Analysis</h2>
      <p className="text-xs text-gray-500 mb-4">3-expert AI pipeline analysis</p>

      <div className="flex gap-2 mb-4">
        {experts.map((expert) => (
          <button
            key={expert}
            type="button"
            onClick={() => setActiveExpert(activeExpert === expert ? null : expert)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              activeExpert === expert
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="block text-base mb-1">{EXPERT_ICONS[expert] || '\uD83D\uDCCA'}</span>
            {EXPERT_LABELS[expert] || expert}
          </button>
        ))}
      </div>

      {activeExpert === 'problemFinder' && expertAnalysis.problemFinder && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Pain Clusters</h3>
          {expertAnalysis.problemFinder.painClusters.map((cluster, idx) => (
            <div key={idx} className="bg-red-50 border border-red-100 rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-red-900">{cluster.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  cluster.severity === 'high' ? 'bg-red-200 text-red-800'
                  : cluster.severity === 'medium' ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-gray-200 text-gray-800'
                }`}>
                  {cluster.severity}
                </span>
              </div>
              <p className="text-xs text-red-700">{cluster.description}</p>
            </div>
          ))}
        </div>
      )}

      {activeExpert === 'opportunitySpotter' && expertAnalysis.opportunitySpotter && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Product Concepts</h3>
          {expertAnalysis.opportunitySpotter.concepts.map((concept, idx) => (
            <div key={idx} className={`border rounded p-3 ${
              concept.name === expertAnalysis.opportunitySpotter?.recommended
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{concept.name}</span>
                {concept.name === expertAnalysis.opportunitySpotter?.recommended && (
                  <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Recommended</span>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-1">Target: {concept.targetAudience}</p>
              <p className="text-xs text-gray-500">Differentiator: {concept.differentiator}</p>
            </div>
          ))}
        </div>
      )}

      {activeExpert === 'solutionArchitect' && expertAnalysis.solutionArchitect && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">MVP Features</h3>
            <ul className="space-y-1">
              {expertAnalysis.solutionArchitect.mvpFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          {expertAnalysis.solutionArchitect.pricing && (
            <div>
              <h3 className="text-sm font-medium text-gray-700">Pricing</h3>
              <p className="text-sm text-gray-600">{expertAnalysis.solutionArchitect.pricing}</p>
            </div>
          )}
          {expertAnalysis.solutionArchitect.timeToMvp && (
            <div>
              <h3 className="text-sm font-medium text-gray-700">Time to MVP</h3>
              <p className="text-sm text-gray-600">{expertAnalysis.solutionArchitect.timeToMvp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
