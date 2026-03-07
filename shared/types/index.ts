/**
 * Shared types for Enkai Qualify
 * Used by both dashboard (Next.js) and can be referenced by API (for consistency)
 */

// Core domain types
export interface Idea {
  id: string;
  title: string;
  description: string;
  industry: Industry;
  targetMarket: TargetMarket;
  technologies: string[];
  features: string[];
  status: IdeaStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type Industry =
  | 'healthcare'
  | 'finance'
  | 'education'
  | 'ecommerce'
  | 'productivity'
  | 'legal'
  | 'hr'
  | 'marketing'
  | 'other';

export type TargetMarket =
  | 'b2b'
  | 'b2c'
  | 'freelancers'
  | 'enterprise'
  | 'startups'
  | 'government';

export type IdeaStatus = 'draft' | 'validated' | 'pack_generated' | 'archived';

// Validation types
export interface Validation {
  id: string;
  ideaId: string;
  version: number;
  keywordScore: number;
  painPointScore: number;
  competitionScore: number;
  revenueEstimate: number;
  overallScore: number;
  createdAt: string;
}

// Pack types
export interface Pack {
  id: string;
  ideaId: string;
  modules: string[];
  complexity: PackComplexity;
  workUnitCount: number;
  downloadUrl?: string;
  expiresAt?: string;
  status: PackStatus;
  createdAt: string;
}

export type PackComplexity = 'mvp' | 'standard' | 'full';
export type PackStatus = 'pending' | 'generating' | 'ready' | 'expired' | 'failed';

// API response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
