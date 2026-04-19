import type { DocumentKey } from "@/lib/types";
import { classifyDocumentFromFilename } from "./classify-document-from-filename";
import { classifyDocumentFromText } from "./classify-document-from-text";
import { extractPdfText } from "./extract-pdf-text";
import { analyzePayslipTextIncome } from "./parse-payslip-income";
import { parseReferenceLetterText } from "./parse-reference-letter";
import type {
  ApplicantDocumentDisplayType,
  ApplicantPdfPipelineCoreResult,
  IncomeConfidence,
} from "./types";

export type ProcessApplicantPdfBufferOptions = {
  filename?: string | null;
  /** User-selected document key when uploading (e.g. rental slot). */
  documentKey?: DocumentKey | null;
  /** Same intent as `documentKey` when the client sends `slot` (e.g. `rental_history`). */
  slot?: string | null;
};

function resolveRentalReferenceIntent(
  options?: ProcessApplicantPdfBufferOptions,
): "rental_history" | "references" | null {
  const key = options?.documentKey;
  const slot = (options?.slot ?? "").toString().trim().toLowerCase();
  if (key === "rental_history" || slot === "rental_history") return "rental_history";
  if (key === "references" || slot === "references") return "references";
  return null;
}

function mapPhotoIdKeys(rawText: string, filename?: string | null): DocumentKey[] {
  const combined = `${filename ?? ""} ${rawText}`.toLowerCase();
  if (/\bpassport\b/.test(combined)) return ["passport"];
  if (/\bdriver'?s?\s+licen[cs]e\b/.test(combined) || /\blicen[cs]e\s+number\b/.test(combined)) {
    return ["drivers_licence"];
  }
  const t = rawText.toLowerCase();
  if (/\bpassport\b/.test(t)) return ["passport"];
  if (/\bdriver'?s?\s+licen[cs]e\b/.test(t) || /\blicen[cs]e\s+number\b/.test(t)) {
    return ["drivers_licence"];
  }
  return ["id"];
}

function mapDisplayTypeToDocumentKeys(
  displayType: ApplicantDocumentDisplayType,
  rawText: string,
  filename?: string | null,
): DocumentKey[] {
  switch (displayType) {
    case "payslip":
      return ["proof_of_income"];
    case "bank_statement":
      return ["bank_statements"];
    case "employment_letter":
      return ["employment_letter"];
    case "rental_history":
      return ["rental_history"];
    case "references":
      return ["references"];
    case "photo_id":
      return mapPhotoIdKeys(rawText, filename);
    case "unknown":
    default:
      return [];
  }
}

function computeNeedsReview(
  displayType: ApplicantDocumentDisplayType,
  payslip: { weeklyIncome: number | null; confidence: IncomeConfidence },
): boolean {
  if (displayType === "payslip") {
    return payslip.weeklyIncome == null || payslip.confidence === "low";
  }
  return false;
}

/**
 * Filename/intent-first pipeline:
 * - Payslip group: extract text + parse income only.
 * - Reference/rental group: extract text + parse reference details only.
 * - Non-target docs: completion-only, no text extraction/parsing.
 */
export async function processApplicantPdfBuffer(
  data: Buffer | Uint8Array,
  options?: ProcessApplicantPdfBufferOptions,
): Promise<ApplicantPdfPipelineCoreResult> {
  const rentalIntent = resolveRentalReferenceIntent(options);
  const displayTypeFromFilename = classifyDocumentFromFilename(options?.filename);
  let displayType: ApplicantDocumentDisplayType =
    rentalIntent != null
      ? rentalIntent === "rental_history"
        ? "rental_history"
        : "references"
      : displayTypeFromFilename;
  let mappedDocumentKeys = mapDisplayTypeToDocumentKeys(displayType, "", options?.filename);
  const isPayslipTarget = displayType === "payslip";
  const isReferenceTarget = displayType === "references" || displayType === "rental_history";
  const needsTextFallback = displayType === "unknown" && rentalIntent == null;
  const isTargetExtraction = isPayslipTarget || isReferenceTarget || needsTextFallback;

  // Non-target files are used for document completion tracking only.
  if (!isTargetExtraction) {
    return {
      displayType,
      extractionStatus: "success",
      mappedDocumentKeys,
      weeklyIncome: null,
      incomeConfidence: null,
      monthsRenting: null,
      recommendationSentiment: null,
      needsReview: false,
    };
  }

  try {
    const rawText = await extractPdfText(data);
    if (needsTextFallback) {
      displayType = classifyDocumentFromText(rawText);
      mappedDocumentKeys = mapDisplayTypeToDocumentKeys(displayType, rawText, options?.filename);
    }

    const { weeklyIncome, confidence } = displayType === "payslip"
      ? analyzePayslipTextIncome(rawText)
      : { weeklyIncome: null, confidence: null };
    const referenceDetails = displayType === "references" || displayType === "rental_history"
      ? parseReferenceLetterText(rawText)
      : { monthsRenting: null, recommendationSentiment: null };

    return {
      displayType,
      extractionStatus: "success",
      mappedDocumentKeys,
      weeklyIncome,
      incomeConfidence: confidence,
      monthsRenting: referenceDetails.monthsRenting,
      recommendationSentiment: referenceDetails.recommendationSentiment,
      needsReview: computeNeedsReview(displayType, {
        weeklyIncome: weeklyIncome ?? null,
        confidence: confidence ?? "low",
      }),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF processing failed";
    return {
      displayType,
      extractionStatus: "failed",
      errorMessage: message,
      mappedDocumentKeys,
      weeklyIncome: null,
      incomeConfidence: null,
      monthsRenting: null,
      recommendationSentiment: null,
      needsReview: true,
    };
  }
}
