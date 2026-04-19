import {
  APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES,
  APPLICANT_PDF_ANALYZE_MAX_FILES,
} from "@/lib/pdf/analyze-limits";
import { classifyDocumentFromText } from "@/lib/pdf/classify-document-from-text";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { PayslipIncomeResult } from "@/lib/pdf/types";

export const runtime = "nodejs";

const RAW_TEXT_PREVIEW_LIMIT = 2_000;
const SCRIPT_REL_PATH = "scripts/run-payslip-income.mjs";

function isPdfFile(file: File): boolean {
  const type = (file.type ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

async function analyzeViaNodeScript(pdfPath: string): Promise<PayslipIncomeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", SCRIPT_REL_PATH, pdfPath],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => reject(err));
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
        const parsed = JSON.parse(stdout) as PayslipIncomeResult;
        resolve(parsed);
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

export async function POST(request: Request) {
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
  if (files.length === 0) {
    return Response.json(
      { error: 'No PDF files provided (use form field "files")' },
      { status: 400 },
    );
  }
  if (files.length > APPLICANT_PDF_ANALYZE_MAX_FILES) {
    return Response.json(
      { error: `At most ${APPLICANT_PDF_ANALYZE_MAX_FILES} files per request` },
      { status: 400 },
    );
  }

  const results = [];
  const tempDir = await mkdtemp(join(tmpdir(), "tenantlens-pdf-debug-"));
  for (const file of files) {
    const filename = file.name || "document.pdf";
    if (!isPdfFile(file)) {
      results.push({
        filename,
        extractionStatus: "failed" as const,
        errorMessage: "File must be a PDF",
      });
      continue;
    }
    if (file.size > APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES) {
      results.push({
        filename,
        extractionStatus: "failed" as const,
        errorMessage: `File exceeds maximum size of ${APPLICANT_PDF_ANALYZE_MAX_FILE_BYTES} bytes`,
      });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const tempPath = join(tempDir, `${Date.now()}-${Math.random()}.pdf`);
      await writeFile(tempPath, buffer);
      const parsed = await analyzeViaNodeScript(tempPath);
      const displayType = classifyDocumentFromText(parsed.rawText);
      results.push({
        filename,
        extractionStatus: "success" as const,
        displayType,
        rawTextLength: parsed.rawText.length,
        rawTextPreview: parsed.rawText.slice(0, RAW_TEXT_PREVIEW_LIMIT),
        payslip: parsed,
      });
    } catch (error) {
      results.push({
        filename,
        extractionStatus: "failed" as const,
        errorMessage:
          error instanceof Error ? error.message : "PDF processing failed",
      });
    }
  }

  await rm(tempDir, { recursive: true, force: true });

  return Response.json({ results });
}
