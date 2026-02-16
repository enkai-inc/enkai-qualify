'use client';

import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'enterprise',
    label: 'Enterprise Focus',
    prompt: 'Pivot this idea to focus on enterprise customers with higher contract values, compliance features, and team collaboration capabilities.',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    id: 'mobile',
    label: 'Add Mobile App',
    prompt: 'Add a mobile app component to this idea with native iOS and Android apps, push notifications, and offline-first functionality.',
    icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    id: 'ai',
    label: 'More AI Features',
    prompt: 'Enhance this idea with more AI-powered features like intelligent automation, predictive analytics, and natural language processing.',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  {
    id: 'pricing',
    label: 'Change Pricing',
    prompt: 'Suggest alternative pricing models for this idea including freemium, usage-based, tiered, and per-seat options with recommended price points.',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'alternatives',
    label: 'Show Alternatives',
    prompt: 'Generate 3 alternative approaches to this idea with different technical stacks, target markets, or business models.',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    id: 'scale',
    label: 'Scale Up',
    prompt: 'Expand this idea to handle 10x more users and revenue. Add features for multiple teams, white-labeling, and API access.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  {
    id: 'competitors',
    label: 'Analyze Competitors',
    prompt: 'Identify the top 5 competitors for this idea and suggest unique differentiators and features that would help us stand out.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    id: 'markets',
    label: 'New Markets',
    prompt: 'Identify 3 new market segments this idea could target beyond the current focus, with specific adaptations needed for each.',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export function QuickActions() {
  const { refine, isRefining } = useWorkspaceStore();

  const handleAction = async (action: QuickAction) => {
    if (isRefining) return;
    await refine(action.prompt);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={isRefining}
            className="flex items-center gap-2 p-3 text-left text-sm rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d={action.icon}
              />
            </svg>
            <span className="text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
