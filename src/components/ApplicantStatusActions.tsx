import { Bookmark, BookmarkCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApplicantStatus } from "@/lib/types";

interface Props {
  status: ApplicantStatus;
  onChange: (s: ApplicantStatus) => void;
  size?: "sm" | "md";
}

export const ApplicantStatusActions = ({ status, onChange, size = "sm" }: Props) => {
  const isShort = status === "shortlisted";
  const isReject = status === "rejected";

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size={size === "sm" ? "sm" : "default"}
        variant={isShort ? "default" : "outline"}
        className={cn(isShort && "bg-tier-good text-primary-foreground hover:bg-tier-good/90")}
        onClick={(e) => {
          e.stopPropagation();
          onChange(isShort ? "new" : "shortlisted");
        }}
      >
        {isShort ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        <span className="hidden sm:inline">{isShort ? "Shortlisted" : "Shortlist"}</span>
      </Button>
      <Button
        type="button"
        size={size === "sm" ? "sm" : "default"}
        variant={isReject ? "default" : "outline"}
        className={cn(isReject && "bg-tier-bad text-primary-foreground hover:bg-tier-bad/90")}
        onClick={(e) => {
          e.stopPropagation();
          onChange(isReject ? "new" : "rejected");
        }}
      >
        <X className="h-4 w-4" />
        <span className="hidden sm:inline">{isReject ? "Rejected" : "Reject"}</span>
      </Button>
    </div>
  );
};

export const ApplicantStatusBadge = ({ status }: { status: ApplicantStatus }) => {
  if (status === "new") return null;
  const map = {
    shortlisted: { label: "Shortlisted", cls: "bg-tier-good-soft text-tier-good" },
    rejected: { label: "Rejected", cls: "bg-tier-bad-soft text-tier-bad" },
  } as const;
  const { label, cls } = map[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{label}</span>;
};
