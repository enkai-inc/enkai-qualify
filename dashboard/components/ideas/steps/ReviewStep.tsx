'use client';

import { useState } from 'react';
import { useCreateIdeaStore, GeneratedIdea } from '@/lib/stores/createIdeaStore';

interface ReviewStepProps {
  onSave: () => void;
  isSaving: boolean;
}

export function ReviewStep({ onSave, isSaving }: ReviewStepProps) {
  const {
    editedIdea,
    setEditedIdea,
    updateEditedFeature,
    addFeature,
    removeFeature,
    prevStep,
  } = useCreateIdeaStore();

  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureDesc, setNewFeatureDesc] = useState('');

  if (!editedIdea) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No idea generated. Please go back and try again.</p>
        <button
          onClick={prevStep}
          className="mt-4 px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
        >
          Go Back
        </button>
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

  const priorityColors: Record<GeneratedIdea['features'][0]['priority'], string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Review & Customize
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Edit any details before saving your idea
      </p>

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title
        </label>
        <input
          type="text"
          value={editedIdea.title}
          onChange={(e) =>
            setEditedIdea({ ...editedIdea, title: e.target.value })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={editedIdea.description}
          onChange={(e) =>
            setEditedIdea({ ...editedIdea, description: e.target.value })
          }
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Technologies */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Technologies
        </label>
        <div className="flex flex-wrap gap-2">
          {editedIdea.technologies.map((tech, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              {tech}
              <button
                onClick={() =>
                  setEditedIdea({
                    ...editedIdea,
                    technologies: editedIdea.technologies.filter(
                      (_, i) => i !== index
                    ),
                  })
                }
                className="hover:text-blue-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Features
          </label>
          <button
            onClick={() => setIsAddingFeature(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add Feature
          </button>
        </div>

        {isAddingFeature && (
          <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <input
              type="text"
              placeholder="Feature name"
              value={newFeatureName}
              onChange={(e) => setNewFeatureName(e.target.value)}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <textarea
              placeholder="Feature description"
              value={newFeatureDesc}
              onChange={(e) => setNewFeatureDesc(e.target.value)}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddFeature}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingFeature(false)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {editedIdea.features.map((feature) => (
            <div
              key={feature.id}
              className="p-3 border border-gray-200 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{feature.name}</h4>
                    <select
                      value={feature.priority}
                      onChange={(e) =>
                        updateEditedFeature(feature.id, {
                          priority: e.target.value as 'high' | 'medium' | 'low',
                        })
                      }
                      className={`text-xs px-2 py-0.5 rounded-full border-0 ${
                        priorityColors[feature.priority]
                      }`}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
                <button
                  onClick={() => removeFeature(feature.id)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Analysis */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Market Analysis
        </h3>
        <p className="text-sm text-gray-600">{editedIdea.marketAnalysis}</p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center gap-2"
        >
          {isSaving && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isSaving ? 'Saving...' : 'Save Idea'}
        </button>
      </div>
    </div>
  );
}
