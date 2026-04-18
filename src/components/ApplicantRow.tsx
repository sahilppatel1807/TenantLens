import { Mail, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { ApplicantStatusActions, ApplicantStatusBadge } from "./ApplicantStatusActions";
import type { ScoreBreakdown } from "@/lib/scoring";
import type { Applicant, ApplicantStatus } from "@/lib/types";

interface ApplicantRowProps {
  applicant: Applicant;
  score: ScoreBreakdown;
  rank: number;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onClick?: (id: string) => void;
  onStatusChange?: (id: string, status: ApplicantStatus) => void;
}

export const ApplicantRow = ({
  applicant,
  score,
  rank,
  selected,
  onToggleSelect,
  onClick,
  onStatusChange,
}: ApplicantRowProps) => (
  <div
    className="flex cursor-pointer items-center gap-4 border-b border-border bg-card px-4 py-4 transition-colors last:border-b-0 hover:bg-secondary/50"
    onClick={() => onClick?.(applicant.id)}
  >
    {onToggleSelect && (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(applicant.id)}
          aria-label={`Select ${applicant.name}`}
        />
      </div>
    )}
    <span className="hidden w-6 text-center text-sm font-semibold text-muted-foreground sm:inline">#{rank}</span>
    <ScoreRing score={score.total} tier={score.tier} size={48} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="truncate font-semibold text-foreground">{applicant.name}</h4>
        <TierBadge tier={score.tier} />
        <ApplicantStatusBadge status={applicant.status} />
      </div>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {applicant.occupation} · ${applicant.weeklyIncome}/wk
      </p>
      <div className="mt-1 hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground md:flex">
        <span className="inline-flex items-center gap-1">
          <Mail className="h-3 w-3" />
          {applicant.email}
        </span>
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {applicant.phone}
        </span>
      </div>
    </div>
    <div className="hidden w-44 shrink-0 lg:block">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>Docs</span>
        <span className="text-foreground">{score.completeness}/50</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(score.completeness / 50) * 100}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>Income</span>
        <span className="text-foreground">{score.income}/30</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(score.income / 30) * 100}%` }} />
      </div>
    </div>
    {onStatusChange && (
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <ApplicantStatusActions
          status={applicant.status}
          onChange={(s) => onStatusChange(applicant.id, s)}
        />
      </div>
    )}
  </div>
);
