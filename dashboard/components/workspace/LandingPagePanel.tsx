'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

export function LandingPagePanel() {
  const { idea } = useWorkspaceStore();
  const [copied, setCopied] = useState(false);

  const landingPage = idea?.metadata?.landingPage;
  if (!landingPage) return null;

  const handleCopy = async () => {
    const text = [
      `# ${landingPage.headline}`,
      `## ${landingPage.subheadline}`,
      '',
      ...(landingPage.sections || []).map((s: { type: string; content: string }) =>
        `### ${s.type}\n${s.content}`
      ),
    ].join('\n\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Landing Page Blueprint</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>

      {landingPage.generatedAt && (
        <p className="text-xs text-gray-500 mb-4">
          Generated {new Date(landingPage.generatedAt).toLocaleDateString()}
        </p>
      )}

      {/* Hero Section Preview */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-lg p-6 mb-4 text-white">
        <h3 className="text-xl font-bold mb-2">{landingPage.headline}</h3>
        <p className="text-sm text-blue-100">{landingPage.subheadline}</p>
      </div>

      {/* Sections */}
      {landingPage.sections?.length > 0 && (
        <div className="space-y-4">
          {landingPage.sections.map((section: { type: string; content: string }, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {section.type}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
