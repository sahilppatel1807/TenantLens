import type { DocumentKey } from "./types";

/** Logical document slot for completeness (one satisfied key per category counts once). */
export type DocumentCategory = "identity" | "income" | "bank" | "rental";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  identity: "ID",
  income: "Proof of income",
  bank: "Bank statements",
  rental: "Rental history or reference",
};

export function documentKeyCategory(key: DocumentKey): DocumentCategory {
  switch (key) {
    case "id":
    case "passport":
    case "drivers_licence":
      return "identity";
    case "proof_of_income":
    case "employment_letter":
      return "income";
    case "bank_statements":
      return "bank";
    case "rental_history":
    case "references":
      return "rental";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/** Distinct categories implied by the property checklist, in first-seen order. */
export function requiredCategoryIds(required: DocumentKey[]): DocumentCategory[] {
  const seen = new Set<DocumentCategory>();
  const out: DocumentCategory[] = [];
  for (const k of required) {
    const c = documentKeyCategory(k);
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/** Distinct categories covered by submitted keys, in first-seen order. */
export function submittedCategoryIds(submitted: DocumentKey[]): DocumentCategory[] {
  const seen = new Set<DocumentCategory>();
  const out: DocumentCategory[] = [];
  for (const k of submitted) {
    const c = documentKeyCategory(k);
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

export function categorySatisfied(requiredKey: DocumentKey, submittedKeys: DocumentKey[]): boolean {
  const need = documentKeyCategory(requiredKey);
  return submittedKeys.some((k) => documentKeyCategory(k) === need);
}

/**
 * One representative required `DocumentKey` per category that is still unsatisfied
 * (first matching entry from `required` order).
 */
export function missingRepresentativeRequiredKeys(
  required: DocumentKey[],
  submitted: DocumentKey[],
): DocumentKey[] {
  const submittedCats = new Set(submitted.map(documentKeyCategory));
  const result: DocumentKey[] = [];
  const seenMissingCat = new Set<DocumentCategory>();
  for (const reqKey of required) {
    const cat = documentKeyCategory(reqKey);
    if (submittedCats.has(cat)) continue;
    if (seenMissingCat.has(cat)) continue;
    seenMissingCat.add(cat);
    result.push(reqKey);
  }
  return result;
}

export function documentCategoryLabelForKey(key: DocumentKey): string {
  return DOCUMENT_CATEGORY_LABELS[documentKeyCategory(key)];
}

/** Order of categories in property required-doc UI and default `requiredDocuments`. */
export const PROPERTY_REQUIRED_CATEGORY_ORDER: DocumentCategory[] = [
  "identity",
  "income",
  "bank",
  "rental",
];

const CANONICAL_REQUIRED_KEY_BY_CATEGORY: Record<DocumentCategory, DocumentKey> = {
  identity: "id",
  income: "proof_of_income",
  bank: "bank_statements",
  rental: "rental_history",
};

/** Default `requiredDocuments` for new properties (one canonical key per category). */
export const DEFAULT_PROPERTY_REQUIRED_DOCUMENTS: DocumentKey[] =
  PROPERTY_REQUIRED_CATEGORY_ORDER.map((c) => CANONICAL_REQUIRED_KEY_BY_CATEGORY[c]);

export function propertyRequiresDocumentCategory(
  requiredDocuments: DocumentKey[],
  category: DocumentCategory,
): boolean {
  return requiredDocuments.some((k) => documentKeyCategory(k) === category);
}

/**
 * Toggle whether a property requires a document category. Rebuilds the list using
 * one canonical `DocumentKey` per enabled category (legacy granular keys are dropped).
 */
export function togglePropertyRequiredDocumentCategory(
  requiredDocuments: DocumentKey[],
  category: DocumentCategory,
): DocumentKey[] {
  const enabled = new Set(
    PROPERTY_REQUIRED_CATEGORY_ORDER.filter((c) =>
      propertyRequiresDocumentCategory(requiredDocuments, c),
    ),
  );
  if (enabled.has(category)) enabled.delete(category);
  else enabled.add(category);
  return PROPERTY_REQUIRED_CATEGORY_ORDER.filter((c) => enabled.has(c)).map(
    (c) => CANONICAL_REQUIRED_KEY_BY_CATEGORY[c],
  );
}
