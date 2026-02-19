'use client';

import { useEffect, useRef } from 'react';
import { IdeaVersion, IdeaData } from '@/lib/stores/workspaceStore';

interface CompareVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIdea: IdeaData;
  compareVersion: IdeaVersion;
  onRestore: (versionId: string) => void;
  isLoading: boolean;
}

export function CompareVersionsModal({
  isOpen,
  onClose,
  currentIdea,
  compareVersion,
  onRestore,
  isLoading,
}: CompareVersionsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const snapshot = compareVersion.snapshot;

  const renderDiff = (label: string, current: string, previous: string) => {
    const isDifferent = current !== previous;
    return (
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg ${isDifferent ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500 mb-1">Current (v{currentIdea.currentVersion})</p>
            <p className="text-sm text-gray-900">{current || '(empty)'}</p>
          </div>
          <div className={`p-3 rounded-lg ${isDifferent ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500 mb-1">v{compareVersion.version}</p>
            <p className="text-sm text-gray-900">{previous || '(empty)'}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderArrayDiff = (label: string, current: string[], previous: string[]) => {
    const currentSet = new Set(current);
    const previousSet = new Set(previous);
    const added = current.filter(x => !previousSet.has(x));
    const removed = previous.filter(x => !currentSet.has(x));
    const unchanged = current.filter(x => previousSet.has(x));

    return (
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">Current (v{currentIdea.currentVersion})</p>
            <div className="flex flex-wrap gap-1">
              {current.map((item, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 text-xs rounded ${
                    added.includes(item) ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">v{compareVersion.version}</p>
            <div className="flex flex-wrap gap-1">
              {previous.map((item, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 text-xs rounded ${
                    removed.includes(item) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 id="compare-modal-title" className="text-lg font-semibold text-gray-900">
            Compare Versions
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <span className="font-medium">Comparing:</span> Current (v{currentIdea.currentVersion}) vs v{compareVersion.version}
            <span className="text-blue-600 ml-2">({compareVersion.summary})</span>
          </div>

          {renderDiff('Title', currentIdea.title, snapshot.title)}
          {renderDiff('Description', currentIdea.description, snapshot.description)}
          {renderDiff('Industry', currentIdea.industry, snapshot.industry)}
          {renderDiff('Target Market', currentIdea.targetMarket, snapshot.targetMarket)}
          {renderArrayDiff('Technologies', currentIdea.technologies, snapshot.technologies)}

          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Features</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">Current (v{currentIdea.currentVersion}) - {currentIdea.features.length} features</p>
                <ul className="space-y-1">
                  {currentIdea.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-700">• {f.name}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">v{compareVersion.version} - {snapshot.features.length} features</p>
                <ul className="space-y-1">
                  {snapshot.features.map((f, i) => (
                    <li key={i} className="text-sm text-gray-700">• {f.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onRestore(compareVersion.id);
              onClose();
            }}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Restore v{compareVersion.version}
          </button>
        </div>
      </div>
    </div>
  );
}
