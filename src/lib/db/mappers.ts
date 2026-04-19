import type { Applicant, ApplicantManualReview, ApplicantStatus, DocumentKey, Property, RentalHistory } from "@/lib/types";
import { DOCUMENT_KEYS } from "@/lib/types";

function normalizeRentalHistory(raw: unknown): RentalHistory {
  if (!raw || typeof raw !== "object") {
    return {
      yearsRenting: 0,
      onTimePaymentsPct: 0,
      referenceQuality: "none",
      monthsRenting: null,
      recommendationSentiment: null,
    };
  }
  const o = raw as Record<string, unknown>;
  const rq = o.referenceQuality;
  const referenceQuality =
    rq === "strong" || rq === "ok" || rq === "weak" || rq === "none" ? rq : "none";
  const rs = o.recommendationSentiment;
  const recommendationSentiment =
    rs === "strong" || rs === "neutral" || rs === "negative" ? rs : null;
  const monthsRaw =
    typeof o.monthsRenting === "number" && Number.isFinite(o.monthsRenting) ? o.monthsRenting : null;
  const monthsRenting = monthsRaw != null && monthsRaw > 0 ? monthsRaw : null;
  return {
    yearsRenting: typeof o.yearsRenting === "number" && Number.isFinite(o.yearsRenting) ? o.yearsRenting : 0,
    onTimePaymentsPct:
      typeof o.onTimePaymentsPct === "number" && Number.isFinite(o.onTimePaymentsPct)
        ? Math.min(100, Math.max(0, o.onTimePaymentsPct))
        : 0,
    referenceQuality,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    monthsRenting,
    recommendationSentiment,
  };
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80";

type PropertyRow = {
  id: string;
  user_id: string;
  address: string;
  suburb: string;
  city: string;
  weekly_rent: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  image_url: string;
  status: Property["status"];
  required_documents: string[] | null;
  created_at: string;
};

type ApplicantRow = {
  id: string;
  property_id: string;
  name: string;
  email: string;
  phone: string;
  occupation: string;
  weekly_income: number;
  submitted_documents: string[] | null;
  rental_history: Applicant["rentalHistory"];
  applied_at: string;
  notes: string | null;
  status: ApplicantStatus;
  manual_review: unknown;
};

function toDbInteger(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeManualReview(raw: unknown): ApplicantManualReview {
  if (!raw || typeof raw !== "object") {
    return {
      incomeExtractionFailed: false,
      referenceExtractionFailed: false,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    incomeExtractionFailed: o.incomeExtractionFailed === true,
    referenceExtractionFailed: o.referenceExtractionFailed === true,
  };
}

export function rowToProperty(row: PropertyRow): Property {
  const docs = (row.required_documents ?? []) as DocumentKey[];
  return {
    id: row.id,
    address: row.address,
    suburb: row.suburb,
    city: row.city,
    weeklyRent: row.weekly_rent,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    imageUrl: row.image_url?.trim() ? row.image_url : FALLBACK_IMAGE,
    status: row.status,
    requiredDocuments: docs,
    createdAt: row.created_at,
  };
}

function propertyRowFields(p: Omit<Property, "id" | "createdAt">) {
  return {
    address: p.address,
    suburb: p.suburb,
    city: p.city,
    weekly_rent: p.weeklyRent,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: p.parking,
    image_url: p.imageUrl?.trim() ? p.imageUrl : FALLBACK_IMAGE,
    status: p.status,
    required_documents: [...p.requiredDocuments],
  };
}

export function propertyToInsert(
  p: Omit<Property, "id" | "createdAt">,
  userId: string,
): Omit<PropertyRow, "id" | "created_at"> & { user_id: string } {
  return {
    user_id: userId,
    ...propertyRowFields(p),
  };
}

/** Columns for `properties.update` (no `user_id`). */
export function propertyToUpdateRow(p: Omit<Property, "id" | "createdAt">) {
  return propertyRowFields(p);
}

export function rowToApplicant(row: ApplicantRow): Applicant {
  const docs = normalizeDocumentKeys(row.submitted_documents ?? []);
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    occupation: row.occupation ?? "",
    weeklyIncome: row.weekly_income,
    submittedDocuments: docs,
    rentalHistory: normalizeRentalHistory(row.rental_history),
    appliedAt: row.applied_at,
    notes: row.notes ?? undefined,
    status: row.status,
    manualReview: normalizeManualReview(row.manual_review),
  };
}

export function applicantToInsert(
  a: Omit<Applicant, "id" | "appliedAt" | "status">,
): Omit<ApplicantRow, "id" | "applied_at" | "status"> {
  return {
    property_id: a.propertyId,
    name: a.name,
    email: a.email,
    phone: a.phone,
    occupation: a.occupation,
    weekly_income: toDbInteger(a.weeklyIncome),
    submitted_documents: normalizeDocumentKeys(a.submittedDocuments),
    rental_history: a.rentalHistory,
    notes: a.notes ?? null,
    manual_review: a.manualReview ?? {
      incomeExtractionFailed: false,
      referenceExtractionFailed: false,
    },
  };
}

/** Columns for `applicants.update` (excluding immutable identifiers/status). */
export function applicantToUpdateRow(a: Omit<Applicant, "id" | "propertyId" | "appliedAt" | "status">) {
  return {
    name: a.name,
    email: a.email,
    phone: a.phone,
    occupation: a.occupation,
    weekly_income: toDbInteger(a.weeklyIncome),
    submitted_documents: normalizeDocumentKeys(a.submittedDocuments),
    rental_history: a.rentalHistory,
    notes: a.notes ?? null,
    ...(a.manualReview ? { manual_review: a.manualReview } : {}),
  };
}

export function normalizeDocumentKeys(docs: string[]): DocumentKey[] {
  const allowed = new Set(DOCUMENT_KEYS);
  return Array.from(new Set(docs)).filter((doc): doc is DocumentKey => allowed.has(doc as DocumentKey));
}
