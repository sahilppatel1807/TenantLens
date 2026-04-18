import { tierStyles } from "@/lib/scoring";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: Tier;
  className?: string;
  showDot?: boolean;
}

export const TierBadge = ({ tier, className, showDot = true }: TierBadgeProps) => {
  const s = tierStyles[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        s.chip,
        className,
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {s.label}
    </span>
  );
};
