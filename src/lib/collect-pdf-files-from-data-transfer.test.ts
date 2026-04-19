import { describe, expect, it } from "vitest";
import {
  collectPdfFilesFromDataTransfer,
  dedupePdfFiles,
  mergeUniquePdfFiles,
} from "./collect-pdf-files-from-data-transfer";

function makeFileEntry(file: File): FileSystemFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    file: (success: (f: File) => void) => success(file),
  } as unknown as FileSystemFileEntry;
}

function makeDirectoryReader(entries: FileSystemEntry[]) {
  let first = true;
  return {
    readEntries(success: (batch: FileSystemEntry[]) => void) {
      if (first) {
        first = false;
        success(entries);
      } else {
        success([]);
      }
    },
  };
}

function makeDirectoryEntry(name: string, children: FileSystemEntry[]): FileSystemDirectoryEntry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => makeDirectoryReader(children),
  } as unknown as FileSystemDirectoryEntry;
}

function makeDataTransferItem(entry: FileSystemEntry | null, fileFallback?: File | null) {
  return {
    kind: "file",
    webkitGetAsEntry: () => entry,
    getAsFile: () => fileFallback ?? null,
  } as unknown as DataTransferItem;
}

describe("mergeUniquePdfFiles", () => {
  it("keeps PDFs and drops non-PDFs", () => {
    const a = new File([], "a.pdf", { type: "application/pdf" });
    const txt = new File([], "readme.txt", { type: "text/plain" });
    expect(mergeUniquePdfFiles([], [a, txt])).toEqual([a]);
  });

  it("dedupes by name, size, and lastModified", () => {
    const t = Date.now();
    const a = new File([], "x.pdf", { type: "application/pdf", lastModified: t });
    const b = new File([], "x.pdf", { type: "application/pdf", lastModified: t });
    expect(mergeUniquePdfFiles([a], [b])).toHaveLength(1);
  });

  it("appends distinct files", () => {
    const a = new File([], "a.pdf", { type: "application/pdf" });
    const b = new File([], "b.pdf", { type: "application/pdf" });
    expect(mergeUniquePdfFiles([a], [b]).map((f) => f.name).sort()).toEqual(["a.pdf", "b.pdf"]);
  });
});

describe("dedupePdfFiles", () => {
  it("filters to pdf-like names", () => {
    const doc = new File([], "scan.PDF", { type: "" });
    expect(dedupePdfFiles([doc])).toHaveLength(1);
  });
});

describe("collectPdfFilesFromDataTransfer", () => {
  it("reads a single dropped file entry as PDF", async () => {
    const pdf = new File([], "one.pdf", { type: "application/pdf" });
    const dt = { items: [makeDataTransferItem(makeFileEntry(pdf))] } as unknown as DataTransfer;
    const out = await collectPdfFilesFromDataTransfer(dt);
    expect(out.map((f) => f.name)).toEqual(["one.pdf"]);
  });

  it("recurses into nested directories", async () => {
    const nested = new File([], "nested.pdf", { type: "application/pdf" });
    const sub = makeDirectoryEntry("inner", [makeFileEntry(nested)]);
    const root = makeDirectoryEntry("Alex_Application", [sub]);
    const dt = { items: [makeDataTransferItem(root)] } as unknown as DataTransfer;
    const out = await collectPdfFilesFromDataTransfer(dt);
    expect(out.map((f) => f.name)).toEqual(["nested.pdf"]);
  });

  it("skips non-PDFs inside a directory", async () => {
    const pdf = new File([], "keep.pdf", { type: "application/pdf" });
    const txt = new File([], "readme.txt", { type: "text/plain" });
    const dir = makeDirectoryEntry("folder", [makeFileEntry(pdf), makeFileEntry(txt)]);
    const dt = { items: [makeDataTransferItem(dir)] } as unknown as DataTransfer;
    const out = await collectPdfFilesFromDataTransfer(dt);
    expect(out.map((f) => f.name)).toEqual(["keep.pdf"]);
  });

  it("falls back to getAsFile when webkitGetAsEntry is missing or null", async () => {
    const pdf = new File([], "fallback.pdf", { type: "application/pdf" });
    const item = {
      kind: "file",
      webkitGetAsEntry: () => null,
      getAsFile: () => pdf,
    } as unknown as DataTransferItem;
    const dt = { items: [item] } as unknown as DataTransfer;
    const out = await collectPdfFilesFromDataTransfer(dt);
    expect(out.map((f) => f.name)).toEqual(["fallback.pdf"]);
  });

  it("uses dataTransfer.files when the items list is empty", async () => {
    const pdf = new File([], "files-only.pdf", { type: "application/pdf" });
    const dt = { items: [], files: [pdf] } as unknown as DataTransfer;
    const out = await collectPdfFilesFromDataTransfer(dt);
    expect(out.map((f) => f.name)).toEqual(["files-only.pdf"]);
  });
});
