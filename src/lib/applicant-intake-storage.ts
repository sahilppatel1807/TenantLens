import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { classifyDocumentFromFilename } from "@/lib/pdf/classify-document-from-filename";
import type { DocumentKey } from "@/lib/types";

/** One row from analyze API — only fields needed for storage categorization. */
export type IntakeAnalyzeResultForStorage = {
  filename: string;
  extractionStatus: "success" | "failed";
  mappedDocumentKeys: DocumentKey[];
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

export function isPdfLike(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const lowerType = (file.type ?? "").toLowerCase();
  return lowerType === "application/pdf" || lowerName.endsWith(".pdf");
}

function filenameFallbackDocumentKey(filename: string): DocumentKey | "attachment" {
  const displayType = classifyDocumentFromFilename(filename);
  if (displayType === "payslip") return "proof_of_income";
  if (displayType === "bank_statement") return "bank_statements";
  if (displayType === "employment_letter") return "employment_letter";
  if (displayType === "rental_history") return "rental_history";
  if (displayType === "references") return "references";
  if (displayType === "photo_id") return "passport";
  return "attachment";
}

function storageDocumentKey(
  row: IntakeAnalyzeResultForStorage | undefined,
  filename: string,
): DocumentKey | "attachment" {
  if (row?.extractionStatus === "success" && row.mappedDocumentKeys.length > 0) {
    return row.mappedDocumentKeys[0];
  }
  return filenameFallbackDocumentKey(filename);
}

function analyzeRowForFile(
  file: File,
  index: number,
  rows: IntakeAnalyzeResultForStorage[] | null,
): IntakeAnalyzeResultForStorage | undefined {
  if (!rows?.length) return undefined;
  if (rows.length === 1 && file.name === rows[0].filename) return rows[0];
  if (index < rows.length && rows[index].filename === file.name) return rows[index];
  const matches = rows.filter((r) => r.filename === file.name);
  if (matches.length === 1) return matches[0];
  return index < rows.length ? rows[index] : undefined;
}

/**
 * After an applicant is created, upload intake PDFs to Storage and insert `applicant_documents`.
 * Matches ApplicantDrawer upload path pattern. Failures are collected — callers toast; no throw.
 */
export async function uploadIntakePdfsBestEffort(params: {
  applicantId: string;
  files: File[];
  analyzeResults: IntakeAnalyzeResultForStorage[] | null;
}): Promise<{ uploaded: number; failures: { filename: string; message: string }[] }> {
  const { applicantId, files, analyzeResults } = params;
  const failures: { filename: string; message: string }[] = [];
  if (files.length === 0) return { uploaded: 0, failures };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      uploaded: 0,
      failures: files.map((f) => ({ filename: f.name, message: "Supabase is not configured" })),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      uploaded: 0,
      failures: files.map((f) => ({ filename: f.name, message: "Not signed in" })),
    };
  }

  let uploaded = 0;
  const baseTs = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!isPdfLike(file)) {
      failures.push({
        filename: file.name,
        message: "Only PDF files are supported.",
      });
      continue;
    }

    const row = analyzeRowForFile(file, i, analyzeResults);
    const documentKey = storageDocumentKey(row, file.name);
    const safeName = sanitizeFilename(file.name);
    const path = `${user.id}/${applicantId}/${baseTs}-${i}-${safeName}`;

    try {
      const { error: upErr } = await supabase.storage.from("applicant-documents").upload(path, file, {
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("applicant_documents").insert({
        applicant_id: applicantId,
        document_key: documentKey,
        storage_path: path,
        original_filename: file.name,
      });
      if (insErr) throw insErr;
      uploaded += 1;
    } catch (err) {
      failures.push({
        filename: file.name,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { uploaded, failures };
}
