import {
  APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES,
  APPLICANT_PDF_ANALYZE_MAX_FILES,
} from "@/lib/pdf/analyze-limits";
import { processApplicantPdfBuffer } from "@/lib/pdf/process-applicant-pdf-buffer";
import { DOCUMENT_KEYS, type DocumentKey } from "@/lib/types";

export const runtime = "nodejs";

function parseDocumentKeyField(
  value: FormDataEntryValue | null,
): DocumentKey | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return DOCUMENT_KEYS.includes(v as DocumentKey) ? (v as DocumentKey) : null;
}

function parseSlotField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v || null;
}

function isPdfFile(file: File): boolean {
  const type = (file.type ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

export async function POST(request: Request) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json(
        { error: "Expected multipart form data" },
        { status: 400 },
      );
    }

    const entries = form.getAll("files");
    const files = entries.filter((e): e is File => e instanceof File);
    const documentKey = parseDocumentKeyField(form.get("documentKey"));
    const slot = parseSlotField(form.get("slot"));

    if (files.length === 0) {
      return Response.json(
        { error: 'No PDF files provided (use form field "files")' },
        { status: 400 },
      );
    }

    if (files.length > APPLICANT_PDF_ANALYZE_MAX_FILES) {
      return Response.json(
        {
          error: `At most ${APPLICANT_PDF_ANALYZE_MAX_FILES} files per request`,
        },
        { status: 400 },
      );
    }

    const results = [];

    for (const file of files) {
      const filename = file.name || "document.pdf";

      if (!isPdfFile(file)) {
        results.push({
          filename,
          displayType: "unknown",
          extractionStatus: "failed" as const,
          errorMessage: "File must be a PDF",
          mappedDocumentKeys: [],
          weeklyIncome: null,
          incomeConfidence: null,
          monthsRenting: null,
          recommendationSentiment: null,
          needsReview: true,
        });
        continue;
      }

      if (file.size > APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES) {
        results.push({
          filename,
          displayType: "unknown",
          extractionStatus: "failed" as const,
          errorMessage: `File exceeds maximum size of ${APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES} bytes`,
          mappedDocumentKeys: [],
          weeklyIncome: null,
          incomeConfidence: null,
          monthsRenting: null,
          recommendationSentiment: null,
          needsReview: true,
        });
        continue;
      }

      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const core = await processApplicantPdfBuffer(buf, {
          filename,
          documentKey,
          slot,
        });
        results.push({
          filename,
          displayType: core.displayType,
          extractionStatus: core.extractionStatus,
          ...(core.errorMessage ? { errorMessage: core.errorMessage } : {}),
          mappedDocumentKeys: core.mappedDocumentKeys,
          weeklyIncome: core.weeklyIncome,
          incomeConfidence: core.incomeConfidence,
          monthsRenting: core.monthsRenting,
          recommendationSentiment: core.recommendationSentiment,
          needsReview: core.needsReview,
        });
      } catch (error) {
        results.push({
          filename,
          displayType: "unknown",
          extractionStatus: "failed" as const,
          errorMessage:
            error instanceof Error ? error.message : "PDF processing failed",
          mappedDocumentKeys: [],
          weeklyIncome: null,
          incomeConfidence: null,
          monthsRenting: null,
          recommendationSentiment: null,
          needsReview: true,
        });
      }
    }

    return Response.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected analysis error";
    return Response.json({ error: message }, { status: 500 });
  }
}
