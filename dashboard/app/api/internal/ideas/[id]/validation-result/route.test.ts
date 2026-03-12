/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock internal auth
jest.mock('@/lib/internal-auth', () => ({
  requireInternalAuth: jest.fn(),
}));

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    idea: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    validation: {
      create: jest.fn(),
    },
    pack: {
      findFirst: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma: mockPrisma } = require('@/lib/db');

// Mock pack service
jest.mock('@/lib/services/pack-service', () => ({
  createPack: jest.fn(),
}));

const mockParams = Promise.resolve({ id: 'idea-1' });

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/internal/ideas/idea-1/validation-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/ideas/[id]/validation-result', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.idea.findUnique.mockResolvedValue({ id: 'idea-1', currentVersion: 1 });
    mockPrisma.validation.create.mockResolvedValue({ id: 'val-1' });
    mockPrisma.idea.update.mockResolvedValue({ id: 'idea-1', userId: 'user-1', teamId: null });
    mockPrisma.pack.findFirst.mockResolvedValue(null);
  });

  it('accepts basic details with strict fields', async () => {
    const body = {
      keywordScore: 75,
      painPointScore: 80,
      competitionScore: 60,
      revenueEstimate: 5000,
      overallScore: 72,
      details: {
        marketSize: '$5B',
        competitorCount: 12,
        feasibilityNotes: 'Feasible',
      },
    };

    const response = await POST(makeRequest(body), { params: mockParams });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('created');
  });

  it('accepts details with painPoints array', async () => {
    const body = {
      keywordScore: 75,
      painPointScore: 85,
      competitionScore: 60,
      revenueEstimate: 5000,
      overallScore: 78,
      details: {
        marketSize: '$5B',
        competitorCount: 12,
        feasibilityNotes: 'Feasible',
        painPoints: [
          {
            category: 'Slow onboarding',
            quotes: ['It took me 3 hours to set up', 'The docs are terrible'],
            source: 'r/webdev',
            engagement: 142,
          },
        ],
        redditThreadsAnalyzed: 45,
        totalQuotesCollected: 12,
      },
    };

    const response = await POST(makeRequest(body), { params: mockParams });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('created');
  });

  it('accepts details with keywordResearch and trendAnalysis', async () => {
    const body = {
      keywordScore: 75,
      painPointScore: 80,
      competitionScore: 60,
      revenueEstimate: 5000,
      overallScore: 72,
      details: {
        marketSize: '$5B',
        competitorCount: 12,
        feasibilityNotes: 'Feasible',
        keywordResearch: {
          keywords: [{ term: 'saas onboarding', monthlyVolume: 1200, competition: 'low' }],
          totalMonthlyVolume: 1200,
          source: 'Google Trends',
        },
        trendAnalysis: {
          direction: 'up',
          stability: 'stable',
          fiveYearChange: '+35%',
        },
        recommendation: 'Strong market signal',
        mvpFeatures: ['auth', 'dashboard', 'API'],
      },
    };

    const response = await POST(makeRequest(body), { params: mockParams });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('created');
  });

  it('rejects request with missing required scores', async () => {
    const body = {
      keywordScore: 75,
      // missing other scores
      details: {},
    };

    const response = await POST(makeRequest(body), { params: mockParams });
    expect(response.status).toBe(400);
  });

  it('returns 404 when idea not found', async () => {
    mockPrisma.idea.findUnique.mockResolvedValue(null);

    const body = {
      keywordScore: 75,
      painPointScore: 80,
      competitionScore: 60,
      revenueEstimate: 5000,
      overallScore: 72,
      details: {},
    };

    const response = await POST(makeRequest(body), { params: mockParams });
    expect(response.status).toBe(404);
  });

  it('returns 401 when auth fails', async () => {
    const { requireInternalAuth } = require('@/lib/internal-auth');
    requireInternalAuth.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const body = {
      keywordScore: 75,
      painPointScore: 80,
      competitionScore: 60,
      revenueEstimate: 5000,
      overallScore: 72,
      details: {},
    };

    const response = await POST(makeRequest(body), { params: mockParams });
    expect(response.status).toBe(401);
  });
});
