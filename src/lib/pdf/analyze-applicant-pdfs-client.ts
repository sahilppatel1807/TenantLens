import { classifyDocumentFromFilename } from "@/lib/pdf/classify-document-from-filename";
import type { ApplicantPdfAnalyzeResultItem } from "@/lib/pdf/applicant-pdf-analyze-result";
import type { DocumentKey } from "@/lib/types";

type AnalyzeIntent = {
  documentKey: DocumentKey | null;
  slot: string | null;
};

export type ApplicantPdfAnalyzeIntent = AnalyzeIntent;

export function inferAnalyzeIntentFromFilename(
  filename: string,
  applicantName?: string | null,
): AnalyzeIntent {
  const displayType = classifyDocumentFromFilename(filename, applicantName);
  switch (displayType) {
    case "payslip":
      return { documentKey: "proof_of_income", slot: "proof_of_income" };
    case "bank_statement":
      return { documentKey: "bank_statements", slot: "bank_statements" };
    case "employment_letter":
      return { documentKey: "employment_letter", slot: "employment_letter" };
    case "rental_history":
      return { documentKey: "rental_history", slot: "rental_history" };
    case "references":
      return { documentKey: "references", slot: "references" };
    case "photo_id":
      return { documentKey: "id", slot: "id" };
    case "unknown":
    default:
      return { documentKey: null, slot: null };
  }
}

export async function analyzeApplicantPdfFiles(
  files: File[],
  intents?: ApplicantPdfAnalyzeIntent[],
  applicantNameForFilename?: string | null,
): Promise<ApplicantPdfAnalyzeResultItem[]> {
  const results: ApplicantPdfAnalyzeResultItem[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const form = new FormData();
    form.append("files", file);
    const intent =
      intents?.[index] ?? inferAnalyzeIntentFromFilename(file.name, applicantNameForFilename);
    if (intent.documentKey) {
      form.append("documentKey", intent.documentKey);
    }
    if (intent.slot) {
      form.append("slot", intent.slot);
    }

    const analyzeRes = await fetch("/api/applicant-pdfs/analyze", {
      method: "POST",
      body: form,
    });
    const analyzeJson = (await analyzeRes.json().catch(() => null)) as
      | { results?: ApplicantPdfAnalyzeResultItem[]; error?: string }
      | null;
    if (!analyzeRes.ok) {
      throw new Error(analyzeJson?.error || `Could not analyze ${file.name}.`);
    }
    const row = analyzeJson?.results?.[0];
    if (!row) {
      throw new Error(`Analyze response did not include a result for ${file.name}.`);
    }
    results.push(row);
  }

  return results;
}
