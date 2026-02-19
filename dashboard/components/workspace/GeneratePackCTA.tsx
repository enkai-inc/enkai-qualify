'use client';

import Link from 'next/link';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

const MIN_SCORE_FOR_PACK = 50;

export function GeneratePackCTA() {
  const { idea, validation, isRefining } = useWorkspaceStore();

  if (!idea) {
    return null;
  }

  const overallScore = validation?.overallScore ?? 0;
  const canGeneratePack = overallScore >= MIN_SCORE_FOR_PACK;
  const scoreNeeded = MIN_SCORE_FOR_PACK - overallScore;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                canGeneratePack ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              <span
                className={`text-lg font-bold ${
                  canGeneratePack ? 'text-green-700' : 'text-gray-500'
                }`}
              >
                {overallScore}
              </span>
            </div>
            <div>
              {canGeneratePack ? (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    Ready to generate your pack!
                  </p>
                  <p className="text-xs text-gray-500">
                    Your idea has a strong validation score
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    {scoreNeeded} more points needed
                  </p>
                  <p className="text-xs text-gray-500">
                    Refine your idea to reach a score of {MIN_SCORE_FOR_PACK}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!canGeneratePack && (
              <>
                <span className="sm:hidden text-xs font-medium text-gray-500">
                  {Math.round((overallScore / MIN_SCORE_FOR_PACK) * 100)}%
                </span>
                <div className="hidden sm:block">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((overallScore / MIN_SCORE_FOR_PACK) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    {Math.round((overallScore / MIN_SCORE_FOR_PACK) * 100)}% complete
                  </p>
                </div>
              </>
            )}

            {canGeneratePack ? (
              <Link
                href={`/pack/configure/${idea.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Generate Pack
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-500 font-semibold rounded-lg cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Generate Pack
              </button>
            )}
          </div>
        </div>

        {isRefining && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Refining your idea...</span>
          </div>
        )}
      </div>
    </div>
  );
}
