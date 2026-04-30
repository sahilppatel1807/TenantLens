import { describe, expect, it } from "vitest";
import {
  collectApplicantIntakeGroupsFromDataTransfer,
  collectApplicantIntakeGroupsFromFileList,
  collectApplicantIntakeFilesFromDataTransfer,
  collectApplicantIntakeFilesFromFileList,
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

describe("collectApplicantIntakeFilesFromFileList", () => {
  it("returns PDFs, TXT metadata, and a shared top-level folder name", () => {
    const pdf = new File([], "passport.pdf", { type: "application/pdf" });
    const txt = new File(["Name: Folder Person"], "details.txt", { type: "text/plain" });
    Object.defineProperty(pdf, "webkitRelativePath", { value: "sahil_patel/passport.pdf" });
    Object.defineProperty(txt, "webkitRelativePath", { value: "sahil_patel/details.txt" });

    const out = collectApplicantIntakeFilesFromFileList([pdf, txt]);
    expect(out.pdfFiles.map((f) => f.name)).toEqual(["passport.pdf"]);
    expect(out.metadataTextFiles.map((f) => f.name)).toEqual(["details.txt"]);
    expect(out.folderName).toBe("sahil_patel");
  });

  it("keeps TXT files out of the PDF upload list", () => {
    const txt = new File(["Name: Text Only"], "details.txt", { type: "text/plain" });
    const out = collectApplicantIntakeFilesFromFileList([txt]);
    expect(out.pdfFiles).toEqual([]);
    expect(out.metadataTextFiles.map((f) => f.name)).toEqual(["details.txt"]);
  });
});

describe("collectApplicantIntakeGroupsFromFileList", () => {
  it("groups direct applicant folders independently", () => {
    const alexPdf = new File([], "passport.pdf", { type: "application/pdf" });
    const alexTxt = new File(["Name: Alex Ray"], "details.txt", { type: "text/plain" });
    const samPdf = new File([], "payslip.pdf", { type: "application/pdf" });
    Object.defineProperty(alexPdf, "webkitRelativePath", { value: "alex_ray/passport.pdf" });
    Object.defineProperty(alexTxt, "webkitRelativePath", { value: "alex_ray/details.txt" });
    Object.defineProperty(samPdf, "webkitRelativePath", { value: "sam_lee/payslip.pdf" });

    const out = collectApplicantIntakeGroupsFromFileList([alexPdf, alexTxt, samPdf]);
    expect(out.map((group) => group.folderName)).toEqual(["alex_ray", "sam_lee"]);
    expect(out[0].pdfFiles.map((file) => file.name)).toEqual(["passport.pdf"]);
    expect(out[0].metadataTextFiles.map((file) => file.name)).toEqual(["details.txt"]);
    expect(out[1].pdfFiles.map((file) => file.name)).toEqual(["payslip.pdf"]);
  });

  it("groups applicant subfolders inside a selected parent folder", () => {
    const alexPdf = new File([], "passport.pdf", { type: "application/pdf" });
    const samPdf = new File([], "payslip.pdf", { type: "application/pdf" });
    Object.defineProperty(alexPdf, "webkitRelativePath", { value: "batch/alex_ray/passport.pdf" });
    Object.defineProperty(samPdf, "webkitRelativePath", { value: "batch/sam_lee/payslip.pdf" });

    const out = collectApplicantIntakeGroupsFromFileList([alexPdf, samPdf]);
    expect(out.map((group) => group.folderName)).toEqual(["alex_ray", "sam_lee"]);
  });
});

describe("collectApplicantIntakeFilesFromDataTransfer", () => {
  it("returns dropped directory metadata text files with folder context", async () => {
    const pdf = new File([], "nested.pdf", { type: "application/pdf" });
    const txt = new File(["Name: Alex"], "details.txt", { type: "text/plain" });
    const root = makeDirectoryEntry("Alex_Application", [makeFileEntry(pdf), makeFileEntry(txt)]);
    const dt = { items: [makeDataTransferItem(root)] } as unknown as DataTransfer;

    const out = await collectApplicantIntakeFilesFromDataTransfer(dt);
    expect(out.pdfFiles.map((f) => f.name)).toEqual(["nested.pdf"]);
    expect(out.metadataTextFiles.map((f) => f.name)).toEqual(["details.txt"]);
    expect(out.folderName).toBe("Alex_Application");
  });

  it("keeps realistic folder-upload TXT metadata separate from PDF uploads", async () => {
    const payslip = new File([], "sahil_patel_payslip.pdf", { type: "application/pdf" });
    const bankStatement = new File([], "sahil_patel_bank_statement.pdf", { type: "application/pdf" });
    const metadata = new File(
      [
        `
          Name: Sahil Patel
          Email: sahil@example.com
          Phone no. - +61 412 555 098
          Occupation: Property Manager
        `,
      ],
      "applicant_details.txt",
      { type: "text/plain" },
    );
    const root = makeDirectoryEntry("sahil", [
      makeFileEntry(metadata),
      makeFileEntry(payslip),
      makeFileEntry(bankStatement),
    ]);
    const dt = { items: [makeDataTransferItem(root)] } as unknown as DataTransfer;

    const out = await collectApplicantIntakeFilesFromDataTransfer(dt);
    expect(out.folderName).toBe("sahil");
    expect(out.metadataTextFiles.map((f) => f.name)).toEqual(["applicant_details.txt"]);
    expect(out.pdfFiles.map((f) => f.name).sort()).toEqual([
      "sahil_patel_bank_statement.pdf",
      "sahil_patel_payslip.pdf",
    ]);
    expect(out.pdfFiles.some((f) => f.name.endsWith(".txt"))).toBe(false);
  });

  it("orders metadata TXT files deterministically by shallowest path then filename", async () => {
    const rootB = new File(["Name: B"], "b-details.txt", { type: "text/plain" });
    const rootA = new File(["Name: A"], "a-details.txt", { type: "text/plain" });
    const nested = new File(["Name: Nested"], "0-nested.txt", { type: "text/plain" });
    const pdf = new File([], "application.pdf", { type: "application/pdf" });
    const sub = makeDirectoryEntry("inner", [makeFileEntry(nested)]);
    const root = makeDirectoryEntry("Alex_Application", [
      makeFileEntry(rootB),
      sub,
      makeFileEntry(pdf),
      makeFileEntry(rootA),
    ]);
    const dt = { items: [makeDataTransferItem(root)] } as unknown as DataTransfer;

    const out = await collectApplicantIntakeFilesFromDataTransfer(dt);
    expect(out.metadataTextFiles.map((f) => f.name)).toEqual(["a-details.txt", "b-details.txt", "0-nested.txt"]);
    expect(out.pdfFiles.map((f) => f.name)).toEqual(["application.pdf"]);
  });
});

describe("collectApplicantIntakeGroupsFromDataTransfer", () => {
  it("groups multiple dropped directories by applicant folder", async () => {
    const alexPdf = new File([], "passport.pdf", { type: "application/pdf" });
    const alexTxt = new File(["Name: Alex Ray"], "details.txt", { type: "text/plain" });
    const samPdf = new File([], "payslip.pdf", { type: "application/pdf" });
    const alex = makeDirectoryEntry("alex_ray", [makeFileEntry(alexPdf), makeFileEntry(alexTxt)]);
    const sam = makeDirectoryEntry("sam_lee", [makeFileEntry(samPdf)]);
    const dt = {
      items: [makeDataTransferItem(alex), makeDataTransferItem(sam)],
    } as unknown as DataTransfer;

    const out = await collectApplicantIntakeGroupsFromDataTransfer(dt);
    expect(out.map((group) => group.folderName)).toEqual(["alex_ray", "sam_lee"]);
    expect(out[0].metadataTextFiles.map((file) => file.name)).toEqual(["details.txt"]);
    expect(out[1].pdfFiles.map((file) => file.name)).toEqual(["payslip.pdf"]);
  });
});
