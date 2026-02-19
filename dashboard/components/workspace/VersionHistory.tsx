'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

export function VersionHistory() {
  const { versions, idea, restoreVersion, branchFromVersion, isLoading } = useWorkspaceStore();
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleRestore = async (versionId: string) => {
    await restoreVersion(versionId);
  };

  const handleBranch = async (versionId: string) => {
    await branchFromVersion(versionId);
  };

  const toggleExpand = (versionId: string) => {
    setExpandedVersion(expandedVersion === versionId ? null : versionId);
  };

  if (!idea) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-6">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-gray-500">No version history yet</p>
          <p className="text-xs text-gray-400 mt-1">Versions are created when you refine your idea</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {versions.map((version) => (
            <div
              key={version.id}
              className={`border rounded-lg transition-colors ${
                version.version === idea.currentVersion
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="p-3 cursor-pointer"
                role="button"
                tabIndex={0}
                aria-expanded={expandedVersion === version.id}
                onClick={() => toggleExpand(version.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(version.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">v{version.version}</span>
                        {version.version === idea.currentVersion && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(version.createdAt)}</p>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      expandedVersion === version.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{version.summary}</p>
              </div>

              {expandedVersion === version.id && (
                <div className="px-3 pb-3 border-t border-gray-100 mt-2 pt-2">
                  <div className="flex gap-2">
                    {version.version !== idea.currentVersion && (
                      <button
                        type="button"
                        onClick={() => handleRestore(version.id)}
                        disabled={isLoading}
                        className="flex-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleBranch(version.id)}
                      disabled={isLoading}
                      className="flex-1 text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Branch
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
