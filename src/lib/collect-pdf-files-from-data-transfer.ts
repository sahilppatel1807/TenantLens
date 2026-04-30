import { isPdfLike } from "@/lib/applicant-intake-storage";

export type ApplicantIntakeFiles = {
  pdfFiles: File[];
  metadataTextFiles: File[];
  folderName: string | null;
};

export type ApplicantIntakeFileGroup = ApplicantIntakeFiles & {
  id: string;
};

type FileCandidate = {
  file: File;
  path: string;
};

type MetadataTextFileCandidate = {
  file: File;
  path: string;
};

function debugTextFileCandidates(stage: string, candidates: MetadataTextFileCandidate[]): void {
  console.debug(`[ApplicantIntake] ${stage}`, {
    metadataTextFileCandidates: candidates.map((candidate) => ({
      name: candidate.file.name,
      path: candidate.path,
      type: candidate.file.type,
      size: candidate.file.size,
    })),
  });
}

function fileDedupeKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function isTxtLike(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const lowerType = (file.type ?? "").toLowerCase();
  return lowerType === "text/plain" || lowerName.endsWith(".txt");
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

async function collectIntakeFilesFromDirectoryEntry(
  dir: FileSystemDirectoryEntry,
  pathPrefix = dir.name,
): Promise<{ pdfFileCandidates: FileCandidate[]; metadataTextFileCandidates: MetadataTextFileCandidate[] }> {
  const reader = dir.createReader();
  const entries = await readAllDirectoryEntries(reader);
  const pdfFileCandidates: FileCandidate[] = [];
  const metadataTextFileCandidates: MetadataTextFileCandidate[] = [];
  for (const e of entries) {
    if (e.isFile) {
      const file = await getFileFromFileEntry(e as FileSystemFileEntry);
      const path = `${pathPrefix}/${e.name}`;
      if (isPdfLike(file)) pdfFileCandidates.push({ file, path });
      if (isTxtLike(file)) metadataTextFileCandidates.push({ file, path });
    } else if (e.isDirectory) {
      const nested = await collectIntakeFilesFromDirectoryEntry(
        e as FileSystemDirectoryEntry,
        `${pathPrefix}/${e.name}`,
      );
      pdfFileCandidates.push(...nested.pdfFileCandidates);
      metadataTextFileCandidates.push(...nested.metadataTextFileCandidates);
    }
  }
  return { pdfFileCandidates, metadataTextFileCandidates };
}

function folderNameFromFileList(files: File[]): string | null {
  const names = new Set<string>();
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const first = rel?.split("/").find(Boolean);
    if (first) names.add(first);
  }
  return names.size === 1 ? Array.from(names)[0] : null;
}

function dedupeTextFiles(files: File[]): File[] {
  const map = new Map<string, File>();
  for (const f of files) {
    if (!isTxtLike(f)) continue;
    map.set(fileDedupeKey(f), f);
  }
  return Array.from(map.values());
}

function filePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel?.trim() || file.name;
}

function metadataTextFilePriority(candidate: MetadataTextFileCandidate): [number, string, string] {
  const pathParts = candidate.path.split("/").filter(Boolean);
  const filename = pathParts[pathParts.length - 1] ?? candidate.file.name;
  return [pathParts.length, filename.toLowerCase(), candidate.path.toLowerCase()];
}

function prioritizedMetadataTextFiles(candidates: MetadataTextFileCandidate[]): File[] {
  const deduped = new Map<string, MetadataTextFileCandidate>();
  for (const candidate of candidates) {
    if (!isTxtLike(candidate.file)) continue;
    deduped.set(fileDedupeKey(candidate.file), candidate);
  }

  const selected = Array.from(deduped.values()).sort((a, b) => {
    const aPriority = metadataTextFilePriority(a);
    const bPriority = metadataTextFilePriority(b);
    return (
      aPriority[0] - bPriority[0] ||
      aPriority[1].localeCompare(bPriority[1]) ||
      aPriority[2].localeCompare(bPriority[2])
    );
  });

  console.debug("[ApplicantIntake] selected TXT metadata files", selected.map((candidate) => ({
    name: candidate.file.name,
    path: candidate.path,
    type: candidate.file.type,
    size: candidate.file.size,
  })));

  return selected.map((candidate) => candidate.file);
}

