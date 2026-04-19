#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processApplicantPdfBuffer } from "../src/lib/pdf/process-applicant-pdf-buffer.ts";

const pdfPath = process.argv[2];
const sourceFilename = process.argv[3] ?? null;
const documentKey = process.argv[4]?.trim() ? process.argv[4].trim() : null;
const slot = process.argv[5]?.trim() ? process.argv[5].trim() : null;
if (!pdfPath) {
  console.error(
    "Usage: node --import tsx scripts/run-applicant-pdf-core.mjs <path-to-pdf> [source-filename] [documentKey] [slot]",
  );
  process.exit(1);
}

const abs = resolve(process.cwd(), pdfPath);
const buf = readFileSync(abs);
const result = await processApplicantPdfBuffer(buf, {
  filename: sourceFilename,
  ...(documentKey ? { documentKey } : {}),
  ...(slot ? { slot } : {}),
});
console.log(JSON.stringify(result));
