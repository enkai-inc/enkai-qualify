'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { IdeaSummary } from '@/lib/stores/ideasStore';

interface IdeaCardProps {
  idea: IdeaSummary;
  onDelete: (id: string) => Promise<void>;
}

export function IdeaCard({ idea, onDelete }: IdeaCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showDeleteConfirm) {
      cancelButtonRef.current?.focus();
    }
  }, [showDeleteConfirm]);

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
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1" title={idea.title}>
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
            setShowDeleteConfirm(true);
          }}
          aria-label="Delete idea"
          className="text-sm text-gray-400 hover:text-red-600 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div
          role="alertdialog"
          aria-labelledby="delete-confirm-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDeleteConfirm(false);
            if (e.key === 'Tab') {
              const focusable = e.currentTarget.querySelectorAll('button');
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
          className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center gap-3 z-10"
        >
          <p id="delete-confirm-title" className="text-sm font-medium text-gray-900">Delete this idea?</p>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setIsDeleting(true);
                setDeleteError(null);
                try {
                  await onDelete(idea.id);
                  setShowDeleteConfirm(false);
                } catch {
                  setDeleteError('Failed to delete. Please try again.');
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              ref={cancelButtonRef}
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
          {deleteError && (
            <p className="text-xs text-red-600 mt-2">{deleteError}</p>
          )}
        </div>
      )}

      {/* Updated time */}
      <time
        dateTime={idea.updatedAt}
        className="absolute top-4 right-4 text-xs text-gray-400"
      >
        {new Date(idea.updatedAt).toLocaleDateString()}
      </time>
    </div>
  );
}