export function collectApplicantIntakeFilesFromFileList(files: File[]): ApplicantIntakeFiles {
  const metadataTextFileCandidates = dedupeTextFiles(files).map((file) => ({ file, path: filePath(file) }));
  debugTextFileCandidates("detected TXT candidates from file list", metadataTextFileCandidates);
  const folderName = folderNameFromFileList(files);
  console.debug("[ApplicantIntake] resolved folder name from webkitRelativePath", { folderName });

  return {
    pdfFiles: dedupePdfFiles(files),
    metadataTextFiles: prioritizedMetadataTextFiles(metadataTextFileCandidates),
    folderName,
  };
}

function groupedFolderParts(candidates: FileCandidate[]): Map<string, { folderName: string | null; paths: string[] }> {
  const partsByPath = candidates.map((candidate) => ({
    path: candidate.path,
    parts: candidate.path.split("/").filter(Boolean),
  }));
  const firstLevel = new Set(partsByPath.map((candidate) => candidate.parts[0]).filter(Boolean));
  const secondLevel = new Set(
    partsByPath
      .filter((candidate) => candidate.parts.length >= 3)
      .map((candidate) => `${candidate.parts[0]}/${candidate.parts[1]}`),
  );
  const shouldGroupBySecondLevel = firstLevel.size === 1 && secondLevel.size > 1;
  const groups = new Map<string, { folderName: string | null; paths: string[] }>();

  for (const candidate of partsByPath) {
    const key = shouldGroupBySecondLevel && candidate.parts.length >= 3
      ? `${candidate.parts[0]}/${candidate.parts[1]}`
      : candidate.parts[0] ?? candidate.path;
    const folderName = shouldGroupBySecondLevel && candidate.parts.length >= 3
      ? candidate.parts[1]
      : candidate.parts[0] ?? null;
    const group = groups.get(key) ?? { folderName, paths: [] };
    group.paths.push(candidate.path);
    groups.set(key, group);
  }

  return groups;
}

function collectApplicantIntakeGroupsFromCandidates(params: {
  pdfFileCandidates: FileCandidate[];
  metadataTextFileCandidates: MetadataTextFileCandidate[];
}): ApplicantIntakeFileGroup[] {
  const allCandidates: FileCandidate[] = [
    ...params.pdfFileCandidates,
    ...params.metadataTextFileCandidates,
  ];
  const folderGroups = groupedFolderParts(allCandidates);
  const groups = Array.from(folderGroups.entries()).map(([id, group]) => {
    const isInGroup = (candidate: FileCandidate) => group.paths.includes(candidate.path);
    const pdfFiles = dedupePdfFiles(params.pdfFileCandidates.filter(isInGroup).map((candidate) => candidate.file));
    const metadataTextFiles = prioritizedMetadataTextFiles(params.metadataTextFileCandidates.filter(isInGroup));
    return {
      id,
      folderName: group.folderName,
      pdfFiles,
      metadataTextFiles,
    };
  });

  return groups.filter((group) => group.pdfFiles.length > 0 || group.metadataTextFiles.length > 0);
}

export function collectApplicantIntakeGroupsFromFileList(files: File[]): ApplicantIntakeFileGroup[] {
  const pdfFileCandidates = files
    .filter(isPdfLike)
    .map((file) => ({ file, path: filePath(file) }));
  const metadataTextFileCandidates = files
    .filter(isTxtLike)
    .map((file) => ({ file, path: filePath(file) }));
  debugTextFileCandidates("detected TXT candidates from grouped file list", metadataTextFileCandidates);

  return collectApplicantIntakeGroupsFromCandidates({ pdfFileCandidates, metadataTextFileCandidates });
}

