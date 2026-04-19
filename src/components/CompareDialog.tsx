import { Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { effectiveTenancyMonths, rentalBehaviorLabel, scoreApplicant } from "@/lib/scoring";
import { documentKeyCategory, requiredCategoryIds, DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";
import type { Applicant, Property } from "@/lib/types";

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicants: Applicant[];
  property: Property | null;
}

export const CompareDialog = ({ open, onOpenChange, applicants, property }: CompareDialogProps) => {
  if (!property) return null;
  const scored = applicants.map((a) => ({ a, s: scoreApplicant(a, property) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Compare applicants</DialogTitle>
          <DialogDescription>
            {property.address}, {property.suburb} · ${property.weeklyRent}/wk
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto">
          <div
            className="grid min-w-[640px] gap-px bg-border"
            style={{ gridTemplateColumns: `200px repeat(${scored.length}, minmax(180px, 1fr))` }}
          >
            {/* Header row */}
            <div className="bg-secondary/60 p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Applicant
            </div>
            {scored.map(({ a, s }) => (
              <div key={a.id} className="bg-card p-4">
                <div className="flex items-center gap-3">
                  <ScoreRing score={s.total} tier={s.tier} size={48} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <TierBadge tier={s.tier} />
                  </div>
                </div>
              </div>
            ))}

            <Row label="Total score">
              {scored.map(({ a, s }) => (
                <span key={a.id} className="text-lg font-bold text-foreground">
                  {s.total}<span className="text-sm font-medium text-muted-foreground">/100</span>
                </span>
              ))}
            </Row>
            <Row label="Documents">
              {scored.map(({ a, s }) => (
                <span key={a.id} className="text-sm font-semibold">{s.completeness}/50</span>
              ))}
            </Row>
            <Row label="Income">
              {scored.map(({ a, s }) => (
                <span key={a.id} className="text-sm font-semibold">{s.income}/30</span>
              ))}
            </Row>
            <Row label="Rental history">
              {scored.map(({ a, s }) => (
                <span key={a.id} className="text-sm font-semibold">{s.history}/20</span>
              ))}
            </Row>
            <Row label="Weekly income">
              {scored.map(({ a }) => (
                <span key={a.id} className="text-sm">${a.weeklyIncome}</span>
              ))}
            </Row>
            <Row label="Income / rent">
              {scored.map(({ a, s }) => (
                <span key={a.id} className="text-sm font-semibold">{s.rentToIncomeRatio.toFixed(1)}x</span>
              ))}
            </Row>
            <Row label="Months renting">
              {scored.map(({ a }) => (
                <span key={a.id} className="text-sm">
                  {effectiveTenancyMonths(a.rentalHistory)} mo
                </span>
              ))}
            </Row>
            <Row label="Rental behavior">
              {scored.map(({ a }) => {
                const b = rentalBehaviorLabel(a.rentalHistory);
                return (
                  <span
                    key={a.id}
                    className={`text-sm font-semibold ${b === "Good" ? "text-tier-good" : "text-muted-foreground"}`}
                  >
                    {b}
                  </span>
                );
              })}
            </Row>

            {/* Documents matrix */}
            {requiredCategoryIds(property.requiredDocuments).map((cat) => (
              <Row key={cat} label={DOCUMENT_CATEGORY_LABELS[cat]}>
                {scored.map(({ a }) =>
                  a.submittedDocuments.some((k) => documentKeyCategory(k) === cat) ? (
                    <Check key={a.id} className="h-4 w-4 text-tier-good" />
                  ) : (
                    <X key={a.id} className="h-4 w-4 text-tier-bad" />
                  ),
                )}
              </Row>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <>
    <div className="bg-secondary/40 p-4 text-xs font-medium text-muted-foreground">{label}</div>
    {Array.isArray(children) ? children.map((c, i) => (
      <div key={i} className="flex items-center bg-card p-4">{c}</div>
    )) : <div className="flex items-center bg-card p-4">{children}</div>}
  </>
);
