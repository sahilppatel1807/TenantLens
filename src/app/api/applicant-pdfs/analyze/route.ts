import {
  APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES,
  APPLICANT_PDF_ANALYZE_MAX_FILES,
} from "@/lib/pdf/analyze-limits";
import { DOCUMENT_KEYS, type DocumentKey } from "@/lib/types";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
const SCRIPT_REL_PATH = "scripts/run-applicant-pdf-core.mjs";

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

async function analyzeViaNodeScript(
  pdfPath: string,
  sourceFilename: string,
  intent: { documentKey: DocumentKey | null; slot: string | null },
) {
  return new Promise<{
    displayType: "payslip" | "bank_statement" | "employment_letter" | "rental_history" | "references" | "photo_id" | "unknown";
    extractionStatus: "success" | "failed";
    errorMessage?: string;
    mappedDocumentKeys: string[];
    weeklyIncome: number | null;
    incomeConfidence: "high" | "medium" | "low" | null;
    monthsRenting: number | null;
    recommendationSentiment: "strong" | "neutral" | "negative" | null;
    needsReview: boolean;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        SCRIPT_REL_PATH,
        pdfPath,
        sourceFilename,
        intent.documentKey ?? "",
        intent.slot ?? "",
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `PDF parser script failed (${code}). ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(
          new Error(
            `Invalid parser output. ${stderr.trim() || "Could not parse JSON response."}`,
          ),
        );
      }
    });
  });
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
    const tempDir = await mkdtemp(join(tmpdir(), "tenantlens-applicant-pdf-"));

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
        const tempPath = join(tempDir, `${Date.now()}-${Math.random()}.pdf`);
        await writeFile(tempPath, buf);
        const core = await analyzeViaNodeScript(tempPath, filename, {
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

    await rm(tempDir, { recursive: true, force: true });
    return Response.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected analysis error";
    return Response.json({ error: message }, { status: 500 });
  }
}
