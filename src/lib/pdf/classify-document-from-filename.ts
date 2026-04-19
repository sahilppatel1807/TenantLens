import type { ApplicantDocumentDisplayType } from "./types";

type FilenameRule = {
  type: Exclude<ApplicantDocumentDisplayType, "unknown">;
  keywords: string[];
};

const FILENAME_RULES: FilenameRule[] = [
  { type: "payslip", keywords: ["payslip", "pay slip", "income"] },
  {
    type: "bank_statement",
    keywords: ["bank statement", "bank_statement", "transaction history"],
  },
  {
    type: "employment_letter",
    keywords: [
      "employment letter",
      "employment verification",
      "employer letter",
      "job letter",
      "work letter",
    ],
  },
  {
    type: "rental_history",
    keywords: [
      "rental history",
      "rent history",
      "tenancy",
      "lease",
      "landlord",
      "tenant",
      "rent ledger",
      "rental ledger",
    ],
  },
  {
    type: "references",
    keywords: [
      "character reference",
      "professional reference",
      "referee",
      "reference letter",
      "reference",
    ],
  },
  {
    type: "photo_id",
    keywords: [
      "passport",
      "driver licence",
      "drivers licence",
      "driver's licence",
      "drivers license",
      "driver license",
      "photo id",
      "identity",
      "id card",
    ],
  },
];

function normalizeFilename(filename: string): string {
  return filename.toLowerCase().replace(/[_\-.]+/g, " ");
}

/**
 * Classify by filename first for common intake naming patterns.
 */
export function classifyDocumentFromFilename(
  filename: string | null | undefined,
): ApplicantDocumentDisplayType {
  const normalized = normalizeFilename(filename ?? "");
  if (!normalized.trim()) return "unknown";

  for (const rule of FILENAME_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.type;
    }
  }

  return "unknown";
}