export async function collectApplicantIntakeFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<ApplicantIntakeFiles> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];

  if (items.length > 0) {
    const pdfFileCandidates: FileCandidate[] = [];
    const metadataTextFileCandidates: MetadataTextFileCandidate[] = [];
    const folderNames = new Set<string>();

    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry =
        typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;

      if (entry) {
        if (entry.isFile) {
          const file = await getFileFromFileEntry(entry as FileSystemFileEntry);
          if (isPdfLike(file)) pdfFileCandidates.push({ file, path: entry.name });
          if (isTxtLike(file)) metadataTextFileCandidates.push({ file, path: entry.name });
        } else if (entry.isDirectory) {
          folderNames.add(entry.name);
          console.debug("[ApplicantIntake] resolved dropped directory entry", { folderName: entry.name });
          const nested = await collectIntakeFilesFromDirectoryEntry(entry as FileSystemDirectoryEntry);
          pdfFileCandidates.push(...nested.pdfFileCandidates);
          metadataTextFileCandidates.push(...nested.metadataTextFileCandidates);
        }
      } else {
        const f = item.getAsFile();
        if (f && isPdfLike(f)) pdfFileCandidates.push({ file: f, path: filePath(f) });
        if (f && isTxtLike(f)) metadataTextFileCandidates.push({ file: f, path: filePath(f) });
      }
    }

    debugTextFileCandidates("detected TXT candidates from data transfer", metadataTextFileCandidates);
    const folderName = folderNames.size === 1 ? Array.from(folderNames)[0] : null;
    console.debug("[ApplicantIntake] resolved folder name from dropped entries", { folderName });

    return {
      pdfFiles: dedupePdfFiles(pdfFileCandidates.map((candidate) => candidate.file)),
      metadataTextFiles: prioritizedMetadataTextFiles(metadataTextFileCandidates),
      folderName,
    };
  }

  const fromFiles = dataTransfer.files ? Array.from(dataTransfer.files) : [];
  return collectApplicantIntakeFilesFromFileList(fromFiles);
}

export async function collectApplicantIntakeGroupsFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<ApplicantIntakeFileGroup[]> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];

  if (items.length > 0) {
    const pdfFileCandidates: FileCandidate[] = [];
    const metadataTextFileCandidates: MetadataTextFileCandidate[] = [];

    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry =
        typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;

      if (entry) {
        if (entry.isFile) {
          const file = await getFileFromFileEntry(entry as FileSystemFileEntry);
          if (isPdfLike(file)) pdfFileCandidates.push({ file, path: entry.name });
          if (isTxtLike(file)) metadataTextFileCandidates.push({ file, path: entry.name });
        } else if (entry.isDirectory) {
          const nested = await collectIntakeFilesFromDirectoryEntry(entry as FileSystemDirectoryEntry);
          pdfFileCandidates.push(...nested.pdfFileCandidates);
          metadataTextFileCandidates.push(...nested.metadataTextFileCandidates);
        }
      } else {
        const file = item.getAsFile();
        if (file && isPdfLike(file)) pdfFileCandidates.push({ file, path: filePath(file) });
        if (file && isTxtLike(file)) metadataTextFileCandidates.push({ file, path: filePath(file) });
      }
    }

    debugTextFileCandidates("detected TXT candidates from grouped data transfer", metadataTextFileCandidates);
    return collectApplicantIntakeGroupsFromCandidates({ pdfFileCandidates, metadataTextFileCandidates });
  }

  const fromFiles = dataTransfer.files ? Array.from(dataTransfer.files) : [];
  return collectApplicantIntakeGroupsFromFileList(fromFiles);
}

/**
 * Walks dropped files and folders (via `webkitGetAsEntry`) and returns a flat list of PDFs.
 * Non-PDF files are skipped. Duplicates (same name, size, lastModified) are collapsed.
 */
export async function collectPdfFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const intake = await collectApplicantIntakeFilesFromDataTransfer(dataTransfer);
  return intake.pdfFiles;
}
