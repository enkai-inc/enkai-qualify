'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateIdeaStore } from '@/lib/stores/createIdeaStore';
import { IndustryStep } from '@/components/ideas/steps/IndustryStep';
import { ProblemStep } from '@/components/ideas/steps/ProblemStep';
import { GenerateStep } from '@/components/ideas/steps/GenerateStep';
import { ReviewStep } from '@/components/ideas/steps/ReviewStep';

export default function NewIdeaPage() {
  const router = useRouter();
  const { step, reset, saveIdea, isSaving, error } = useCreateIdeaStore();

  // Reset state on mount
  useEffect(() => {
    reset();
  }, [reset]);

  const handleSave = async () => {
    const ideaId = await saveIdea();
    if (ideaId) {
      router.push(`/workspace/${ideaId}`);
    }
  };

  const steps = [
    { number: 1, name: 'Industry' },
    { number: 2, name: 'Problem' },
    { number: 3, name: 'Generate' },
    { number: 4, name: 'Review' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Idea</h1>
        <p className="mt-1 text-sm text-gray-600">
          Let AI help you discover your next SaaS opportunity
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((s, index) => (
              <li
                key={s.name}
                aria-current={s.number === step ? 'step' : undefined}
                className={`flex-1 ${index !== steps.length - 1 ? 'pr-4' : ''}`}
              >
                <div className="flex items-center">
                  <div
                    className={`
                      flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
                      ${
                        s.number < step
                          ? 'bg-blue-600 text-white'
                          : s.number === step
                          ? 'border-2 border-blue-600 text-blue-600'
                          : 'border-2 border-gray-300 text-gray-500'
                      }
                    `}
                  >
                    {s.number < step ? (
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      s.number
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      s.number <= step ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {s.name}
                  </span>
                  {index !== steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 ml-4 ${
                        s.number < step ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Step content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {step === 1 && <IndustryStep />}
        {step === 2 && <ProblemStep />}
        {step === 3 && <GenerateStep />}
        {step === 4 && <ReviewStep onSave={handleSave} isSaving={isSaving} />}
      </div>
    </div>
  );
}
