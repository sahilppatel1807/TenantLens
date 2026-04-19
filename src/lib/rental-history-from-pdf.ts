import type { Applicant, RecommendationSentiment } from "@/lib/types";
import type { ApplicantDocumentDisplayType } from "@/lib/pdf/types";

type AnalyzeSlice = {
  displayType: ApplicantDocumentDisplayType;
  extractionStatus: "success" | "failed";
  monthsRenting: number | null;
  recommendationSentiment: RecommendationSentiment | null;
};

function sentimentRank(s: RecommendationSentiment): number {
  if (s === "strong") return 2;
  if (s === "neutral") return 1;
  return 0;
}

/** Map parser sentiment to reference quality for storage/UI; scoring prefers `recommendationSentiment` when set. */
export function recommendationSentimentToReferenceQuality(
  s: RecommendationSentiment,
): Applicant["rentalHistory"]["referenceQuality"] {
  if (s === "strong") return "strong";
  if (s === "neutral") return "ok";
  return "weak";
}

/**
 * Merge months and recommendation from all successful reference / rental-history PDF analyses.
 * Months: max of non-null values. Sentiment: strongest wins (strong > neutral > negative).
 */
export function mergeReferenceLetterFieldsFromAnalyzeResults(
  results: AnalyzeSlice[],
): { monthsRenting: number | null; recommendationSentiment: RecommendationSentiment | null } {
  let bestMonths: number | null = null;
  let bestSentiment: RecommendationSentiment | null = null;
  let bestRank = -1;

  for (const r of results) {
    if (r.extractionStatus !== "success") continue;
    if (r.displayType !== "references" && r.displayType !== "rental_history") continue;

    if (r.monthsRenting != null && r.monthsRenting > 0) {
      bestMonths = bestMonths == null ? r.monthsRenting : Math.max(bestMonths, r.monthsRenting);
    }

    if (r.recommendationSentiment != null) {
      const rank = sentimentRank(r.recommendationSentiment);
      if (rank > bestRank) {
        bestRank = rank;
        bestSentiment = r.recommendationSentiment;
      }
    }
  }

  return { monthsRenting: bestMonths, recommendationSentiment: bestSentiment };
}

export function mergeRentalHistoryWithReferenceAnalyze(
  current: Applicant["rentalHistory"],
  analyzed: AnalyzeSlice | null,
): Applicant["rentalHistory"] {
  if (!analyzed || analyzed.extractionStatus !== "success") return current;
  if (analyzed.displayType !== "references" && analyzed.displayType !== "rental_history") return current;

  const next = { ...current };

  if (analyzed.monthsRenting != null && analyzed.monthsRenting > 0) {
    next.monthsRenting =
      current.monthsRenting != null && current.monthsRenting > 0
        ? Math.max(current.monthsRenting, analyzed.monthsRenting)
        : analyzed.monthsRenting;
  }

  if (analyzed.recommendationSentiment != null) {
    next.recommendationSentiment = analyzed.recommendationSentiment;
    next.referenceQuality = recommendationSentimentToReferenceQuality(analyzed.recommendationSentiment);
  }

  return next;
}
