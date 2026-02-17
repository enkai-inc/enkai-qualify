'use client';

import { useCreateIdeaStore } from '@/lib/stores/createIdeaStore';

export function ProblemStep() {
  const {
    industry,
    targetMarket,
    problemDescription,
    setProblemDescription,
    prevStep,
    nextStep,
  } = useCreateIdeaStore();

  const canProceed = problemDescription.trim().length >= 50;

  const placeholders: Record<string, string> = {
    healthcare: 'e.g., "Healthcare providers spend hours manually scheduling appointments and managing patient records..."',
    finance: 'e.g., "Small businesses struggle to track expenses and generate financial reports..."',
    education: 'e.g., "Teachers need better tools for creating interactive assessments..."',
    ecommerce: 'e.g., "Online sellers have difficulty managing inventory across multiple platforms..."',
    productivity: 'e.g., "Remote teams lack effective async communication tools..."',
    legal: 'e.g., "Law firms waste time on repetitive contract reviews..."',
    hr: 'e.g., "Companies struggle to manage employee onboarding efficiently..."',
    marketing: 'e.g., "Marketers need better ways to track campaign ROI..."',
    other: 'Describe the problem or opportunity in detail...',
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Describe the Problem
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        What problem are you trying to solve? The more detail you provide, the
        better the AI can help.
      </p>

      {/* Context display */}
      <div className="flex gap-4 mb-6">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 capitalize">
          {industry}
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 uppercase">
          {targetMarket}
        </span>
      </div>

      {/* Problem description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Problem or Opportunity
        </label>
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder={placeholders[industry] || placeholders.other}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex justify-between mt-2">
          <p className="text-xs text-gray-500">
            Minimum 50 characters for better results
          </p>
          <p
            className={`text-xs ${
              problemDescription.length >= 50
                ? 'text-green-600'
                : 'text-gray-500'
            }`}
          >
            {problemDescription.length} characters
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          Tips for better results:
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Describe who experiences this problem</li>
          <li>• Explain the current pain points</li>
          <li>• Mention any existing solutions and their limitations</li>
          <li>• Include specific examples if possible</li>
        </ul>
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
          onClick={nextStep}
          disabled={!canProceed}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          Generate Idea
        </button>
      </div>
    </div>
  );
}
