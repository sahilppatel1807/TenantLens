import type { ApplicantDocumentDisplayType } from "./types";

type FilenameRule = {
  type: Exclude<ApplicantDocumentDisplayType, "unknown">;
  keywords: string[];
};

const FILENAME_RULES: FilenameRule[] = [
  { type: "payslip", keywords: ["payslip", "pay slip", "income", "salary", "wage slip"] },
  {
    type: "bank_statement",
    keywords: [
      "bank statement",
      "bank_statement",
      "bank statements",
      // Common filename misspelling ("statement" → "satement")
      "bank satement",
      "bank_satement",
      "bank satements",
      "bank stmt",
      "statement of account",
      "account statement",
      "transaction history",
    ],
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
      "ref letter",
      "landlord reference",
      "employer reference",
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
      "national id",
      "govt id",
      "government id",
    ],
  },
];

function normalizeFilename(filename: string): string {
  return filename.toLowerCase().replace(/[_\-.]+/g, " ");
}

function splitFilenameStemAndExt(filename: string): { stem: string; extWithDot: string } {
  const base = filename.replace(/^.*[/\\]/, "");
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return { stem: base, extWithDot: "" };
  return { stem: base.slice(0, dot), extWithDot: base.slice(dot) };
}

/** Underscores and whitespace separate logical tokens (e.g. `jason bank_statement`, `jason bank statement`). */
function splitStemIntoParts(stem: string): string[] {
  return stem.split(/[_\s]+/).filter((p) => p.length > 0);
}

function normalizeNameForMatch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How many leading underscore segments of `parts` are the applicant name (all tokens in order,
 * or a single segment equal to the underscored / compact full name).
 */
function leadingApplicantPartsConsumed(parts: string[], applicantName: string): number {
  const tokens = normalizeNameForMatch(applicantName).split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;

  const first = parts[0]?.trim().toLowerCase() ?? "";
  const underscored = tokens.join("_");
  const compact = tokens.join("");
  if (first === underscored || first === compact) return 1;

  let pi = 0;
  for (let ti = 0; ti < tokens.length && pi < parts.length; ti++) {
    if (parts[pi].trim().toLowerCase() !== tokens[ti]) break;
    pi++;
  }
  return pi;
}

function classifyNormalized(normalized: string): ApplicantDocumentDisplayType {
  const n = normalized.trim();
  if (!n) return "unknown";
  // Intake abbreviations (avoid matching substrings like inside "download").
  if (/\bdl\b/.test(n)) return "photo_id";
  for (const rule of FILENAME_RULES) {
    if (rule.keywords.some((keyword) => n.includes(keyword))) {
      return rule.type;
    }
  }
  return "unknown";
}

/**
 * Classify by filename first for common intake naming patterns.
 * Supports optional `{ApplicantName}_{documentType}.pdf`: when the full basename does not match,
 * leading segments that match the typed full name (per-token or one compact/underscored segment)
 * are removed and classification is retried. Without `applicantName`, a single leading segment is
 * removed only when the remainder alone produces a non-unknown type (avoids stripping `bank` from
 * `bank_statement_…`).
 */
export function classifyDocumentFromFilename(
  filename: string | null | undefined,
  applicantName?: string | null,
): ApplicantDocumentDisplayType {
  const raw = filename ?? "";
  const normalizedFull = normalizeFilename(raw);
  const direct = classifyNormalized(normalizedFull);
  if (direct !== "unknown") return direct;

  const { stem, extWithDot } = splitFilenameStemAndExt(raw);
  const parts = splitStemIntoParts(stem);
  if (parts.length < 2) return "unknown";

  const hasApplicant = Boolean(applicantName?.trim());
  let consumed: number;
  if (hasApplicant) {
    consumed = leadingApplicantPartsConsumed(parts, applicantName!.trim());
    if (consumed === 0) return "unknown";
  } else {
    consumed = 1;
    const remainderStemProbe = parts.slice(consumed).join("_");
    const normalizedRemainderProbe = normalizeFilename(`${remainderStemProbe}${extWithDot}`);
    if (classifyNormalized(normalizedRemainderProbe) === "unknown") return "unknown";
  }

  const remainderStem = parts.slice(consumed).join("_");
  if (!remainderStem) return "unknown";
  return classifyNormalized(normalizeFilename(`${remainderStem}${extWithDot}`));
}
