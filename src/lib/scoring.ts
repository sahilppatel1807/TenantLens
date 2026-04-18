import type { Applicant, DocumentKey, Property, Tier } from "./types";

export interface ScoreBreakdown {
  completeness: number; // /50
  income: number; // /30
  history: number; // /20
  total: number; // /100
  tier: Tier;
  missingDocuments: DocumentKey[];
  rentToIncomeRatio: number; // weeklyIncome / weeklyRent
}

export function tierFor(score: number): Tier {
  if (score >= 75) return "good";
  if (score >= 50) return "average";
  return "bad";
}

export function scoreApplicant(applicant: Applicant, property: Property): ScoreBreakdown {
  const required = property.requiredDocuments;
  const missing = required.filter((d) => !applicant.submittedDocuments.includes(d));
  const completeness =
    required.length === 0 ? 50 : Math.round(((required.length - missing.length) / required.length) * 50);

  const ratio = property.weeklyRent === 0 ? 0 : applicant.weeklyIncome / property.weeklyRent;
  let income = 0;
  if (ratio >= 3) income = 30;
  else if (ratio >= 2.5) income = 25;
  else if (ratio >= 2) income = 18;
  else if (ratio >= 1.5) income = 10;
  else income = 4;

  const { yearsRenting, onTimePaymentsPct, referenceQuality } = applicant.rentalHistory;
  let history = 0;
  history += Math.min(8, yearsRenting * 2); // up to 8
  history += Math.round((onTimePaymentsPct / 100) * 8); // up to 8
  history +=
    referenceQuality === "strong" ? 4 : referenceQuality === "ok" ? 2 : referenceQuality === "weak" ? 1 : 0;
  history = Math.min(20, history);

  const total = completeness + income + history;
  return {
    completeness,
    income,
    history,
    total,
    tier: tierFor(total),
    missingDocuments: missing,
    rentToIncomeRatio: ratio,
  };
}

export const tierStyles: Record<Tier, { label: string; chip: string; dot: string; ring: string; text: string }> = {
  good: {
    label: "Good",
    chip: "bg-tier-good-soft text-tier-good border-tier-good/20",
    dot: "bg-tier-good",
    ring: "ring-tier-good/30",
    text: "text-tier-good",
  },
  average: {
    label: "Average",
    chip: "bg-tier-average-soft text-tier-average border-tier-average/20",
    dot: "bg-tier-average",
    ring: "ring-tier-average/30",
    text: "text-tier-average",
  },
  bad: {
    label: "Bad",
    chip: "bg-tier-bad-soft text-tier-bad border-tier-bad/20",
    dot: "bg-tier-bad",
    ring: "ring-tier-bad/30",
    text: "text-tier-bad",
  },
};
