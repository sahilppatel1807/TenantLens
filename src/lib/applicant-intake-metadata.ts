import type { Applicant } from "@/lib/types";

export type ApplicantIntakeMetadata = {
  name?: string;
  email?: string;
  phone?: string;
  occupation?: string;
};

const SUPPORTED_KEYS: Record<string, keyof ApplicantIntakeMetadata> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  "applicant name": "name",
  applicant: "name",
  email: "email",
  "email address": "email",
  "e mail": "email",
  phone: "phone",
  "phone no": "phone",
  "phone number": "phone",
  "phone num": "phone",
  "phone #": "phone",
  "contact": "phone",
  "contact no": "phone",
  "contact number": "phone",
  mobile: "phone",
  "mobile no": "phone",
  "mobile number": "phone",
  telephone: "phone",
  occupation: "occupation",
  job: "occupation",
  role: "occupation",
  profession: "occupation",
};

function normalizeMetadataKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+#$/, " #")
    .trim();
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function normalizeApplicantNameFromFolderName(folderName: string | null | undefined): string {
  const cleaned = (folderName ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  return cleaned.split(" ").map(titleCaseWord).join(" ");
}

export function parseApplicantIntakeMetadataText(text: string): ApplicantIntakeMetadata {
  const out: ApplicantIntakeMetadata = {};

  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^(.+?)\s*(?::|=|\s-\s|\s\u2013\s|\s\u2014\s)\s*(.+)$/.exec(line);
    if (!match) continue;

    const rawKey = normalizeMetadataKey(match[1]);
    const value = match[2].trim();
    const key = SUPPORTED_KEYS[rawKey];
    if (!key || !value) continue;
    out[key] = value;
  }

  return out;
}

export async function parseApplicantIntakeMetadataFiles(files: File[]): Promise<ApplicantIntakeMetadata> {
  const merged: ApplicantIntakeMetadata = {};

  for (const file of files) {
    const rawText = await file.text();
    console.debug("[ApplicantIntakeMetadata] raw TXT metadata", {
      fileName: file.name,
      size: file.size,
      text: rawText,
    });
    const parsed = parseApplicantIntakeMetadataText(rawText);
    console.debug("[ApplicantIntakeMetadata] parsed TXT metadata", {
      fileName: file.name,
      parsed,
    });
    for (const [key, value] of Object.entries(parsed) as [keyof ApplicantIntakeMetadata, string][]) {
      merged[key] ??= value;
    }
  }

  return merged;
}

export function applicantIntakePrefillFromFolderAndMetadata(params: {
  folderName: string | null;
  metadata: ApplicantIntakeMetadata;
}): ApplicantIntakeMetadata {
  const folderName = normalizeApplicantNameFromFolderName(params.folderName);
  return {
    ...(folderName ? { name: folderName } : {}),
    ...params.metadata,
  };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]+/g, "");
}

export function findDuplicateApplicantForProperty(params: {
  applicants: Applicant[];
  propertyId: string;
  name: string;
  email: string;
  phone: string;
}): Applicant | null {
  const propertyApplicants = params.applicants.filter((applicant) => applicant.propertyId === params.propertyId);
  const email = normalizeText(params.email);

  if (email) {
    const byEmail = propertyApplicants.find((applicant) => normalizeText(applicant.email) === email);
    if (byEmail) return byEmail;
  }

  const name = normalizeText(params.name);
  const phone = normalizePhone(params.phone);
  if (!name || !phone) return null;

  return (
    propertyApplicants.find(
      (applicant) => normalizeText(applicant.name) === name && normalizePhone(applicant.phone) === phone,
    ) ?? null
  );
}
