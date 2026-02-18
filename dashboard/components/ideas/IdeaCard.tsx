'use client';

import Link from 'next/link';
import { IdeaSummary } from '@/lib/stores/ideasStore';

interface IdeaCardProps {
  idea: IdeaSummary;
  onDelete: (id: string) => void;
}

export function IdeaCard({ idea, onDelete }: IdeaCardProps) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    VALIDATED: 'bg-green-100 text-green-800',
    PACK_GENERATED: 'bg-purple-100 text-purple-800',
    ARCHIVED: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Generating...',
    DRAFT: 'Draft',
    VALIDATED: 'Validated',
    PACK_GENERATED: 'Pack Ready',
    ARCHIVED: 'Archived',
  };

  const score = idea.latestValidation?.overallScore;

  return (
    <div className="group relative bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusColors[idea.status]
          }`}
        >
          {statusLabels[idea.status]}
        </span>
        {score !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-900">{score}</span>
            <span className="text-xs text-gray-500">/100</span>
          </div>
        )}
      </div>

      {/* Title and description */}
      <Link href={`/workspace/${idea.id}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
          {idea.title}
        </h3>
      </Link>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {idea.description}
      </p>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
        <span className="capitalize">{idea.industry}</span>
        <span>•</span>
        <span className="capitalize">{idea.targetMarket}</span>
        <span>•</span>
        <span>v{idea.currentVersion}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <Link
          href={`/workspace/${idea.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Open Workspace →
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to delete this idea?')) {
              onDelete(idea.id);
            }
          }}
          className="text-sm text-gray-400 hover:text-red-600 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Updated time */}
      <div className="absolute top-4 right-4 text-xs text-gray-400">
        {new Date(idea.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
