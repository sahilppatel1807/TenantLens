import { tierStyles } from "@/lib/scoring";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  tier: Tier;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const ScoreRing = ({ score, tier, size = 56, strokeWidth = 5, className }: ScoreRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  const colorVar =
    tier === "good" ? "var(--tier-good)" : tier === "average" ? "var(--tier-average)" : "var(--tier-bad)";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`hsl(${colorVar})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-sm font-bold leading-none", tierStyles[tier].text)}>{score}</span>
      </div>
    </div>
  );
};
