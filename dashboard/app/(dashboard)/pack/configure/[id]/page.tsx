'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Idea {
  id: string;
  title: string;
  description: string;
  features: Array<{ name: string; description: string }>;
}

const AVAILABLE_MODULES = [
  { id: 'auth', name: 'Authentication', description: 'User login, registration, and session management', category: 'Core' },
  { id: 'database', name: 'Database Schema', description: 'Prisma schema and migrations for your data models', category: 'Core' },
  { id: 'api', name: 'REST API', description: 'API routes with validation and error handling', category: 'Core' },
  { id: 'dashboard', name: 'Admin Dashboard', description: 'Management interface with CRUD operations', category: 'UI' },
  { id: 'landing', name: 'Landing Page', description: 'Marketing page with hero, features, and CTA sections', category: 'UI' },
  { id: 'billing', name: 'Billing & Subscriptions', description: 'Stripe integration for payments and subscriptions', category: 'Business' },
  { id: 'email', name: 'Email Notifications', description: 'Transactional emails with templates', category: 'Business' },
  { id: 'analytics', name: 'Analytics', description: 'Usage tracking and reporting dashboard', category: 'Business' },
];

const COMPLEXITY_OPTIONS = [
  { id: 'MVP', name: 'MVP', description: 'Minimal viable product - core functionality only', multiplier: '1x', price: '$49' },
  { id: 'STANDARD', name: 'Standard', description: 'Production-ready with tests and documentation', multiplier: '2x', price: '$99' },
  { id: 'FULL', name: 'Full', description: 'Enterprise-grade with CI/CD, monitoring, and scaling', multiplier: '3x', price: '$199' },
];

export default function PackConfigurePage() {
  const params = useParams();
  const router = useRouter();
  const ideaId = params.id as string;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>(['auth', 'database', 'api']);
  const [complexity, setComplexity] = useState<'MVP' | 'STANDARD' | 'FULL'>('MVP');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchIdea() {
      try {
        const response = await fetch(`/api/ideas/${ideaId}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch idea');
        const data = await response.json();
        setIdea(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchIdea();
    return () => controller.abort();
  }, [ideaId]);

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSubmit = async () => {
    if (selectedModules.length === 0) {
      setError('Please select at least one module');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId,
          modules: selectedModules,
          complexity,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create pack');
      }

      router.push('/packs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Idea not found</p>
        <Link href="/ideas" className="mt-2 text-blue-600 hover:underline">
          Back to Ideas
        </Link>
      </div>
    );
  }

  const workUnits = selectedModules.length * (complexity === 'MVP' ? 1 : complexity === 'STANDARD' ? 2 : 3);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/workspace/${ideaId}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-gray-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configure Your Pack</h1>
          <p className="text-sm text-gray-500">{idea.title}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Module Selection */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Select Modules</h2>
        <p className="mb-4 text-sm text-gray-500">
          Choose the components you want included in your deployment pack.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE_MODULES.map((module) => (
            <label
              key={module.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                selectedModules.includes(module.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(module.id)}
                onChange={() => toggleModule(module.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {module.category}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{module.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Complexity Selection */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Choose Complexity</h2>
        <p className="mb-4 text-sm text-gray-500">
          Select the level of detail and production-readiness for your pack.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {COMPLEXITY_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer flex-col rounded-lg border p-4 transition-colors ${
                complexity === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="complexity"
                  value={option.id}
                  checked={complexity === option.id}
                  onChange={() => setComplexity(option.id as 'MVP' | 'STANDARD' | 'FULL')}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">{option.name}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{option.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">{option.multiplier} work units</span>
                <span className="font-semibold text-blue-600">{option.price}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Pack Summary</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">Modules</p>
            <p className="text-2xl font-bold text-gray-900">{selectedModules.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Complexity</p>
            <p className="text-2xl font-bold text-gray-900">{complexity}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Work Units</p>
            <p className="text-2xl font-bold text-gray-900">{workUnits}</p>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Link
          href={`/workspace/${ideaId}`}
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedModules.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Generate Pack
            </>
          )}
        </button>
      </div>
    </div>
  );
}
