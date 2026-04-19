import { createRequire } from "node:module";
import { dirname, join } from "node:path";

type PdfParseCtor = new (options: { data: Buffer | Uint8Array }) => {
  getText: () => Promise<{ text?: string | null }>;
  destroy: () => Promise<void>;
};

type PdfParseModule = {
  PDFParse?: PdfParseCtor & {
    setWorker?: (workerSrc?: string) => string;
  };
};

let cachedCtor: PdfParseCtor | null = null;

function getPdfParseCtor(): PdfParseCtor {
  if (cachedCtor) return cachedCtor;
  const require = createRequire(import.meta.url);
  const mod = require("pdf-parse") as PdfParseModule;
  if (!mod.PDFParse) throw new Error("pdf-parse failed to load");
  const resolvedEntry = require.resolve("pdf-parse");
  const workerPath = join(dirname(resolvedEntry), "pdf.worker.mjs");
  mod.PDFParse.setWorker?.(workerPath);
  cachedCtor = mod.PDFParse;
  return cachedCtor;
}

/**
 * Extracts plain text from a PDF byte buffer (text layer only; no OCR).
 * Node/server environments only — uses pdf.js via pdf-parse.
 */
export async function extractPdfText(
  data: Buffer | Uint8Array,
): Promise<string> {
  const PDFParse = getPdfParseCtor();
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}
