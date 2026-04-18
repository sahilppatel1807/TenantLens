export type Tier = "good" | "average" | "bad";

export type ApplicantStatus = "new" | "shortlisted" | "rejected";

export type DocumentKey =
  | "id"
  | "passport"
  | "drivers_licence"
  | "proof_of_income"
  | "bank_statements"
  | "employment_letter"
  | "rental_history"
  | "references";

export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  id: "Photo ID",
  passport: "Passport",
  drivers_licence: "Driver's licence",
  proof_of_income: "Proof of income",
  bank_statements: "Bank statements",
  employment_letter: "Employment letter",
  rental_history: "Rental history",
  references: "References",
};

export const DOCUMENT_KEYS: DocumentKey[] = [
  "id",
  "passport",
  "drivers_licence",
  "proof_of_income",
  "bank_statements",
  "employment_letter",
  "rental_history",
  "references",
];

export interface Property {
  id: string;
  address: string;
  suburb: string;
  city: string;
  weeklyRent: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  imageUrl: string;
  status: "active" | "leased" | "draft";
  requiredDocuments: DocumentKey[];
  createdAt: string;
}

export interface Applicant {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone: string;
  occupation: string;
  weeklyIncome: number;
  submittedDocuments: DocumentKey[];
  rentalHistory: {
    yearsRenting: number;
    onTimePaymentsPct: number; // 0-100
    referenceQuality: "strong" | "ok" | "weak" | "none";
    notes?: string;
  };
  appliedAt: string;
  notes?: string;
  status: ApplicantStatus;
}
