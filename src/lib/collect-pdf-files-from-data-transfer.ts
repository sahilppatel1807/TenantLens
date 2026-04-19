import { isPdfLike } from "@/lib/applicant-intake-storage";

function fileDedupeKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function dedupePdfFiles(files: File[]): File[] {
  const map = new Map<string, File>();
  for (const f of files) {
    if (!isPdfLike(f)) continue;
    map.set(fileDedupeKey(f), f);
  }
  return Array.from(map.values());
}

/** Merge incoming PDFs into an existing list; later entries with the same key replace earlier ones. */
export function mergeUniquePdfFiles(existing: File[], incoming: File[]): File[] {
  return dedupePdfFiles([...existing, ...incoming]);
}

function getFileFromFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const acc: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    acc.push(...batch);
  } while (batch.length > 0);
  return acc;
}

async function collectPdfsFromDirectoryEntry(dir: FileSystemDirectoryEntry): Promise<File[]> {
  const reader = dir.createReader();
  const entries = await readAllDirectoryEntries(reader);
  const out: File[] = [];
  for (const e of entries) {
    if (e.isFile) {
      const file = await getFileFromFileEntry(e as FileSystemFileEntry);
      if (isPdfLike(file)) out.push(file);
    } else if (e.isDirectory) {
      const nested = await collectPdfsFromDirectoryEntry(e as FileSystemDirectoryEntry);
      out.push(...nested);
    }
  }
  return out;
}

/**
 * Walks dropped files and folders (via `webkitGetAsEntry`) and returns a flat list of PDFs.
 * Non-PDF files are skipped. Duplicates (same name, size, lastModified) are collapsed.
 */
export async function collectPdfFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];

  if (items.length > 0) {
    const out: File[] = [];
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry =
        typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;

      if (entry) {
        if (entry.isFile) {
          const file = await getFileFromFileEntry(entry as FileSystemFileEntry);
          if (isPdfLike(file)) out.push(file);
        } else if (entry.isDirectory) {
          const nested = await collectPdfsFromDirectoryEntry(entry as FileSystemDirectoryEntry);
          out.push(...nested);
        }
      } else {
        const f = item.getAsFile();
        if (f && isPdfLike(f)) out.push(f);
      }
    }
    return dedupePdfFiles(out);
  }

  const fromFiles = dataTransfer.files ? Array.from(dataTransfer.files) : [];
  return dedupePdfFiles(fromFiles.filter(isPdfLike));
}
