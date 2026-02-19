'use client';

import { useState, useEffect } from 'react';
import { IdeaStatus } from '@prisma/client';

interface IdeaFiltersProps {
  filters: {
    status?: IdeaStatus;
    search?: string;
    sortBy: 'createdAt' | 'updatedAt' | 'title';
    sortOrder: 'asc' | 'desc';
  };
  onFilterChange: (filters: Partial<IdeaFiltersProps['filters']>) => void;
}

export function IdeaFilters({ filters, onFilterChange }: IdeaFiltersProps) {
  const [search, setSearch] = useState(filters.search ?? '');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) {
        onFilterChange({ search: search || undefined });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, filters.search, onFilterChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search */}
      <div className="flex-1">
        <div className="relative">
          <input
            type="text"
            placeholder="Search ideas..."
            aria-label="Search ideas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            aria-hidden="true"
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Status filter */}
      <select
        value={filters.status ?? ''}
        onChange={(e) =>
          onFilterChange({
            status: e.target.value ? (e.target.value as IdeaStatus) : undefined,
          })
        }
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">All Status</option>
        <option value="PENDING">Generating</option>
        <option value="DRAFT">Draft</option>
        <option value="VALIDATED">Validated</option>
        <option value="PACK_GENERATED">Pack Ready</option>
        <option value="ARCHIVED">Archived</option>
      </select>

      {/* Sort */}
      <select
        aria-label="Sort ideas by"
        value={`${filters.sortBy}-${filters.sortOrder}`}
        onChange={(e) => {
          const [sortBy, sortOrder] = e.target.value.split('-') as [
            'createdAt' | 'updatedAt' | 'title',
            'asc' | 'desc'
          ];
          onFilterChange({ sortBy, sortOrder });
        }}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="updatedAt-desc">Recently Updated</option>
        <option value="createdAt-desc">Newest First</option>
        <option value="createdAt-asc">Oldest First</option>
        <option value="title-asc">Title A-Z</option>
        <option value="title-desc">Title Z-A</option>
      </select>
    </div>
  );
}
