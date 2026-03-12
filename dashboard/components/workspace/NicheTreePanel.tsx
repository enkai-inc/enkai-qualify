'use client';

import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

export function NicheTreePanel() {
  const { idea } = useWorkspaceStore();

  const nicheTree = idea?.metadata?.nicheTree;
  if (!nicheTree?.levels?.length) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Niche Decomposition</h2>
      <p className="text-xs text-gray-500 mb-4">
        From broad market to specific niche opportunity
      </p>

      <div className="space-y-0">
        {nicheTree.levels.map((level, idx) => {
          const isSelected = level.level === nicheTree.selectedLevel;
          const isLast = idx === nicheTree.levels.length - 1;

          return (
            <div key={level.level} className="relative">
              <div className={`flex items-start gap-3 p-3 rounded-lg ${
                isSelected ? 'bg-blue-50 border border-blue-200' : ''
              }`}>
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {level.level}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 h-4 bg-gray-300 mt-1" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      isSelected ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {level.name}
                    </span>
                    {isSelected && (
                      <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  {level.estimatedTAM && (
                    <span className="text-xs text-gray-500">TAM: {level.estimatedTAM}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
