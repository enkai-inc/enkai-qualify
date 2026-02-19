'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import {
  IdeaDisplay,
  ValidationPanel,
  RefinementInput,
  QuickActions,
  VersionHistory,
  GeneratePackCTA,
} from '@/components/workspace';

export default function WorkspacePage() {
  const params = useParams();
  const ideaId = params.ideaId as string;
  const { loadIdea, idea, isLoading, error, reset } = useWorkspaceStore();

  useEffect(() => {
    if (ideaId) {
      loadIdea(ideaId);
    }
    return () => {
      reset();
    };
  }, [ideaId, loadIdea, reset]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <svg
            className="w-16 h-16 mx-auto text-red-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Idea</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => loadIdea(ideaId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !idea) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="container mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                </div>
                <div className="bg-white rounded-lg shadow p-6 h-64" />
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6 h-48" />
                <div className="bg-white rounded-lg shadow p-6 h-48" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto max-w-7xl px-4 lg:px-8 py-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/ideas" className="hover:text-gray-700">
              Ideas
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">{idea.title}</span>
          </nav>
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 line-clamp-1">Idea Workspace</h1>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 text-sm rounded-full ${
                  idea.status === 'VALIDATED'
                    ? 'bg-green-100 text-green-800'
                    : idea.status === 'PACK_GENERATED'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {({
                  PENDING: 'Generating...',
                  DRAFT: 'Draft',
                  VALIDATED: 'Validated',
                  PACK_GENERATED: 'Pack Ready',
                  ARCHIVED: 'Archived',
                }[idea.status]) ?? idea.status}
              </span>
              <span className="text-sm text-gray-500">v{idea.currentVersion}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <IdeaDisplay />
            <RefinementInput />
            <QuickActions />
          </div>

          <div className="space-y-6">
            <ValidationPanel />
            <VersionHistory />
          </div>
        </div>
      </div>

      <GeneratePackCTA />
    </div>
  );
}
