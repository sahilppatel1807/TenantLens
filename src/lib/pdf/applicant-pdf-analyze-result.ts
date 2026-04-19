import type { DocumentKey, RecommendationSentiment } from "@/lib/types";
import type { ApplicantDocumentDisplayType } from "./types";

/** One row from `POST /api/applicant-pdfs/analyze` (per uploaded PDF). */
export type ApplicantPdfAnalyzeResultItem = {
  filename: string;
  displayType: ApplicantDocumentDisplayType;
  extractionStatus: "success" | "failed";
  errorMessage?: string;
  mappedDocumentKeys: DocumentKey[];
  weeklyIncome: number | null;
  incomeConfidence: "high" | "medium" | "low" | null;
  monthsRenting: number | null;
  recommendationSentiment: RecommendationSentiment | null;
  needsReview: boolean;
};
