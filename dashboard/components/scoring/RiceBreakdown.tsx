"use client";

import { useMemo } from "react";

interface RiceScore {
  reach: number;
  reach_raw: number;
  reach_reasoning: string;
  impact: number;
  impact_reasoning: string;
  confidence: number;
  confidence_reasoning: string;
  effort: number;
  effort_reasoning: string;
  effort_source: string;
  score: number;
}

interface RiceBreakdownProps {
  score: RiceScore;
  className?: string;
}

/**
 * RiceBreakdown displays a visual breakdown of RICE scoring factors.
 *
 * Shows horizontal bar charts for each factor (Reach, Impact, Confidence, Effort)
 * along with the final calculated score and reasoning for each factor.
 */
export function RiceBreakdown({ score, className = "" }: RiceBreakdownProps) {
  const factors = useMemo(
    () => [
      {
        label: "Reach",
        value: score.reach,
        max: 500,
        reasoning: score.reach_reasoning,
        color: "bg-blue-500",
      },
      {
        label: "Impact",
        value: score.impact,
        max: 3,
        reasoning: score.impact_reasoning,
        color: "bg-green-500",
      },
      {
        label: "Confidence",
        value: score.confidence * 100,
        max: 100,
        reasoning: score.confidence_reasoning,
        color: "bg-yellow-500",
        suffix: "%",
      },
      {
        label: "Effort",
        value: score.effort,
        max: 24,
        reasoning: `${score.effort_reasoning} (${score.effort_source})`,
        color: "bg-red-500",
        suffix: " mo",
        inverted: true,
      },
    ],
    [score]
  );

  return (
    <div className={`rounded-lg border bg-white p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">RICE Score</h3>
        <span className="text-2xl font-bold text-blue-600">
          {score.score.toFixed(1)}
        </span>
      </div>

      <div className="space-y-3">
        {factors.map((factor) => {
          const percentage = Math.min((factor.value / factor.max) * 100, 100);
          const displayPercentage = factor.inverted
            ? 100 - percentage
            : percentage;

          return (
            <div key={factor.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{factor.label}</span>
                <span className="text-gray-500">
                  {factor.value.toFixed(factor.value < 10 ? 1 : 0)}
                  {factor.suffix || ""}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  role="progressbar"
                  aria-valuenow={factor.value}
                  aria-valuemin={0}
                  aria-valuemax={factor.max}
                  aria-label={factor.label}
                  className={`h-full rounded-full transition-all ${factor.color}`}
                  style={{ width: `${displayPercentage}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {factor.reasoning}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-3">
        <p className="text-xs text-gray-500">
          Score = (Reach × Impact × Confidence) ÷ Effort
        </p>
      </div>
    </div>
  );
}
