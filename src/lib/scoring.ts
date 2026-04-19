import { missingRepresentativeRequiredKeys, requiredCategoryIds, documentKeyCategory } from "./document-categories";
import type { Applicant, DocumentKey, Property, RecommendationSentiment, RentalHistory, Tier } from "./types";

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

/** Whole months used for rental-history tenure scoring and UI. Prefer PDF-derived months when set. */
export function effectiveTenancyMonths(h: RentalHistory): number {
  if (typeof h.monthsRenting === "number" && Number.isFinite(h.monthsRenting) && h.monthsRenting >= 0) {
    return Math.round(h.monthsRenting);
  }
  return Math.max(0, Math.round(h.yearsRenting * 12));
}

/**
 * Tenure sub-score for rental history (/10).
 * - Under 5 months: 3
 * - 5–12 months: months − 1, capped at 9 (so 12 months → 9)
 * - Over 12 months: 10
 */
export function scoreTenancyMonthsForHistory(months: number): number {
  const m = Math.max(0, Math.round(months));
  if (m < 5) return 3;
  if (m > 12) return 10;
  return Math.min(m - 1, 9);
}

function scoreRecommendationSentiment(s: RecommendationSentiment): number {
  switch (s) {
    case "strong":
      return 10;
    case "neutral":
      return 5;
    case "negative":
      return 0;
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
}

/** Recommendation sub-score for rental history (/10). Uses sentiment when present, else legacy reference quality. */
export function scoreRecommendationForHistory(h: RentalHistory): number {
  // Binary: any positive/acceptable reference = 20, else 0
  if (
    h.recommendationSentiment === "strong" ||
    h.recommendationSentiment === "neutral" ||
    h.referenceQuality === "strong" ||
    h.referenceQuality === "ok"
  ) {
    return 20;
  }
  return 0;
}

/** Binary summary of reference / recommendation quality for display. */
export function rentalBehaviorLabel(h: RentalHistory): "Good" | "None" {
  return scoreRecommendationForHistory(h) === 20 ? "Good" : "None";
}

export function scoreApplicant(applicant: Applicant, property: Property): ScoreBreakdown {
  const required = property.requiredDocuments;
  const requiredCats = requiredCategoryIds(required);
  const missing = missingRepresentativeRequiredKeys(required, applicant.submittedDocuments);
  const satisfiedCatCount = requiredCats.filter((cat) =>
    applicant.submittedDocuments.some((k) => documentKeyCategory(k) === cat),
  ).length;
  const completeness =
    requiredCats.length === 0 ? 50 : Math.round((satisfiedCatCount / requiredCats.length) * 50);

  const ratio = property.weeklyRent > 0 && applicant.weeklyIncome > 0
    ? applicant.weeklyIncome / property.weeklyRent
    : 0;
  let income = 0;
  if (applicant.weeklyIncome <= 0 || property.weeklyRent <= 0) income = 0;
  else if (ratio >= 3) income = 30;
  else if (ratio >= 2.5) income = 25;
  else if (ratio >= 2) income = 18;
  else if (ratio >= 1.5) income = 10;
  else if (ratio >= 1.49) income = 9;
  else if (ratio >= 1.4) income = 8;
  else if (ratio >= 1.3) income = 7;
  else if (ratio >= 1.25) income = 5;
  else income = 4;

  // Binary: if any valid reference, 20; else 0
  const history = scoreRecommendationForHistory(applicant.rentalHistory);

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
