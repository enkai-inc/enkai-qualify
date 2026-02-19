'use client';

import { useState } from 'react';
import { useWorkspaceStore, IdeaFeature } from '@/lib/stores/workspaceStore';

export function IdeaDisplay() {
  const { idea, updateFeature, addFeature, removeFeature } = useWorkspaceStore();
  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureDesc, setNewFeatureDesc] = useState('');

  if (!idea) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  const handleAddFeature = () => {
    if (newFeatureName.trim()) {
      addFeature({
        name: newFeatureName.trim(),
        description: newFeatureDesc.trim(),
        priority: 'medium',
      });
      setNewFeatureName('');
      setNewFeatureDesc('');
      setIsAddingFeature(false);
    }
  };

  const priorityColors: Record<IdeaFeature['priority'], string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{idea.title}</h1>
        <p className="text-gray-600">{idea.description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Industry</h3>
          <p className="text-gray-900">{idea.industry}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Target Market</h3>
          <p className="text-gray-900">{idea.targetMarket}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Technology Stack</h3>
        <div className="flex flex-wrap gap-2">
          {idea.technologies.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-500">Features</h3>
          <button
            type="button"
            onClick={() => setIsAddingFeature(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add Feature
          </button>
        </div>

        {isAddingFeature && (
          <div className="mb-4 p-4 border border-gray-200 rounded-lg">
            <input
              type="text"
              placeholder="Feature name"
              aria-label="Feature name"
              value={newFeatureName}
              onChange={(e) => setNewFeatureName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddFeature();
                }
              }}
              maxLength={100}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <textarea
              placeholder="Feature description"
              aria-label="Feature description"
              value={newFeatureDesc}
              onChange={(e) => setNewFeatureDesc(e.target.value)}
              maxLength={200}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddFeature}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingFeature(false)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {idea.features.length === 0 && !isAddingFeature && (
          <div className="text-center py-6 text-gray-400">
            <p className="text-sm">No features added yet</p>
            <p className="text-xs mt-1">Click &quot;+ Add Feature&quot; to get started</p>
          </div>
        )}

        <div className="space-y-3">
          {idea.features.map((feature) => (
            <div
              key={feature.id}
              className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{feature.name}</h4>
                    <select
                      aria-label={`Priority for ${feature.name}`}
                      value={feature.priority}
                      onChange={(e) =>
                        updateFeature(feature.id, {
                          priority: e.target.value as IdeaFeature['priority'],
                        })
                      }
                      className={`text-xs px-2 py-0.5 rounded-full border-0 ${priorityColors[feature.priority]}`}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFeature(feature.id)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                  title="Remove feature"
                  aria-label="Remove feature"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
