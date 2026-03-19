'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Pack {
  id: string;
  ideaId: string;
  ideaTitle: string;
  modules: string[];
  complexity: 'MVP' | 'STANDARD' | 'FULL';
  workUnitCount: number;
  status: 'PENDING' | 'GENERATING' | 'READY' | 'EXPIRED' | 'FAILED';
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPacks() {
      try {
        const response = await fetch('/api/packs', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch packs');
        const data = await response.json();
        setPacks(data.items || []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchPacks();
    return () => controller.abort();
  }, []);

  async function handleRegenerate(packId: string) {
    setRegenerating(packId);
    try {
      const response = await fetch(`/api/packs/${packId}/regenerate`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate pack');
      }
      const updatedPack = await response.json();
      setPacks((prev) =>
        prev.map((p) => (p.id === packId ? { ...p, ...updatedPack, status: 'PENDING' } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(null);
    }
  }

  const filteredPacks = filter
    ? packs.filter((p) => p.status === filter)
    : packs;

  const getStatusBadge = (status: Pack['status']) => {
    const styles: Record<Pack['status'], string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      GENERATING: 'bg-blue-100 text-blue-800',
      READY: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return styles[status];
  };

  const getComplexityBadge = (complexity: Pack['complexity']) => {
    const styles: Record<Pack['complexity'], string> = {
      MVP: 'bg-purple-100 text-purple-800',
      STANDARD: 'bg-indigo-100 text-indigo-800',
      FULL: 'bg-pink-100 text-pink-800',
    };
    return styles[complexity];
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error loading packs: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Packs</h1>
        <select
          aria-label="Filter by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="GENERATING">Generating</option>
          <option value="READY">Ready</option>
          <option value="EXPIRED">Expired</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {filteredPacks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <PackageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No packs yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Generate your first pack from a validated idea.
          </p>
          <Link
            href="/ideas"
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Ideas
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPacks.map((pack) => (
            <div
              key={pack.id}
              className="rounded-lg border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {pack.ideaTitle || 'Untitled Idea'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {pack.workUnitCount} work units
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getComplexityBadge(pack.complexity)}`}>
                  {pack.complexity}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {pack.modules.slice(0, 3).map((module) => (
                  <span
                    key={module}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
                  >
                    {module}
                  </span>
                ))}
                {pack.modules.length > 3 && (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    +{pack.modules.length - 3} more
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(pack.status)}`}>
                  {pack.status}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(pack.createdAt).toLocaleDateString()}
                </span>
              </div>

              {pack.status === 'READY' && pack.downloadUrl && (
                <a
                  href={pack.downloadUrl}
                  className="mt-4 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Download Pack
                </a>
              )}

              {(pack.status === 'EXPIRED' || pack.status === 'FAILED') && (
                <button
                  onClick={() => handleRegenerate(pack.id)}
                  disabled={regenerating === pack.id}
                  className="mt-4 flex w-full items-center justify-center rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating === pack.id ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Regenerating...
                    </>
                  ) : (
                    'Regenerate'
                  )}
                </button>
              )}

              {pack.status === 'GENERATING' && (
                <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Generating...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}
