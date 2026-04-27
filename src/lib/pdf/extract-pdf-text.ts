import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

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

function resolveWorkerSrc(require: NodeRequire): string | null {
  const candidates = [
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    "pdfjs-dist/build/pdf.worker.mjs",
    "pdf-parse",
  ];

  for (const id of candidates) {
    try {
      const resolved = require.resolve(id);
      // For `pdf-parse`, this resolves to .../dist/pdf-parse/cjs/index.cjs;
      // replace with sibling worker file.
      const fsPath =
        id === "pdf-parse"
          ? resolved.replace(/index\.cjs$/, "pdf.worker.mjs")
          : resolved;
      return pathToFileURL(fsPath).href;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function getPdfParseCtor(): PdfParseCtor {
  if (cachedCtor) return cachedCtor;
  const require = createRequire(import.meta.url);
  const mod = require("pdf-parse") as PdfParseModule;
  if (!mod.PDFParse) throw new Error("pdf-parse failed to load");
  const workerSrc = resolveWorkerSrc(require);
  if (workerSrc) mod.PDFParse.setWorker?.(workerSrc);
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
