/**
 * Shared types for payslip PDF text extraction and income parsing.
 * Parsing and orchestration logic ship in later phases; this file only defines the contract.
 */

import type { DocumentKey, RecommendationSentiment } from "@/lib/types";

export type PayFrequency =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "annual"
  | "unknown";

export type IncomeConfidence = "high" | "medium" | "low";
export type { RecommendationSentiment };

export type PayslipAmountSource = "gross" | "net" | "annual" | "other" | null;

/** One line-level or field-level match candidate (bounded list in parsers, e.g. top 5). */
export type PayslipIncomeCandidate = {
  source: string;
  amount: number;
  frequencyHint: PayFrequency;
  lineSnippet?: string;
};

/** Output of parsing plain payslip text only (no PDF buffer). */
export type PayslipIncomeParse = {
  detectedIncomeAmount: number | null;
  detectedPayFrequency: PayFrequency;
  amountSource: PayslipAmountSource;
  candidates: PayslipIncomeCandidate[];
  notes: string[];
};

/** Full pipeline result: text layer + parsed income + weekly normalization. */
export type PayslipIncomeResult = PayslipIncomeParse & {
  rawText: string;
  weeklyIncome: number | null;
  confidence: IncomeConfidence;
};

/** User-facing label from heuristic classification (before property-specific key resolution). */
export type ApplicantDocumentDisplayType =
  | "payslip"
  | "bank_statement"
  | "employment_letter"
  | "rental_history"
  | "references"
  | "photo_id"
  | "unknown";

/** One PDF analyzed for applicant intake (filename added by HTTP layer). */
export type ApplicantPdfPipelineCoreResult = {
  displayType: ApplicantDocumentDisplayType;
  extractionStatus: "success" | "failed";
  errorMessage?: string;
  mappedDocumentKeys: DocumentKey[];
  weeklyIncome: number | null;
  incomeConfidence: IncomeConfidence | null;
  monthsRenting: number | null;
  recommendationSentiment: RecommendationSentiment | null;
  needsReview: boolean;
};
