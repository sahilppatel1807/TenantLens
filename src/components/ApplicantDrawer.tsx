import { Check, Mail, Phone, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { ApplicantStatusActions } from "./ApplicantStatusActions";
import { useData } from "@/lib/store";
import { scoreApplicant } from "@/lib/scoring";
import { DOCUMENT_LABELS, type Applicant, type Property } from "@/lib/types";

interface ApplicantDrawerProps {
  applicant: Applicant | null;
  property: Property | null;
  onClose: () => void;
}

export const ApplicantDrawer = ({ applicant, property, onClose }: ApplicantDrawerProps) => {
  const { setApplicantStatus } = useData();
  const open = Boolean(applicant && property);
  if (!applicant || !property) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }
  const score = scoreApplicant(applicant, property);
  const submittedSet = new Set(applicant.submittedDocuments);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-4">
            <ScoreRing score={score.total} tier={score.tier} size={64} strokeWidth={6} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-xl">{applicant.name}</SheetTitle>
              <SheetDescription className="truncate">
                {applicant.occupation} · Applied {new Date(applicant.appliedAt).toLocaleDateString()}
              </SheetDescription>
              <div className="mt-2">
                <TierBadge tier={score.tier} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 grid gap-2 rounded-xl bg-secondary/60 p-3 text-sm">
          <a className="flex items-center gap-2 text-foreground hover:underline" href={`mailto:${applicant.email}`}>
            <Mail className="h-4 w-4 text-muted-foreground" />
            {applicant.email}
          </a>
          <a className="flex items-center gap-2 text-foreground hover:underline" href={`tel:${applicant.phone}`}>
            <Phone className="h-4 w-4 text-muted-foreground" />
            {applicant.phone}
          </a>
        </div>

        <Separator className="my-5" />

        <section>
          <h4 className="text-sm font-semibold">Score breakdown</h4>
          <div className="mt-3 space-y-3">
            <ScoreBar label="Document completeness" value={score.completeness} max={50} />
            <ScoreBar label="Income vs rent" value={score.income} max={30} />
            <ScoreBar label="Rental history" value={score.history} max={20} />
          </div>
        </section>

        <Separator className="my-5" />

        <section>
          <h4 className="text-sm font-semibold">Income</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            ${applicant.weeklyIncome}/wk against ${property.weeklyRent}/wk rent ·{" "}
            <span className="font-semibold text-foreground">{score.rentToIncomeRatio.toFixed(1)}x</span>
          </p>
        </section>

        <Separator className="my-5" />

        <section>
          <h4 className="text-sm font-semibold">Documents</h4>
          <ul className="mt-3 space-y-1.5">
            {property.requiredDocuments.map((doc) => {
              const has = submittedSet.has(doc);
              return (
                <li
                  key={doc}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="text-foreground">{DOCUMENT_LABELS[doc]}</span>
                  {has ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-tier-good">
                      <Check className="h-3.5 w-3.5" /> Submitted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-tier-bad">
                      <X className="h-3.5 w-3.5" /> Missing
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <Separator className="my-5" />

        <section>
          <h4 className="text-sm font-semibold">Rental history</h4>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Years renting" value={`${applicant.rentalHistory.yearsRenting} yrs`} />
            <Stat label="On-time payments" value={`${applicant.rentalHistory.onTimePaymentsPct}%`} />
            <Stat label="Reference" value={applicant.rentalHistory.referenceQuality} className="capitalize" />
            <Stat label="Missing docs" value={`${score.missingDocuments.length}`} />
          </dl>
          {applicant.rentalHistory.notes && (
            <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
              {applicant.rentalHistory.notes}
            </p>
          )}
        </section>

        {applicant.notes && (
          <>
            <Separator className="my-5" />
            <section>
              <h4 className="text-sm font-semibold">Agent notes</h4>
              <p className="mt-2 text-sm text-muted-foreground">{applicant.notes}</p>
            </section>
          </>
        )}

        <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-2 border-t border-border bg-background px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <ApplicantStatusActions
            status={applicant.status}
            onChange={(s) => setApplicantStatus(applicant.id, s)}
            size="md"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

const ScoreBar = ({ label, value, max }: { label: string; value: number; max: number }) => (
  <div>
    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">
        {value}/{max}
      </span>
    </div>
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  </div>
);

const Stat = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={`mt-0.5 text-sm font-semibold text-foreground ${className ?? ""}`}>{value}</dd>
  </div>
);
